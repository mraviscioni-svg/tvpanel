<?php
/**
 * ABM Productos - graba en JSON/productos.json
 * Estructura: { updated, moneda, categorias: [ { nombre, items: [ { id, nombre, unidad, precio, tag, estado } ] } ] }
 */
require_once __DIR__ . '/helpers.php';

requireLogin();

$input = getInput();
$action = $_GET['action'] ?? $input['action'] ?? 'list';
$id = trim((string)($_GET['id'] ?? $input['id'] ?? ''));

$data = readJson(FILE_PRODUCTOS);
if (!isset($data['categorias']) || !is_array($data['categorias'])) {
    $data = ['updated' => updatedTimestamp(), 'moneda' => 'ARS', 'categorias' => []];
}
if (empty($data['moneda'])) $data['moneda'] = 'ARS';

function findItemProductos($data, $id) {
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
        list($ci, $ii, $item) = findItemProductos($data, $id);
        if ($item === null) {
            jsonError('Producto no encontrado', 404);
        }
        $item['_categoria'] = $data['categorias'][$ci]['nombre'] ?? '';
        jsonResponse(['ok' => true, 'data' => $item]);
        break;

    case 'create':
        $categoriaNombre = trim($input['categoria'] ?? $input['nombre_categoria'] ?? '');
        $nombre = trim($input['nombre'] ?? '');
        if ($nombre === '') {
            jsonError('Nombre del producto requerido');
        }
        if ($categoriaNombre === '') {
            jsonError('Categoría requerida');
        }
        $newId = (string) nextIdEnCategorias($data);
        $newItem = [
            'nombre' => $nombre,
            'unidad' => trim($input['unidad'] ?? ''),
            'precio' => (int)(float)($input['precio'] ?? 0),
            'tag' => trim($input['tag'] ?? ''),
            'estado' => isset($input['estado']) ? (int)(bool)$input['estado'] : 1,
            'id' => $newId,
            'updated_at' => updatedTimestamp(),
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
        if (!writeJson(FILE_PRODUCTOS, $data)) {
            jsonError('Error al guardar', 500);
        }
        jsonResponse(['ok' => true, 'data' => $newItem]);
        break;

    case 'update':
        if ($id === '') {
            jsonError('id requerido');
        }
        list($ci, $ii, $item) = findItemProductos($data, $id);
        if ($item === null) {
            jsonError('Producto no encontrado', 404);
        }
        if (isset($input['nombre'])) $data['categorias'][$ci]['items'][$ii]['nombre'] = trim($input['nombre']);
        if (array_key_exists('unidad', $input)) $data['categorias'][$ci]['items'][$ii]['unidad'] = trim($input['unidad']);
        if (array_key_exists('precio', $input)) $data['categorias'][$ci]['items'][$ii]['precio'] = (int)(float)$input['precio'];
        if (array_key_exists('tag', $input)) $data['categorias'][$ci]['items'][$ii]['tag'] = trim($input['tag']);
        if (array_key_exists('estado', $input)) $data['categorias'][$ci]['items'][$ii]['estado'] = (int)(bool)$input['estado'];
        $data['categorias'][$ci]['items'][$ii]['updated_at'] = updatedTimestamp();
        if (!empty($input['categoria']) && trim($input['categoria']) !== ($data['categorias'][$ci]['nombre'] ?? '')) {
            $newCatName = trim($input['categoria']);
            $item = $data['categorias'][$ci]['items'][$ii];
            array_splice($data['categorias'][$ci]['items'], $ii, 1);
            if (empty($data['categorias'][$ci]['items'])) {
                array_splice($data['categorias'], $ci, 1);
            }
            $catIdx = null;
            foreach ($data['categorias'] as $i => $cat) {
                if (isset($cat['nombre']) && trim($cat['nombre']) === $newCatName) {
                    $catIdx = $i;
                    break;
                }
            }
            if ($catIdx === null) {
                $data['categorias'][] = ['nombre' => $newCatName, 'items' => [$item]];
            } else {
                $data['categorias'][$catIdx]['items'][] = $item;
            }
        }
        $data['updated'] = updatedTimestamp();
        if (!writeJson(FILE_PRODUCTOS, $data)) {
            jsonError('Error al guardar', 500);
        }
        list(, , $updatedItem) = findItemProductos($data, $id);
        jsonResponse(['ok' => true, 'data' => $updatedItem ?? $item]);
        break;

    case 'delete':
        if ($id === '') {
            jsonError('id requerido');
        }
        list($ci, $ii, $item) = findItemProductos($data, $id);
        if ($item === null) {
            jsonError('Producto no encontrado', 404);
        }
        array_splice($data['categorias'][$ci]['items'], $ii, 1);
        if (empty($data['categorias'][$ci]['items'])) {
            array_splice($data['categorias'], $ci, 1);
        }
        $data['updated'] = updatedTimestamp();
        if (!writeJson(FILE_PRODUCTOS, $data)) {
            jsonError('Error al guardar', 500);
        }
        jsonResponse(['ok' => true]);
        break;

    default:
        jsonError('Acción no válida');
}
