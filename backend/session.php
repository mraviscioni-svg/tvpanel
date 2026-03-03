<?php
/**
 * Devuelve el usuario actual si está logueado
 */
require_once __DIR__ . '/helpers.php';

if (empty($_SESSION['user_id'])) {
    jsonResponse(['ok' => false, 'usuario' => null]);
}
jsonResponse([
    'ok' => true,
    'usuario' => $_SESSION['usuario'] ?? null,
    'perfil' => $_SESSION['perfil'] ?? null
]);
