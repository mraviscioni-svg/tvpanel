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
    // UTF-8 BOM (p. ej. guardado con PowerShell) rompe json_decode en PHP
    if (strncmp($raw, "\xEF\xBB\xBF", 3) === 0) {
        $raw = substr($raw, 3);
    }
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

/** true si el archivo existe, tiene contenido y no es JSON válido */
function readJsonFailed($file) {
    if (!file_exists($file)) {
        return false;
    }
    $raw = file_get_contents($file);
    if ($raw === false || trim($raw) === '') {
        return false;
    }
    if (strncmp($raw, "\xEF\xBB\xBF", 3) === 0) {
        $raw = substr($raw, 3);
    }
    $data = json_decode($raw, true);
    return !is_array($data);
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

function requireAdminOrSupervisor() {
    $user = requireLogin();
    if ($user['perfil'] !== PERFIL_ADMIN && $user['perfil'] !== PERFIL_SUPERVISOR) {
        jsonError('Acceso no autorizado', 403);
    }
    return $user;
}

/** URL pública del sitio (config.json → publicBaseUrl, o inferida del request). */
function getSitePublicBaseUrl() {
    static $base = null;
    if ($base !== null) {
        return $base;
    }
    $configPath = __DIR__ . '/config.json';
    if (file_exists($configPath)) {
        $decoded = @json_decode(file_get_contents($configPath), true);
        if (is_array($decoded) && !empty($decoded['publicBaseUrl'])) {
            $base = rtrim(trim($decoded['publicBaseUrl']), '/');
            return $base;
        }
    }
    $https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || (!empty($_SERVER['HTTP_X_FORWARDED_PROTO']) && strtolower((string)$_SERVER['HTTP_X_FORWARDED_PROTO']) === 'https');
    $host = $_SERVER['HTTP_HOST'] ?? 'localhost';
    $base = ($https ? 'https' : 'http') . '://' . $host;
    return $base;
}

/**
 * Path relativo al document root (para disco y JSON interno).
 * Acepta URL absoluta, legado VIDEO/… o IMG/CORTES/….
 */
function mediaPathToRelative($path) {
    if ($path === null || $path === '') {
        return '';
    }
    $path = trim(str_replace('\\', '/', (string)$path));
    if ($path === '') {
        return '';
    }
    if (preg_match('#^https?://#i', $path)) {
        $base = getSitePublicBaseUrl();
        if (stripos($path, $base . '/') === 0) {
            $path = substr($path, strlen($base) + 1);
        } else {
            $parsed = parse_url($path);
            $path = ltrim($parsed['path'] ?? '', '/');
        }
    }

    $imgRel = trim(CORTES_DIR_REL, '/');
    $vidRel = trim(CORTES_VIDEO_REL, '/');

    if (preg_match('#^VIDEO/(.+)$#i', $path, $m)) {
        return $vidRel . '/' . $m[1];
    }
    if (preg_match('#^CORTES/VIDEO/(.+)$#i', $path, $m)) {
        return $vidRel . '/' . $m[1];
    }
    if (preg_match('#^CORTES/(.+)$#i', $path, $m)) {
        return $imgRel . '/' . $m[1];
    }
    if (strpos($path, $imgRel . '/') === 0 || strpos($path, $vidRel . '/') === 0) {
        return $path;
    }

    $ext = strtolower(pathinfo($path, PATHINFO_EXTENSION));
    $isVideo = in_array($ext, ['mp4', 'webm', 'mov'], true);
    $baseRel = $isVideo ? $vidRel : $imgRel;

    if (strpos($path, '/') === false) {
        return $baseRel . '/' . $path;
    }

    return $path;
}

/** URL absoluta para guardar en JSON y consumir en TVs / admin. */
function mediaPublicUrl($path) {
    if ($path === null || $path === '') {
        return '';
    }
    $path = trim((string)$path);
    if (preg_match('#^https?://#i', $path)) {
        return $path;
    }
    $rel = mediaPathToRelative($path);
    if ($rel === '') {
        return '';
    }
    return getSitePublicBaseUrl() . '/' . ltrim($rel, '/');
}
