<?php
/**
 * API de configuración de rutas de upload (solo Admin).
 * GET: devuelve mediaImagesPath y mediaVideosPath.
 * POST: actualiza y guarda en config.json.
 */

require_once __DIR__ . '/helpers.php';

$configPath = __DIR__ . '/config.json';
$themesDir = dirname(__DIR__) . '/CSS/themes';

function listAvailableThemes($themesDir) {
    $out = ['default'];
    if (is_dir($themesDir)) {
        foreach (glob($themesDir . '/*.css') as $file) {
            $name = basename($file, '.css');
            if (preg_match('/^[a-z0-9._-]+$/i', $name)) {
                $out[] = strtolower($name);
            }
        }
    }
    $out = array_values(array_unique($out));
    sort($out, SORT_NATURAL | SORT_FLAG_CASE);
    if (!in_array('default', $out, true)) array_unshift($out, 'default');
    return $out;
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    requireLogin();
    $cfg = readJson($configPath);
    $out = [
        'mediaImagesPath' => isset($cfg['mediaImagesPath']) ? trim($cfg['mediaImagesPath']) : 'IMG/CORTES',
        'mediaVideosPath' => isset($cfg['mediaVideosPath']) ? trim($cfg['mediaVideosPath']) : 'IMG/CORTES/VIDEO',
        'defaultTheme' => isset($cfg['defaultTheme']) ? trim($cfg['defaultTheme']) : 'default',
        'availableThemes' => listAvailableThemes($themesDir),
        'publicBaseUrl' => getSitePublicBaseUrl(),
    ];
    if ($out['mediaImagesPath'] === '') $out['mediaImagesPath'] = 'IMG/CORTES';
    if ($out['mediaVideosPath'] === '') $out['mediaVideosPath'] = 'IMG/CORTES/VIDEO';
    if ($out['defaultTheme'] === '') $out['defaultTheme'] = 'default';
    if (!in_array($out['defaultTheme'], $out['availableThemes'], true)) $out['defaultTheme'] = 'default';
    jsonResponse($out);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonError('Método no permitido', 405);
}

requireAdmin();
$input = getInput();
$imagesPath = isset($input['mediaImagesPath']) ? trim($input['mediaImagesPath']) : '';
$videosPath = isset($input['mediaVideosPath']) ? trim($input['mediaVideosPath']) : '';
$defaultTheme = isset($input['defaultTheme']) ? strtolower(trim($input['defaultTheme'])) : 'default';
if ($imagesPath === '') $imagesPath = 'IMG/CORTES';
if ($videosPath === '') $videosPath = 'IMG/CORTES/VIDEO';
if ($defaultTheme === '') $defaultTheme = 'default';

// Evitar rutas que salgan del proyecto
if (strpos($imagesPath, '..') !== false || strpos($videosPath, '..') !== false) {
    jsonError('Rutas no permitidas', 400);
}
$availableThemes = listAvailableThemes($themesDir);
if (!in_array($defaultTheme, $availableThemes, true)) {
    jsonError('Theme no válido', 400);
}

$cfg = readJson($configPath);
if (empty($cfg)) {
    $cfg = ['dataPath' => 'JSON'];
}
$cfg['mediaImagesPath'] = $imagesPath;
$cfg['mediaVideosPath'] = $videosPath;
$cfg['defaultTheme'] = $defaultTheme;

if (!writeJson($configPath, $cfg)) {
    jsonError('No se pudo guardar la configuración', 500);
}

jsonResponse(['ok' => true]);
