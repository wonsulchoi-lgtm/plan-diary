// 학생 기록 저장소: Upstash Redis (Vercel → Storage → Upstash for Redis 로 무료 연결)
// 연결하면 Vercel이 환경 변수 KV_REST_API_URL / KV_REST_API_TOKEN 을 자동으로 넣어 줍니다.
// (파일 이름이 _ 로 시작하면 Vercel이 주소로 열지 않습니다)
const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
export const KEY = 'plan-diary:students';
export const dbReady = () => Boolean(URL_ && TOKEN);

export async function redis(...cmd) {
  const r = await fetch(URL_, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmd),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new Error(j.error || `Redis ${r.status}`);
  return j.result;
}

export const readBody = req => (typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {}));
