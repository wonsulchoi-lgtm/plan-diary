// 학생 화면이 몇 초마다 보내는 진행 기록을 저장합니다 (관리자 페이지에서 봄).
import { redis, dbReady, KEY, readBody } from './_db.js';

const cut = (v, n) => String(v ?? '').slice(0, n);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  if (!dbReady()) return res.status(503).json({ error: '저장소 미연결' });
  let b;
  try { b = readBody(req); } catch { return res.status(400).json({ error: '잘못된 요청' }); }
  const id = String(b.id || '');
  if (!/^[a-z0-9]{8,24}$/.test(id)) return res.status(400).json({ error: '잘못된 id' });
  const p = b.progress || {};
  const rec = {
    id,
    nick: cut(b.nick, 30), job: cut(b.job, 60),
    oneline: cut(b.oneline, 300), sentence: cut(b.sentence, 600), final: cut(b.final, 300),
    progress: { n: Number(p.n) || 0, total: Number(p.total) || 0, chapters: Array.isArray(p.chapters) ? p.chapters.slice(0, 10).map(Boolean) : [], ch: Number(p.ch) || 0 },
    xp: Number(b.xp) || 0, mood0: cut(b.mood0, 4), mood1: cut(b.mood1, 4), aiUsed: Number(b.aiUsed) || 0,
    ws: cut(b.ws, 20000), report: cut(b.report, 30000),
    updated: new Date().toISOString(),
  };
  try {
    await redis('HSET', KEY, id, JSON.stringify(rec));
    return res.json({ ok: true, updated: rec.updated });
  } catch (e) {
    console.error('[plan-diary] save', e.message);
    return res.status(502).json({ error: '저장하지 못했어요' });
  }
}
