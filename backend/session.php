<?php
/**
 * Devuelve el usuario actual si está logueado
 */
require_once __DIR__ . '/helpers.php';

if (empty($_SESSION['user_id'])) {
    jsonResponse(['ok' => false, 'usuario' => null]);
}
$nombre = $_SESSION['name'] ?? null;
if ($nombre === null || $nombre === '') {
    $data = readJson(FILE_USERS);
    $users = isset($data['users']) && is_array($data['users']) ? $data['users'] : [];
    $current = $_SESSION['usuario'] ?? '';
    foreach ($users as $u) {
        $un = $u['username'] ?? $u['usuario'] ?? '';
        if (strcasecmp($un, $current) === 0) {
            $nombre = trim($u['name'] ?? $u['username'] ?? $u['usuario'] ?? $current);
            $_SESSION['name'] = $nombre;
            break;
        }
    }
    if ($nombre === null || $nombre === '') $nombre = $_SESSION['usuario'] ?? null;
}
jsonResponse([
    'ok' => true,
    'usuario' => $_SESSION['usuario'] ?? null,
    'nombre' => $nombre,
    'perfil' => $_SESSION['perfil'] ?? null
]);
