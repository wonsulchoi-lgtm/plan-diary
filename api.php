<?php
// 기획 다이어리 AI 프록시: 브라우저 → 이 파일 → Claude API
// API 키는 서버(config.php)에만 있고, 프롬프트는 prompts.json에 고정되어 있습니다.
// 브라우저는 '작업 이름 + 학생이 쓴 글'만 보냅니다.
declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8');
set_time_limit(200);

function out(array $a, int $code = 200): never {
    http_response_code($code);
    echo json_encode($a, JSON_UNESCAPED_UNICODE);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') out(['error' => 'POST only'], 405);

// config.php: 이 폴더에 없으면 3일차 앱(../quest/config.php)의 것을 같이 씁니다.
$cfg = null;
foreach ([__DIR__ . '/config.php', __DIR__ . '/../quest/config.php'] as $f) {
    if (is_file($f)) { $cfg = include $f; break; }
}
if (!is_array($cfg) || str_contains($cfg['anthropic_api_key'] ?? '', '여기에')) {
    out(['error' => '서버에 AI 키가 아직 설정되지 않았어요 (config.php)'], 500);
}

$P = json_decode((string)@file_get_contents(__DIR__ . '/prompts.json'), true);
if (!is_array($P)) out(['error' => 'prompts.json을 읽지 못했어요'], 500);

$rawIn = file_get_contents('php://input') ?: '';
if (strlen($rawIn) > 60000) out(['error' => '보낸 내용이 너무 커요'], 400);
$in = json_decode($rawIn, true);
if (!is_array($in)) out(['error' => '잘못된 요청'], 400);
$task = (string)($in['task'] ?? '');
$p    = is_array($in['payload'] ?? null) ? $in['payload'] : [];
$nick = mb_substr(trim((string)($in['nick'] ?? '')), 0, 20) ?: 'guest';

$t = $P['tasks'][$task] ?? null;
if (!is_array($t)) out(['error' => '알 수 없는 작업'], 400);

/* ---------- 사용량 제한 (학생당 시간당, 하루 전체) ---------- */
function rateLimit(array $cfg, string $nick): void {
    $dir = __DIR__ . '/data';
    if (!is_dir($dir)) @mkdir($dir, 0755, true);
    $f = @fopen($dir . '/usage.json', 'c+');
    if (!$f) return;
    flock($f, LOCK_EX);
    $u = json_decode(stream_get_contents($f) ?: '', true) ?: [];
    $day = date('Y-m-d'); $hour = date('Y-m-d H');
    if (($u['day'] ?? '') !== $day) $u = ['day' => $day, 'total' => 0, 'nick' => []];
    foreach (array_keys($u['nick']) as $k) if (!str_starts_with((string)$k, $hour)) unset($u['nick'][$k]);
    $key = $hour . '|' . $nick;
    $n = $u['nick'][$key] ?? 0;
    if ($u['total'] >= ($cfg['ai_total_per_day'] ?? 3000)) { flock($f, LOCK_UN); out(['error' => '오늘 AI 사용량이 모두 찼어요. 강사님께 알려 주세요'], 429); }
    if ($n >= ($cfg['plan_per_nick_per_hour'] ?? 30)) { flock($f, LOCK_UN); out(['error' => 'AI를 많이 불렀어요! 잠시 후 다시 해 보세요'], 429); }
    $u['total']++; $u['nick'][$key] = $n + 1;
    ftruncate($f, 0); rewind($f); fwrite($f, json_encode($u));
    flock($f, LOCK_UN); fclose($f);
}

/* ---------- 프롬프트 채우기: {{이름}} → 학생 글 (길이 제한) ---------- */
$fill = function (string $tpl) use ($p): string {
    return preg_replace_callback('/\{\{(\w+)\}\}/', function ($m) use ($p) {
        $limit = $m[1] === 'all' ? 9000 : 2500;
        $v = mb_substr(trim((string)($p[$m[1]] ?? '')), 0, $limit);
        return $v === '' ? '[  ]' : str_replace(['</', '<'], ['〈/', '〈'], $v);  // 태그 흉내 막기
    }, $tpl);
};
$mode   = $t['mode'] ?? 'json';
$system = $P['base'] . ($t['system'] ?? '') . ($mode === 'json' ? $P['json_rule'] : '');
$user   = $fill((string)$t['user']);

rateLimit($cfg, $nick);

/* ---------- Claude API 호출 (raw HTTP: 공유 호스팅이라 SDK 설치 없이) ---------- */
$body = [
    'model'         => $cfg['model'] ?? 'claude-opus-5-5',
    'max_tokens'    => (int)($t['max_tokens'] ?? 4000),
    'system'        => $system,
    'output_config' => ['effort' => $t['effort'] ?? 'low'],
    'fallbacks'     => 'default',
    'messages'      => [['role' => 'user', 'content' => $user]],
];
$ch = curl_init('https://api.anthropic.com/v1/messages');
curl_setopt_array($ch, [
    CURLOPT_POST           => true,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT        => 180,
    CURLOPT_HTTPHEADER     => [
        'Content-Type: application/json',
        'x-api-key: ' . $cfg['anthropic_api_key'],
        'anthropic-version: 2026-10-21',
        'anthropic-beta: server-side-fallback-2026-07-01',
    ],
    CURLOPT_POSTFIELDS     => json_encode($body, JSON_UNESCAPED_UNICODE),
]);
$raw  = curl_exec($ch);
$http = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$err  = curl_error($ch);
curl_close($ch);

if ($raw === false) out(['error' => 'AI 서버에 연결하지 못했어요: ' . $err], 502);
$res = json_decode($raw, true);
if ($http !== 200) {
    error_log('[plandiary] Claude API ' . $http . ': ' . substr($raw, 0, 500));
    $msg = match (true) {
        $http === 429 => 'AI가 바빠요. 10초 뒤 다시 눌러 주세요',
        $http === 401 => 'AI 키가 올바르지 않아요 (config.php 확인)',
        default       => 'AI 오류(' . $http . ')가 났어요. 잠시 후 다시 해 보세요',
    };
    out(['error' => $msg], 502);
}
if (($res['stop_reason'] ?? '') === 'refusal') out(['error' => 'AI가 이 내용에는 답하기 어렵대요. 표현을 바꿔 보세요'], 422);

// text 블록만 모읍니다 (thinking 블록은 건너뜀)
$text = '';
foreach ($res['content'] ?? [] as $blk) if (($blk['type'] ?? '') === 'text') $text .= $blk['text'];

if ($mode === 'text') out(['result' => ['text' => trim($text), 'cut' => ($res['stop_reason'] ?? '') === 'max_tokens']]);

$s = strpos($text, '{'); $e = strrpos($text, '}');
$json = ($s !== false && $e !== false) ? json_decode(substr($text, $s, $e - $s + 1), true) : null;
if (!is_array($json)) out(['error' => 'AI 답을 해석하지 못했어요. 한 번 더 눌러 주세요'], 502);
out(['result' => $json]);
