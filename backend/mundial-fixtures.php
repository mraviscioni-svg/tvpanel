<?php
/**
 * Partidos Mundial 2026 — proxy público con caché.
 * Fuente: https://worldcup26.ir/get/games
 */
require_once __DIR__ . '/helpers.php';

header('Cache-Control: no-store, no-cache, must-revalidate');
header('Pragma: no-cache');

const MUNDIAL_API_URL = 'https://worldcup26.ir/get/games';
const MUNDIAL_CACHE_FILE = __DIR__ . '/cache/mundial-games.raw.json';
const MUNDIAL_CACHE_TTL = 600; // 10 min
const MUNDIAL_DISPLAY_TZ = 'America/Argentina/Buenos_Aires';
const MUNDIAL_FAVORITE = 'Argentina';

function mundialTeamMeta($nameEn) {
    static $map = [
        'Argentina' => ['code' => 'ARG', 'flag' => '🇦🇷'],
        'Algeria' => ['code' => 'ALG', 'flag' => '🇩🇿'],
        'Austria' => ['code' => 'AUT', 'flag' => '🇦🇹'],
        'Jordan' => ['code' => 'JOR', 'flag' => '🇯🇴'],
        'Brazil' => ['code' => 'BRA', 'flag' => '🇧🇷'],
        'Morocco' => ['code' => 'MAR', 'flag' => '🇲🇦'],
        'Mexico' => ['code' => 'MEX', 'flag' => '🇲🇽'],
        'South Africa' => ['code' => 'RSA', 'flag' => '🇿🇦'],
        'South Korea' => ['code' => 'KOR', 'flag' => '🇰🇷'],
        'Czech Republic' => ['code' => 'CZE', 'flag' => '🇨🇿'],
        'Canada' => ['code' => 'CAN', 'flag' => '🇨🇦'],
        'United States' => ['code' => 'USA', 'flag' => '🇺🇸'],
        'Paraguay' => ['code' => 'PAR', 'flag' => '🇵🇾'],
        'Spain' => ['code' => 'ESP', 'flag' => '🇪🇸'],
        'Uruguay' => ['code' => 'URU', 'flag' => '🇺🇾'],
        'France' => ['code' => 'FRA', 'flag' => '🇫🇷'],
        'Germany' => ['code' => 'GER', 'flag' => '🇩🇪'],
        'England' => ['code' => 'ENG', 'flag' => '🏴󠁧󠁢󠁥󠁮󠁧󠁿'],
        'Portugal' => ['code' => 'POR', 'flag' => '🇵🇹'],
        'Netherlands' => ['code' => 'NED', 'flag' => '🇳🇱'],
        'Italy' => ['code' => 'ITA', 'flag' => '🇮🇹'],
        'Japan' => ['code' => 'JPN', 'flag' => '🇯🇵'],
        'Colombia' => ['code' => 'COL', 'flag' => '🇨🇴'],
        'Ecuador' => ['code' => 'ECU', 'flag' => '🇪🇨'],
        'Chile' => ['code' => 'CHI', 'flag' => '🇨🇱'],
        'Peru' => ['code' => 'PER', 'flag' => '🇵🇪'],
        'Croatia' => ['code' => 'CRO', 'flag' => '🇭🇷'],
        'Belgium' => ['code' => 'BEL', 'flag' => '🇧🇪'],
        'Switzerland' => ['code' => 'SUI', 'flag' => '🇨🇭'],
        'Scotland' => ['code' => 'SCO', 'flag' => '🏴󠁧󠁢󠁳󠁣󠁴󠁿'],
        'Australia' => ['code' => 'AUS', 'flag' => '🇦🇺'],
        'Turkey' => ['code' => 'TUR', 'flag' => '🇹🇷'],
        'Haiti' => ['code' => 'HAI', 'flag' => '🇭🇹'],
        'Qatar' => ['code' => 'QAT', 'flag' => '🇶🇦'],
        'Saudi Arabia' => ['code' => 'KSA', 'flag' => '🇸🇦'],
        'Senegal' => ['code' => 'SEN', 'flag' => '🇸🇳'],
        'Ghana' => ['code' => 'GHA', 'flag' => '🇬🇭'],
        'Nigeria' => ['code' => 'NGA', 'flag' => '🇳🇬'],
        'Cameroon' => ['code' => 'CMR', 'flag' => '🇨🇲'],
        'Iran' => ['code' => 'IRN', 'flag' => '🇮🇷'],
        'Poland' => ['code' => 'POL', 'flag' => '🇵🇱'],
        'Serbia' => ['code' => 'SRB', 'flag' => '🇷🇸'],
        'Denmark' => ['code' => 'DEN', 'flag' => '🇩🇰'],
        'Sweden' => ['code' => 'SWE', 'flag' => '🇸🇪'],
        'Norway' => ['code' => 'NOR', 'flag' => '🇳🇴'],
        'Wales' => ['code' => 'WAL', 'flag' => '🏴󠁧󠁢󠁷󠁬󠁳󠁿'],
        'Ukraine' => ['code' => 'UKR', 'flag' => '🇺🇦'],
        'Costa Rica' => ['code' => 'CRC', 'flag' => '🇨🇷'],
        'Panama' => ['code' => 'PAN', 'flag' => '🇵🇦'],
        'Jamaica' => ['code' => 'JAM', 'flag' => '🇯🇲'],
        'New Zealand' => ['code' => 'NZL', 'flag' => '🇳🇿'],
    ];
    $key = trim((string)$nameEn);
    if (isset($map[$key])) {
        return $map[$key];
    }
    $parts = preg_split('/\s+/', $key);
    $code = strtoupper(substr($parts[0] ?? 'TBD', 0, 3));
    return ['code' => $code, 'flag' => '⚽'];
}

