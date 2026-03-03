<?php
/**
 * Login: valida contra JSON/users.json (estructura: { users: [ { username, password, role, ... } ] })
 */
require_once __DIR__ . '/helpers.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonError('Método no permitido', 405);
}

$input = getInput();
$usuario = trim($input['usuario'] ?? $input['username'] ?? '');
$password = $input['password'] ?? '';

if ($usuario === '' || $password === '') {
    jsonError('Usuario y contraseña requeridos');
}

$data = readJson(FILE_USERS);
$users = isset($data['users']) && is_array($data['users']) ? $data['users'] : [];
$found = null;
foreach ($users as $u) {
    $un = $u['username'] ?? $u['usuario'] ?? '';
    if (strcasecmp($un, $usuario) === 0) {
        $found = $u;
        break;
    }
}

if (!$found) {
    jsonError('Usuario o contraseña incorrectos', 401);
}

if (empty($found['active']) && $found['active'] !== 1) {
    jsonError('Usuario inactivo', 403);
}

$storedPassword = $found['password'] ?? '';
$valid = false;
if (strlen($storedPassword) > 0 && $storedPassword[0] === '$') {
    $valid = password_verify($password, $storedPassword);
} else {
    $valid = ($storedPassword === $password);
}

if (!$valid) {
    jsonError('Usuario o contraseña incorrectos', 401);
}

$role = $found['role'] ?? 'editor';
$_SESSION['user_id'] = $found['id'] ?? 0;
$_SESSION['usuario'] = $found['username'] ?? $found['usuario'] ?? $usuario;
$_SESSION['perfil'] = ($role === 'admin') ? PERFIL_ADMIN : PERFIL_USUARIO;

jsonResponse([
    'ok' => true,
    'usuario' => $_SESSION['usuario'],
    'perfil' => $_SESSION['perfil']
]);
