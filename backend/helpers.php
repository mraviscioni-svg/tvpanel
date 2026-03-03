<?php
/**
 * Helpers: lectura/escritura JSON y validación de sesión
 */

require_once __DIR__ . '/config.php';

function readJson($file) {
    if (!file_exists($file)) {
        return [];
    }
    $raw = file_get_contents($file);
    if ($raw === false || trim($raw) === '') {
        return [];
    }
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

function writeJson($file, $data) {
    $dir = dirname($file);
    if (!is_dir($dir)) {
        mkdir($dir, 0755, true);
    }
    $ok = file_put_contents($file, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
    return $ok !== false;
}

function nextId($items) {
    if (empty($items)) {
        return 1;
    }
    $ids = array_map(function ($item) {
        return isset($item['id']) ? (int)$item['id'] : 0;
    }, $items);
    return max($ids) + 1;
}

/** Máximo id numérico en categorias[].items (productos/ofertas) */
function nextIdEnCategorias($data) {
    $max = 0;
    if (empty($data['categorias']) || !is_array($data['categorias'])) {
        return 1;
    }
    foreach ($data['categorias'] as $cat) {
        if (empty($cat['items']) || !is_array($cat['items'])) continue;
        foreach ($cat['items'] as $item) {
            $id = isset($item['id']) ? (int)$item['id'] : 0;
            if ($id > $max) $max = $id;
        }
    }
    return $max + 1;
}

function updatedTimestamp() {
    return date('d-m-Y H:i');
}

function getInput() {
    $input = file_get_contents('php://input');
    if ($input === false || $input === '') {
        return $_POST;
    }
    $decoded = json_decode($input, true);
    return is_array($decoded) ? $decoded : $_POST;
}

function jsonResponse($data, $code = 200) {
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function jsonError($message, $code = 400) {
    jsonResponse(['ok' => false, 'error' => $message], $code);
}

function requireLogin() {
    if (empty($_SESSION['user_id']) || empty($_SESSION['usuario'])) {
        jsonError('Debe iniciar sesión', 401);
    }
    return [
        'id' => $_SESSION['user_id'],
        'usuario' => $_SESSION['usuario'],
        'perfil' => $_SESSION['perfil'] ?? PERFIL_USUARIO
    ];
}

function requireAdmin() {
    $user = requireLogin();
    if ($user['perfil'] !== PERFIL_ADMIN) {
        jsonError('Acceso solo para administradores', 403);
    }
    return $user;
}