function mundialFetchGamesRaw() {
    $cacheDir = dirname(MUNDIAL_CACHE_FILE);
    if (!is_dir($cacheDir)) {
        mkdir($cacheDir, 0755, true);
    }

    if (is_file(MUNDIAL_CACHE_FILE) && (time() - filemtime(MUNDIAL_CACHE_FILE)) < MUNDIAL_CACHE_TTL) {
        $cached = file_get_contents(MUNDIAL_CACHE_FILE);
        if ($cached !== false && trim($cached) !== '') {
            $decoded = json_decode($cached, true);
            if (is_array($decoded) && !empty($decoded['games'])) {
                return $decoded;
            }
        }
    }

    $ctx = stream_context_create([
        'http' => [
            'timeout' => 12,
            'header' => "Accept: application/json\r\nUser-Agent: TVPANEL-Mundial/1.0\r\n",
        ],
        'ssl' => [
            'verify_peer' => true,
            'verify_peer_name' => true,
        ],
    ]);

    $raw = @file_get_contents(MUNDIAL_API_URL, false, $ctx);
    if ($raw === false || trim($raw) === '') {
        if (is_file(MUNDIAL_CACHE_FILE)) {
            $fallback = json_decode(file_get_contents(MUNDIAL_CACHE_FILE), true);
            if (is_array($fallback)) return $fallback;
        }
        return null;
    }

    $decoded = json_decode($raw, true);
    if (!is_array($decoded) || empty($decoded['games'])) {
        return null;
    }

    file_put_contents(MUNDIAL_CACHE_FILE, $raw);
    return $decoded;
}

function mundialVenueTimezone($stadiumId) {
    static $map = [
        '1' => 'America/Mexico_City',   // Estadio Azteca
        '2' => 'America/Mexico_City',   // Estadio Akron
        '3' => 'America/Monterrey',     // Estadio BBVA
        '4' => 'America/Chicago',       // AT&T Stadium (Dallas)
        '5' => 'America/Chicago',       // NRG Stadium (Houston)
        '6' => 'America/Chicago',       // Arrowhead (Kansas City)
        '7' => 'America/New_York',      // Mercedes-Benz (Atlanta)
        '8' => 'America/New_York',      // Hard Rock (Miami)
        '9' => 'America/New_York',      // Gillette (Boston)
        '10' => 'America/New_York',     // Lincoln Financial (Philadelphia)
        '11' => 'America/New_York',     // MetLife (NY/NJ)
        '12' => 'America/Toronto',      // Toronto
        '13' => 'America/Vancouver',    // Vancouver
        '14' => 'America/Los_Angeles',  // Seattle
        '15' => 'America/Los_Angeles',  // Levi's (SF Bay)
        '16' => 'America/Los_Angeles',  // SoFi (Los Angeles)
    ];
    $id = trim((string)$stadiumId);
    return $map[$id] ?? 'America/New_York';
}

function mundialParseKickoff($localDate, $stadiumId = '') {
    $tzVenue = new DateTimeZone(mundialVenueTimezone($stadiumId));
    $dt = DateTimeImmutable::createFromFormat('m/d/Y H:i', trim((string)$localDate), $tzVenue);
    if (!$dt) return null;
    return $dt->setTimezone(new DateTimeZone(MUNDIAL_DISPLAY_TZ));
}

function mundialIsFinished($game) {
    return strtoupper(trim((string)($game['finished'] ?? ''))) === 'TRUE';
}

function mundialIsLive($game) {
    if (mundialIsFinished($game)) return false;
    $elapsed = strtolower(trim((string)($game['time_elapsed'] ?? 'notstarted')));
    return $elapsed !== 'notstarted' && $elapsed !== 'finished' && $elapsed !== '';
}

