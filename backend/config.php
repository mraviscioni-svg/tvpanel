<?php
/**
 * Configuración del backend TVPANEL
 * Compatible con hosting PHP externo
 * Ruta de los JSON: configurable vía config.json (carpeta respecto a la raíz del proyecto)
 */

session_start();

define('ROOT', dirname(__DIR__));

// Ruta de la carpeta donde están los JSON (misma altura que backend/, ej: JSON)
$configPath = __DIR__ . '/config.json';
$dataFolder = 'JSON';
if (file_exists($configPath)) {
    $cfg = @json_decode(file_get_contents($configPath), true);
    if (!empty($cfg['dataPath'])) {
        $dataFolder = trim($cfg['dataPath']);
    }
}
define('DATA_DIR', ROOT . '/' . $dataFolder);

// Promociones: imágenes en IMG/CORTES/, videos en IMG/CORTES/VIDEO/
define('CORTES_DIR', ROOT . '/IMG/CORTES');
define('CORTES_VIDEO', CORTES_DIR . '/VIDEO');

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
