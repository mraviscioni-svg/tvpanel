<?php
/**
 * Config pública mínima para frontend (sin login).
 * Devuelve theme por defecto y lista disponible.
 */
require_once __DIR__ . '/helpers.php';

$configPath = __DIR__ . '/config.json';
$themesDir = dirname(__DIR__) . '/CSS/themes';

function listPublicThemes($themesDir) {
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

$cfg = readJson($configPath);
$themes = listPublicThemes($themesDir);
$defaultTheme = isset($cfg['defaultTheme']) ? strtolower(trim($cfg['defaultTheme'])) : 'default';
if ($defaultTheme === '' || !in_array($defaultTheme, $themes, true)) $defaultTheme = 'default';

jsonResponse([
    'defaultTheme' => $defaultTheme,
    'availableThemes' => $themes,
]);

