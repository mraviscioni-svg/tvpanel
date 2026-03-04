<?php
/**
 * Perfil del usuario logueado: solo puede editar su nombre y contraseña.
 */
require_once __DIR__ . '/helpers.php';

$user = requireLogin();

$input = getInput();
$action = $_GET['action'] ?? $input['action'] ?? 'get';

$data = readJson(FILE_USERS);
$items = &$data['users'];
if (!is_array($items)) $items = [];

$idx = null;
$currentUsuario = $_SESSION['usuario'] ?? '';
foreach ($items as $i => $u) {
    $un = $u['username'] ?? $u['usuario'] ?? '';
    if (strcasecmp($un, $currentUsuario) === 0) {
        $idx = $i;
        break;
    }
}
if ($idx === null) {
    jsonError('Usuario no encontrado', 404);
}

if ($action === 'get') {
    $out = $items[$idx];
    unset($out['password']);
    jsonResponse(['ok' => true, 'data' => $out]);
    exit;
}

if ($action === 'update') {
    if (array_key_exists('name', $input)) {
        $items[$idx]['name'] = trim($input['name'] ?? '');
    }
    if (isset($input['password']) && $input['password'] !== '') {
        $items[$idx]['password'] = password_hash($input['password'], PASSWORD_DEFAULT);
    }
    $_SESSION['name'] = trim($items[$idx]['name'] ?? $items[$idx]['username'] ?? $items[$idx]['usuario'] ?? '');
    $data['updated'] = updatedTimestamp();
    if (!writeJson(FILE_USERS, $data)) {
        jsonError('Error al guardar', 500);
    }
    $out = $items[$idx];
    unset($out['password']);
    jsonResponse(['ok' => true, 'data' => $out]);
    exit;
}

jsonError('Acción no válida', 400);