function mundialNormalizeGame($game, DateTimeImmutable $kickoffArt) {
    $homeName = trim((string)($game['home_team_name_en'] ?? ''));
    $awayName = trim((string)($game['away_team_name_en'] ?? ''));
    $home = mundialTeamMeta($homeName);
    $away = mundialTeamMeta($awayName);
    $finished = mundialIsFinished($game);
    $live = mundialIsLive($game);
    $homeScore = (int)($game['home_score'] ?? 0);
    $awayScore = (int)($game['away_score'] ?? 0);
    if ($homeScore > 20 || $awayScore > 20) {
        $homeScore = 0;
        $awayScore = 0;
    }

    $teamsLabel = $home['flag'] . ' ' . $home['code'] . ' vs ' . $away['flag'] . ' ' . $away['code'];
    if ($finished || $live) {
        $teamsLabel = $home['flag'] . ' ' . $home['code'] . ' ' . $homeScore . ' – ' . $awayScore . ' ' . $away['flag'] . ' ' . $away['code'];
    }

    return [
        'id' => (string)($game['id'] ?? ''),
        'group' => trim((string)($game['group'] ?? '')),
        'home' => array_merge(['name' => $homeName], $home),
        'away' => array_merge(['name' => $awayName], $away),
        'kickoffIso' => $kickoffArt->format(DateTimeInterface::ATOM),
        'timeLabel' => $kickoffArt->format('H:i'),
        'dateLabel' => $kickoffArt->format('d M'),
        'teamsLabel' => $teamsLabel,
        'groupLabel' => $game['group'] ? ('Grupo ' . $game['group']) : '',
        'finished' => $finished,
        'live' => $live,
        'homeScore' => $homeScore,
        'awayScore' => $awayScore,
    ];
}

function mundialBuildPayload($raw) {
    $tzArt = new DateTimeZone(MUNDIAL_DISPLAY_TZ);
    $now = new DateTimeImmutable('now', $tzArt);
    $todayKey = $now->format('Y-m-d');

    $months = [
        1 => 'Ene', 2 => 'Feb', 3 => 'Mar', 4 => 'Abr', 5 => 'May', 6 => 'Jun',
        7 => 'Jul', 8 => 'Ago', 9 => 'Sep', 10 => 'Oct', 11 => 'Nov', 12 => 'Dic',
    ];
    $todayLabelShort = (int)$now->format('d') . ' ' . ($months[(int)$now->format('n')] ?? $now->format('M'));

    $normalized = [];
    foreach ($raw['games'] as $game) {
        $kickoff = mundialParseKickoff($game['local_date'] ?? '', $game['stadium_id'] ?? '');
        if (!$kickoff) continue;
        $normalized[] = mundialNormalizeGame($game, $kickoff);
    }

    usort($normalized, function ($a, $b) {
        return strcmp($a['kickoffIso'], $b['kickoffIso']);
    });

    $todayFixtures = [];
    foreach ($normalized as $g) {
        $kickoff = new DateTimeImmutable($g['kickoffIso']);
        if ($kickoff->format('Y-m-d') === $todayKey) {
            $todayFixtures[] = $g;
        }
    }

    $ticker = $todayFixtures;
    $tickerMode = 'today';
    if (empty($ticker)) {
        $tickerMode = 'upcoming';
        foreach ($normalized as $g) {
            $kickoff = new DateTimeImmutable($g['kickoffIso']);
            if ($kickoff >= $now && !($g['finished'] ?? false)) {
                $ticker[] = $g;
            }
            if (count($ticker) >= 10) break;
        }
    }

    $nextArgentina = null;
    foreach ($normalized as $g) {
        $isArg = ($g['home']['name'] === MUNDIAL_FAVORITE || $g['away']['name'] === MUNDIAL_FAVORITE);
        if (!$isArg || ($g['finished'] ?? false)) continue;
        $kickoff = new DateTimeImmutable($g['kickoffIso']);
        if ($kickoff >= $now || ($g['live'] ?? false)) {
            $nextArgentina = $g;
            break;
        }
    }
    if (!$nextArgentina) {
        foreach ($normalized as $g) {
            $isArg = ($g['home']['name'] === MUNDIAL_FAVORITE || $g['away']['name'] === MUNDIAL_FAVORITE);
            if ($isArg && !($g['finished'] ?? false)) {
                $nextArgentina = $g;
                break;
            }
        }
    }

    return [
        'ok' => true,
        'source' => 'worldcup26.ir',
        'updated' => updatedTimestamp(),
        'todayLabelShort' => $todayLabelShort,
        'tickerMode' => $tickerMode,
        'ticker' => $ticker,
        'nextArgentina' => $nextArgentina,
    ];
}

$raw = mundialFetchGamesRaw();
if (!$raw) {
    jsonResponse([
        'ok' => false,
        'error' => 'No se pudieron obtener los partidos',
        'todayLabelShort' => '',
        'tickerMode' => 'empty',
        'ticker' => [],
        'nextArgentina' => null,
    ], 502);
}

jsonResponse(mundialBuildPayload($raw));
