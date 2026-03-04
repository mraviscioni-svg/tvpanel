<?php
/**
 * Configuración del backend TVPANEL
 * Compatible con hosting PHP externo
 * Ruta de los JSON: configurable vía config.json (carpeta respecto a la raíz del proyecto)
 */

// Cookie de sesión segura: nunca enviar credenciales por URL; solo por POST en cuerpo y sesión en cookie
if (PHP_VERSION_ID >= 70300) {
    session_set_cookie_params([
        'lifetime' => 0,
        'path' => '/',
        'secure' => (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || (!empty($_SERVER['HTTP_X_FORWARDED_PROTO']) && $_SERVER['HTTP_X_FORWARDED_PROTO'] === 'https'),
        'httponly' => true,
        'samesite' => 'Lax'
    ]);
} else {
    $secure = !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off';
    session_set_cookie_params(0, '/', '', $secure, true);
}
session_start();

define('ROOT', dirname(__DIR__));

// Ruta de la carpeta donde están los JSON (misma altura que backend/, ej: JSON)
$configPath = __DIR__ . '/config.json';
$dataFolder = 'JSON';
$cfg = [];
if (file_exists($configPath)) {
    $decoded = @json_decode(file_get_contents($configPath), true);
    if (is_array($decoded)) $cfg = $decoded;
    if (!empty($cfg['dataPath'])) {
        $dataFolder = trim($cfg['dataPath']);
    }
}
define('DATA_DIR', ROOT . '/' . $dataFolder);

// Rutas de upload (imágenes y videos) configurables vía config.json
$mediaImagesPath = isset($cfg['mediaImagesPath']) ? trim($cfg['mediaImagesPath']) : 'IMG/CORTES';
$mediaVideosPath = isset($cfg['mediaVideosPath']) ? trim($cfg['mediaVideosPath']) : 'IMG/CORTES/VIDEO';
if ($mediaImagesPath === '') $mediaImagesPath = 'IMG/CORTES';
if ($mediaVideosPath === '') $mediaVideosPath = 'IMG/CORTES/VIDEO';
define('CORTES_DIR', ROOT . '/' . trim($mediaImagesPath, '/'));
define('CORTES_VIDEO', ROOT . '/' . trim($mediaVideosPath, '/'));

// Archivos JSON (nombres según tus archivos)
define('FILE_USERS', DATA_DIR . '/users.json');
define('FILE_PRODUCTOS', DATA_DIR . '/productos.json');
define('FILE_OFERTAS', DATA_DIR . '/ofertas.json');
define('FILE_TVS', DATA_DIR . '/tvs.json');

// Perfiles (mapeo: admin -> Admin, editor -> Usuario)
define('PERFIL_ADMIN', 'Admin');
define('PERFIL_USUARIO', 'Usuario');

// Headers JSON para API
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}
