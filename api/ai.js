// Vercel 서버 함수: 브라우저 → 이 함수 → Claude API
// API 키는 Vercel 화면의 환경 변수 ANTHROPIC_API_KEY 에만 넣습니다 (코드·GitHub에는 절대 넣지 않음).
// 브라우저는 '작업 이름 + 학생이 쓴 글'만 보내고, 프롬프트는 prompts.json에 고정되어 있습니다.
import Anthropic from '@anthropic-ai/sdk';
import fs from 'node:fs';
import path from 'node:path';

const P = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'prompts.json'), 'utf8'));
const client = new Anthropic();  // ANTHROPIC_API_KEY 환경 변수를 읽음

/* 사용량 제한 (서버 인스턴스 메모리 기준의 간단한 보호. 진짜 상한은 Anthropic 콘솔의 Spend limit으로) */
const PER_HOUR = Number(process.env.AI_PER_NICK_PER_HOUR || 30);
const usage = new Map();
function limited(nick) {
  const key = new Date().toISOString().slice(0, 13) + '|' + nick;
  const n = (usage.get(key) || 0) + 1;
  usage.set(key, n);
  if (usage.size > 5000) usage.clear();
  return n > PER_HOUR;
}

/* {{이름}} → 학생 글 (길이 제한, 태그 흉내 막기) */
function fill(tpl, p) {
  return tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => {
    const v = String(p[k] ?? '').trim().slice(0, k === 'all' ? 9000 : 2500);
    return v === '' ? '[  ]' : v.replaceAll('</', '〈/').replaceAll('<', '〈');
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  if (!process.env.ANTHROPIC_API_KEY) return res.status(500).json({ error: '서버에 AI 키가 아직 설정되지 않았어요 (Vercel 환경 변수 ANTHROPIC_API_KEY)' });

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const task = String(body.task || '');
  const p = body.payload && typeof body.payload === 'object' ? body.payload : {};
  const nick = String(body.nick || 'guest').trim().slice(0, 20) || 'guest';
  const t = P.tasks[task];
  if (!t) return res.status(400).json({ error: '알 수 없는 작업' });
  if (JSON.stringify(p).length > 60000) return res.status(400).json({ error: '보낸 내용이 너무 커요' });
  if (limited(nick)) return res.status(429).json({ error: 'AI를 많이 불렀어요! 잠시 후 다시 해 보세요' });

  const mode = t.mode || 'json';
  let msg;
  try {
    msg = await client.beta.messages.create({
      model: process.env.CLAUDE_MODEL || 'claude-sonnet-5-5',
      max_tokens: t.max_tokens || 4000,
      system: P.base + (t.system || '') + (mode === 'json' ? P.json_rule : ''),
      output_config: { effort: t.effort || 'low' },
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',   // 안전 검사로 거절되면 서버가 알맞은 모델로 다시 시도
      messages: [{ role: 'user', content: fill(t.user, p) }],
    });
  } catch (e) {
    console.error('[plan-diary] Claude API', e?.status, e?.message);
    if (e instanceof Anthropic.AuthenticationError) return res.status(502).json({ error: 'AI 키가 올바르지 않아요 (Vercel 환경 변수 확인)' });
    if (e instanceof Anthropic.RateLimitError) return res.status(502).json({ error: 'AI가 바빠요. 10초 뒤 다시 눌러 주세요' });
    if (e instanceof Anthropic.APIError) return res.status(502).json({ error: `AI 오류(${e.status})가 났어요. 잠시 후 다시 해 보세요` });
    return res.status(502).json({ error: 'AI 서버에 연결하지 못했어요' });
  }

  if (msg.stop_reason === 'refusal') return res.status(422).json({ error: 'AI가 이 내용에는 답하기 어렵대요. 표현을 바꿔 보세요' });
  const text = msg.content.filter(b => b.type === 'text').map(b => b.text).join('');

  if (mode === 'text') return res.json({ result: { text: text.trim(), cut: msg.stop_reason === 'max_tokens' } });

  const s = text.indexOf('{'), e = text.lastIndexOf('}');
  try { return res.json({ result: JSON.parse(text.slice(s, e + 1)) }); }
  catch { return res.status(502).json({ error: 'AI 답을 해석하지 못했어요. 한 번 더 눌러 주세요' }); }
}
