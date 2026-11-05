# 나의 직무 기획 다이어리 ✏️

뉴딜 2기 디지털스킬 5일차 **직무 문제 기획 워크시트(D5-1·3)** 를 다이어리처럼 한 칸씩 채우는 웹앱입니다.
취업 준비생이 회사의 한 직무(품질·생산기술·설비보전·물류 등)를 맡았다고 생각하고 혼자 기획합니다.

| 장 | 내용 |
|---|---|
| 📓 직무 문제 | 이름 → 직무 문제 한 줄 → 문제정의 다섯 칸 → 문제정의 한 문장 (+AI 점검) |
| 🔍 원인 | 원인 후보 3개·근거·확인 질문, ⭐ 고르기 (+AI 원인 힌트) |
| 🎨 SCAMPER | 카드 7장을 **AI 없이 혼자** 쓰기 (힌트 주사위, 90초 번개 도전) |
| 🤖 AI와 함께 | SCAMPER 전문가 프롬프트로 아이디어 넓히기 → 표(10개 목표) → 3개로 압축 |
| 🏆 결정 | 해결안 비교(상·중·하) → 최종안 → KPI 2개 → 프로토타입 범위 |
| 📜 기획서 | AI가 한 장짜리 직무 개선 기획서 + 코멘트 + 30초 발표 멘트로 정리 |

## 파일

| 파일 | 하는 일 |
|---|---|
| `index.html` | 화면 전체 (학생 기록은 브라우저 localStorage에 저장) |
| `api/ai.js` | **Vercel용** 브라우저 → Claude API 중계 (키는 Vercel 환경 변수에만) |
| `package.json`, `vercel.json` | Vercel 설정 (Claude SDK 설치, 함수 시간 120초) |
| `api.php` | PHP 호스팅용 중계 (Vercel에서는 안 씀) |
| `prompts.json` | AI 프롬프트 모음 (화면과 서버가 같이 씀) |
| `config.sample.php` | 설정 예시 → `config.php`로 복사해 키 입력 (**GitHub에 올리지 않음**) |
| `data/.htaccess` | 사용량 기록 폴더를 웹에서 못 열게 막음 |

## 실행

- **Vercel** (추천): GitHub 저장소를 Vercel에 Import → Settings → Environment Variables에 `ANTHROPIC_API_KEY` 추가 → Redeploy.
  - 기본 모델은 `claude-sonnet-5-5`. 바꾸려면 환경 변수 `CLAUDE_MODEL`(예: `claude-opus-5-5`)을 추가합니다.

- **PHP 호스팅** (AI까지 모두 동작): 파일을 올리고 `config.php`에 Anthropic API 키를 넣습니다. 자세한 순서는 `업로드_방법.txt`.
- **GitHub Pages** (PHP가 없어 AI 호출은 안 됨): 화면과 입력은 모두 됩니다.
  - AI 버튼을 누르면 *프롬프트 복사* 버튼이 나와서, ChatGPT·Claude에 붙여 넣고 답을 다시 붙여 넣으면 이어집니다.
  - 주소 끝에 `?demo=1` 을 붙이면 예시 답이 나오는 연습 모드입니다.

## 주의

- `config.php`(API 키)는 `.gitignore`로 제외되어 있습니다. 키를 코드나 커밋에 넣지 마세요.
- 학생 기록에는 실명·실제 회사 기밀 데이터를 쓰지 않도록 안내합니다.
