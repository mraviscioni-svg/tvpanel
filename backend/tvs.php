<?php
/**
 * ABM Televisores - graba en JSON/tvs.json
 * Estructura: { header: { title, hint }, tvs: [ { id, title, tag, description, url, active } ] }
 */
require_once __DIR__ . '/helpers.php';

requireLogin();

$input = getInput();
$action = $_GET['action'] ?? $input['action'] ?? 'list';
$id = trim((string)($_GET['id'] ?? $input['id'] ?? ''));

$data = readJson(FILE_TVS);
if (!isset($data['tvs']) || !is_array($data['tvs'])) {
    $data = ['header' => ['title' => 'Panel de TVs', 'hint' => 'Elegí una pantalla para abrir su cartelera'], 'tvs' => []];
}
if (empty($data['header'])) {
    $data['header'] = ['title' => 'Panel de TVs', 'hint' => ''];
}
$items = &$data['tvs'];

function findTv($items, $id) {
    $idStr = (string)$id;
    foreach ($items as $i => $t) {
        if (isset($t['id']) && (string)$t['id'] === $idStr) {
            return [$i, $t];
        }
    }
    return [null, null];
}

switch ($action) {
    case 'list':
        jsonResponse(['ok' => true, 'data' => $data]);
        break;

    case 'get':
        if ($id === '') {
            jsonError('id requerido');
        }
        list($idx, $item) = findTv($items, $id);
        if ($item === null) {
            jsonError('Televisor no encontrado', 404);
        }
        jsonResponse(['ok' => true, 'data' => $item]);
        break;

    case 'create':
        $title = trim($input['title'] ?? $input['nombre'] ?? '');
        if ($title === '') {
            jsonError('title requerido');
        }
        $newId = trim($input['id'] ?? 'tv' . (count($items) + 1));
        if ($newId === '') $newId = 'tv' . (count($items) + 1);
        list($existingIdx, ) = findTv($items, $newId);
        if ($existingIdx !== null) {
            jsonError('Ya existe un TV con ese id');
        }
        $new = [
            'id' => $newId,
            'title' => $title,
            'tag' => trim($input['tag'] ?? 'TV'),
            'description' => trim($input['description'] ?? ''),
            'url' => trim($input['url'] ?? ''),
            'active' => isset($input['active']) ? (bool)$input['active'] : true,
        ];
        $items[] = $new;
        if (!writeJson(FILE_TVS, $data)) {
            jsonError('Error al guardar', 500);
        }
        jsonResponse(['ok' => true, 'data' => $new]);
        break;

    case 'update':
        if ($id === '') {
            jsonError('id requerido');
        }
        list($idx, $item) = findTv($items, $id);
        if ($item === null) {
            jsonError('Televisor no encontrado', 404);
        }
        if (isset($input['title'])) $items[$idx]['title'] = trim($input['title']);
        if (array_key_exists('tag', $input)) $items[$idx]['tag'] = trim($input['tag']);
        if (array_key_exists('description', $input)) $items[$idx]['description'] = trim($input['description']);
        if (array_key_exists('url', $input)) $items[$idx]['url'] = trim($input['url']);
        if (array_key_exists('active', $input)) $items[$idx]['active'] = (bool)$input['active'];
        if (!writeJson(FILE_TVS, $data)) {
            jsonError('Error al guardar', 500);
        }
        jsonResponse(['ok' => true, 'data' => $items[$idx]]);
        break;

    case 'delete':
        if ($id === '') {
            jsonError('id requerido');
        }
        list($idx, $item) = findTv($items, $id);
        if ($item === null) {
            jsonError('Televisor no encontrado', 404);
        }
        array_splice($items, $idx, 1);
        if (!writeJson(FILE_TVS, $data)) {
            jsonError('Error al guardar', 500);
        }
        jsonResponse(['ok' => true]);
        break;

    case 'header':
        if (isset($input['title'])) $data['header']['title'] = trim($input['title']);
        if (array_key_exists('hint', $input)) $data['header']['hint'] = trim($input['hint']);
        if (!writeJson(FILE_TVS, $data)) {
            jsonError('Error al guardar', 500);
        }
        jsonResponse(['ok' => true, 'data' => $data['header']]);
        break;

    default:
        jsonError('Acción no válida');
}
