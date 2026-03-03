<?php
/**
 * ABM Ofertas - graba en JSON/ofertas.json
 * Estructura: { updated, moneda, categorias: [ { nombre, items: [ { id?, nombre, unidad, precio, imagen1, imagen2 } ] } ] }
 * imagen1/imagen2: path (ej. VIDEO/xxx.mp4) o archivo subido (se guarda en uploads/ofertas/)
 */
require_once __DIR__ . '/helpers.php';

requireLogin();

if (!is_dir(UPLOADS_OFERTAS)) {
    mkdir(UPLOADS_OFERTAS, 0755, true);
}

$ALLOWED_IMAGE = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
$ALLOWED_VIDEO = ['video/mp4', 'video/webm', 'video/quicktime'];
$EXT_IMAGE = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
$EXT_VIDEO = ['mp4', 'webm', 'mov'];

function subirArchivoOferta($fileKey, $tipo = 'imagen') {
    global $ALLOWED_IMAGE, $ALLOWED_VIDEO, $EXT_IMAGE, $EXT_VIDEO;
    if (empty($_FILES[$fileKey]) || $_FILES[$fileKey]['error'] !== UPLOAD_ERR_OK) {
        return null;
    }
    $f = $_FILES[$fileKey];
    $allowed = $tipo === 'video' ? $ALLOWED_VIDEO : $ALLOWED_IMAGE;
    $exts = $tipo === 'video' ? $EXT_VIDEO : $EXT_IMAGE;
    $finfo = new finfo(FILEINFO_MIME_TYPE);
    $mime = $finfo->file($f['tmp_name']);
    if (!in_array($mime, $allowed, true)) {
        return null;
    }
    $ext = pathinfo($f['name'], PATHINFO_EXTENSION);
    if (!in_array(strtolower($ext), $exts, true)) {
        $ext = $tipo === 'video' ? 'mp4' : 'jpg';
    }
    $nombre = $tipo . '_' . uniqid() . '.' . $ext;
    $destino = UPLOADS_OFERTAS . '/' . $nombre;
    if (!move_uploaded_file($f['tmp_name'], $destino)) {
        return null;
    }
    return 'uploads/ofertas/' . $nombre;
}

function eliminarArchivoOferta($path) {
    if (empty($path)) return;
    if (strpos($path, 'uploads/ofertas/') === 0) {
        $full = ROOT . '/' . $path;
    } else {
        $full = UPLOADS_OFERTAS . '/' . basename($path);
    }
    if (file_exists($full)) {
        @unlink($full);
    }
}

$input = getInput();
if (!empty($_POST)) {
    $input = array_merge($input, $_POST);
}
$action = $_GET['action'] ?? $input['action'] ?? 'list';
$id = isset($_GET['id']) ? trim((string)($_GET['id'] ?? $input['id'] ?? '')) : '';

$data = readJson(FILE_OFERTAS);
if (!isset($data['categorias']) || !is_array($data['categorias'])) {
    $data = ['updated' => updatedTimestamp(), 'moneda' => 'ARS', 'categorias' => []];
}
if (empty($data['moneda'])) $data['moneda'] = 'ARS';

function findItemOfertas($data, $id) {
    $idStr = (string)$id;
    foreach ($data['categorias'] as $ci => $cat) {
        if (empty($cat['items']) || !is_array($cat['items'])) continue;
        foreach ($cat['items'] as $ii => $item) {
            if (isset($item['id']) && (string)$item['id'] === $idStr) {
                return [$ci, $ii, $item];
            }
        }
    }
    return [null, null, null];
}

