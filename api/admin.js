// 관리자(강사)용: 학생 기록 목록 보기 · 지우기
// 비밀번호는 Vercel 환경 변수 ADMIN_PASSWORD 에만 넣습니다.
import crypto from 'node:crypto';
import { redis, dbReady, KEY, readBody } from './_db.js';

function okPassword(given) {
  const real = process.env.ADMIN_PASSWORD || '';
  if (!real) return false;
  const a = crypto.createHash('sha256').update(String(given || '')).digest();
  const b = crypto.createHash('sha256').update(real).digest();
  return crypto.timingSafeEqual(a, b);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  if (!process.env.ADMIN_PASSWORD) return res.status(500).json({ error: 'Vercel 환경 변수 ADMIN_PASSWORD가 아직 없어요' });
  let b;
  try { b = readBody(req); } catch { return res.status(400).json({ error: '잘못된 요청' }); }
  if (!okPassword(b.password)) { await new Promise(r => setTimeout(r, 800)); return res.status(401).json({ error: '비밀번호가 틀렸어요' }); }
  if (!dbReady()) return res.status(503).json({ error: '저장소(Upstash Redis)가 아직 연결되지 않았어요' });

  try {
    if (b.action === 'delete') {
      await redis('HDEL', KEY, String(b.id || ''));
      return res.json({ ok: true });
    }
    if (b.action === 'deleteAll') {
      await redis('DEL', KEY);
      return res.json({ ok: true });
    }
    const flat = (await redis('HGETALL', KEY)) || [];
    const list = [];
    for (let i = 1; i < flat.length; i += 2) { try { list.push(JSON.parse(flat[i])); } catch {} }
    list.sort((x, y) => String(y.updated).localeCompare(String(x.updated)));
    return res.json({ students: list });
  } catch (e) {
    console.error('[plan-diary] admin', e.message);
    return res.status(502).json({ error: '저장소를 읽지 못했어요' });
  }
}
