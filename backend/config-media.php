<?php
/**
 * API de configuración de rutas de upload (solo Admin).
 * GET: devuelve mediaImagesPath y mediaVideosPath.
 * POST: actualiza y guarda en config.json.
 */

require_once __DIR__ . '/helpers.php';

$user = requireAdmin();

$configPath = __DIR__ . '/config.json';

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $cfg = readJson($configPath);
    $out = [
        'mediaImagesPath' => isset($cfg['mediaImagesPath']) ? trim($cfg['mediaImagesPath']) : 'IMG/CORTES',
        'mediaVideosPath' => isset($cfg['mediaVideosPath']) ? trim($cfg['mediaVideosPath']) : 'IMG/CORTES/VIDEO'
    ];
    if ($out['mediaImagesPath'] === '') $out['mediaImagesPath'] = 'IMG/CORTES';
    if ($out['mediaVideosPath'] === '') $out['mediaVideosPath'] = 'IMG/CORTES/VIDEO';
    jsonResponse($out);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonError('Método no permitido', 405);
}

$input = getInput();
$imagesPath = isset($input['mediaImagesPath']) ? trim($input['mediaImagesPath']) : '';
$videosPath = isset($input['mediaVideosPath']) ? trim($input['mediaVideosPath']) : '';
if ($imagesPath === '') $imagesPath = 'IMG/CORTES';
if ($videosPath === '') $videosPath = 'IMG/CORTES/VIDEO';

// Evitar rutas que salgan del proyecto
if (strpos($imagesPath, '..') !== false || strpos($videosPath, '..') !== false) {
    jsonError('Rutas no permitidas', 400);
}

$cfg = readJson($configPath);
if (empty($cfg)) {
    $cfg = ['dataPath' => 'JSON'];
}
$cfg['mediaImagesPath'] = $imagesPath;
$cfg['mediaVideosPath'] = $videosPath;

if (!writeJson($configPath, $cfg)) {
    jsonError('No se pudo guardar la configuración', 500);
}

jsonResponse(['ok' => true]);