switch ($action) {
    case 'list':
        jsonResponse(['ok' => true, 'data' => $data]);
        break;

    case 'get':
        if ($id === '') {
            jsonError('id requerido');
        }
        list($ci, $ii, $item) = findItemOfertas($data, $id);
        if ($item === null) {
            jsonError('Oferta no encontrada', 404);
        }
        $item['_categoria'] = $data['categorias'][$ci]['nombre'] ?? '';
        jsonResponse(['ok' => true, 'data' => $item]);
        break;

    case 'create':
        $categoriaNombre = trim($input['categoria'] ?? $input['nombre_categoria'] ?? '');
        $nombre = trim($input['nombre'] ?? '');
        if ($nombre === '') {
            jsonError('Nombre requerido');
        }
        if ($categoriaNombre === '') {
            jsonError('Categoría requerida');
        }
        $newId = (string) nextIdEnCategorias($data);
        $imagen1 = subirArchivoOferta('imagen1', 'imagen') ?? subirArchivoOferta('imagen', 'imagen');
        $imagen2 = subirArchivoOferta('imagen2', 'imagen');
        if (!$imagen1 && !empty($input['imagen1'])) $imagen1 = trim($input['imagen1']);
        if (!$imagen2 && !empty($input['imagen2'])) $imagen2 = trim($input['imagen2']);
        $video1 = subirArchivoOferta('video1', 'video');
        if (!$imagen1 && $video1) $imagen1 = $video1;
        if (!$imagen1 && !empty($input['imagen1'])) $imagen1 = trim($input['imagen1']);
        $newItem = [
            'id' => $newId,
            'nombre' => $nombre,
            'unidad' => trim($input['unidad'] ?? ''),
            'precio' => (int)(float)($input['precio'] ?? 0),
            'imagen1' => $imagen1 ?? '',
            'imagen2' => $imagen2 ?? '',
        ];
        $catIdx = null;
        foreach ($data['categorias'] as $i => $cat) {
            if (isset($cat['nombre']) && trim($cat['nombre']) === $categoriaNombre) {
                $catIdx = $i;
                break;
            }
        }
        if ($catIdx === null) {
            $data['categorias'][] = ['nombre' => $categoriaNombre, 'items' => [$newItem]];
        } else {
            $data['categorias'][$catIdx]['items'][] = $newItem;
        }
        $data['updated'] = updatedTimestamp();
        if (!writeJson(FILE_OFERTAS, $data)) {
            eliminarArchivoOferta($imagen1 ?? '');
            eliminarArchivoOferta($imagen2 ?? '');
            jsonError('Error al guardar', 500);
        }
        jsonResponse(['ok' => true, 'data' => $newItem]);
        break;

    case 'update':
        if ($id === '') {
            jsonError('id requerido');
        }
        list($ci, $ii, $item) = findItemOfertas($data, $id);
        if ($item === null) {
            jsonError('Oferta no encontrada', 404);
        }
        if (isset($input['nombre'])) $data['categorias'][$ci]['items'][$ii]['nombre'] = trim($input['nombre']);
        if (array_key_exists('unidad', $input)) $data['categorias'][$ci]['items'][$ii]['unidad'] = trim($input['unidad']);
        if (array_key_exists('precio', $input)) $data['categorias'][$ci]['items'][$ii]['precio'] = (int)(float)$input['precio'];
        $up1 = subirArchivoOferta('imagen1', 'imagen') ?? subirArchivoOferta('imagen', 'imagen');
        if ($up1) {
            eliminarArchivoOferta($data['categorias'][$ci]['items'][$ii]['imagen1'] ?? '');
            $data['categorias'][$ci]['items'][$ii]['imagen1'] = $up1;
        } elseif (array_key_exists('imagen1', $input)) {
            $data['categorias'][$ci]['items'][$ii]['imagen1'] = trim($input['imagen1']);
        }
        $up2 = subirArchivoOferta('imagen2', 'imagen');
        if ($up2) {
            eliminarArchivoOferta($data['categorias'][$ci]['items'][$ii]['imagen2'] ?? '');
            $data['categorias'][$ci]['items'][$ii]['imagen2'] = $up2;
        } elseif (array_key_exists('imagen2', $input)) {
            $data['categorias'][$ci]['items'][$ii]['imagen2'] = trim($input['imagen2']);
        }
        $data['updated'] = updatedTimestamp();
        if (!writeJson(FILE_OFERTAS, $data)) {
            jsonError('Error al guardar', 500);
        }
        jsonResponse(['ok' => true, 'data' => $data['categorias'][$ci]['items'][$ii]]);
        break;

    case 'delete':
        if ($id === '') {
            jsonError('id requerido');
        }
        list($ci, $ii, $item) = findItemOfertas($data, $id);
        if ($item === null) {
            jsonError('Oferta no encontrada', 404);
        }
        eliminarArchivoOferta($item['imagen1'] ?? '');
        eliminarArchivoOferta($item['imagen2'] ?? '');
        array_splice($data['categorias'][$ci]['items'], $ii, 1);
        if (empty($data['categorias'][$ci]['items'])) {
            array_splice($data['categorias'], $ci, 1);
        }
        $data['updated'] = updatedTimestamp();
        if (!writeJson(FILE_OFERTAS, $data)) {
            jsonError('Error al guardar', 500);
        }
        jsonResponse(['ok' => true]);
        break;

    default:
        jsonError('Acción no válida');
}
