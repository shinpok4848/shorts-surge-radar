# CHANNEL PULSE

채널 URL의 공개 데이터, 소유자 YouTube Analytics, YouTube Studio CSV를 결합해 **영상과 쇼츠 후보를 분리 진단하고 다음 성장 행동을 제안하는 대시보드**입니다.

**배포 사이트:** https://shinpok4848.github.io/shorts-surge-radar/

## 제공 기능

- 채널 URL 빠른 진단: 공개 업로드, 조회 속도, 반응률, 제목·설명·태그 구조 분석
- Google 내 채널 연결: 최근 365일 시청 시간, 평균 시청 지속 시간/조회율, 구독 전환, 유입 경로 분석
- Studio CSV 가져오기: 노출수, CTR, 유지율 등 CSV 열을 브라우저에서만 처리하고 기존 데이터와 병합
- 영상/쇼츠 후보 분리: 포맷별 중앙값으로 공정하게 비교
- 채널 건강점수: 확산력, 클릭 포장, 시청 유지, 반응, 구독 전환, 업로드 일관성
- 영상 닥터: 문제 근거, 제목 3안, 썸네일 문구, 첫 훅, 영상 구성, 보조 태그 제공
- 연관 인기 영상 비교와 7일 실행 계획
- 기존 급상승 기능을 보조 **시장 레이더**로 유지
- 모든 지표에 `측정/공개/추정/없음` 근거 표시

## 현재 배포 상태

| 기능 | 코드 | 현재 공개 사이트 |
|---|---|---|
| 데모 전체 진단 | 완료 | 사용 가능 |
| Studio CSV 로컬 진단 | 완료 | 사용 가능 |
| 채널 URL 공개 진단 | 완료 | Worker URL/API 키 설정 전 |
| Google OAuth 정밀 진단 | 완료 | OAuth Client ID 설정 전 |
| 시장 레이더 실데이터 | 완료 | Worker 설정 전에는 명시적 데모 |

GitHub Pages는 정적 호스팅이므로 운영용 YouTube API 키를 안전하게 보관할 수 없습니다. 공개 URL 진단은 `worker/`의 서버리스 API를 배포해야 하며, Google 연결은 운영자의 공개 OAuth Client ID를 설정해야 합니다.

## 로컬 실행

[Bun](https://bun.sh/)과 TypeScript가 준비된 환경에서:

```bash
bun run typecheck
bun run build
```

`docs/`가 GitHub Pages 배포 결과입니다. 로컬 확인:

```bash
python3 -m http.server 4173 -d docs
```

Worker 번들 확인:

```bash
bun run build:worker
```

## 런타임 설정

`public/app-config.json`:

```json
{
  "publicApiBaseUrl": "https://channel-pulse-api.<account>.workers.dev",
  "googleOAuthClientId": "<web-client-id>.apps.googleusercontent.com"
}
```

설정 후 `bun run build`를 다시 실행하면 값이 `docs/index.html`에 삽입됩니다. OAuth Client ID는 공개 식별자이며 비밀키가 아닙니다. **YouTube API 키나 OAuth Client Secret은 이 파일에 넣지 마세요.**

## 공개 채널 API 배포

참조 구현은 Cloudflare Workers용이며 외부 런타임 라이브러리가 없습니다.

1. Google Cloud 프로젝트에서 **YouTube Data API v3**를 활성화합니다.
2. API 키를 생성하고 API 제한을 YouTube Data API v3로 한정합니다.
3. Cloudflare Wrangler 인증 후 다음을 실행합니다.

```bash
cd worker
wrangler secret put YOUTUBE_API_KEY
wrangler deploy
```

4. 출력된 URL을 `public/app-config.json`의 `publicApiBaseUrl`에 넣습니다.
5. 빌드 후 `docs/`를 배포합니다.

Worker는 채널 URL 해석, 업로드 재생목록 페이지네이션, 영상 상세 배치 조회, CORS 허용 목록, 15분 공개 캐시와 오류 비식별화를 처리합니다. 자세한 내용은 [`worker/README.md`](worker/README.md)를 확인하세요.

## Google 내 채널 연결 설정

1. 같은 Google Cloud 프로젝트에서 **YouTube Analytics API**도 활성화합니다.
2. OAuth 동의 화면을 구성합니다.
3. 웹 애플리케이션 OAuth Client ID를 생성합니다.
4. 승인된 JavaScript 원본에 다음을 추가합니다.
   - `https://shinpok4848.github.io`
   - 로컬 개발 시 `http://localhost:4173`
5. Client ID를 `public/app-config.json`에 입력하고 다시 빌드합니다.

앱은 다음 읽기 전용 범위를 요청합니다.

- `https://www.googleapis.com/auth/youtube.readonly`
- `https://www.googleapis.com/auth/yt-analytics.readonly`

토큰은 브라우저 메모리에만 보관되며 새로고침 또는 연결 해제 시 사라집니다. Client Secret과 갱신 토큰은 사용하지 않습니다.

## Studio CSV 사용법

YouTube Studio → Analytics → 고급 모드에서 영상 단위 표를 CSV로 내보냅니다. 가능하면 아래 열을 포함하세요.

- 동영상 ID 및 제목
- 콘텐츠 유형, 게시일, 길이
- 조회수, 노출수, 노출 클릭률
- 시청 시간, 평균 시청 지속 시간, 평균 조회율
- 구독자 증가/감소, 좋아요, 댓글, 공유

한국어와 영어 열 이름을 모두 인식하며 여러 CSV를 동시에 병합할 수 있습니다. ZIP 다운로드는 먼저 압축을 풀어 CSV만 선택하세요. 샘플은 `public/sample-studio.csv`에 있습니다. 파일은 서버로 전송되지 않습니다.

## 데이터 해석 원칙

- 공개 데이터에는 실제 노출수, CTR, 유지율, 유입 경로가 없습니다. 이를 추정값으로 가장하지 않습니다.
- YouTube Data API에는 신뢰할 수 있는 `isShort` 또는 화면비 필드가 없습니다. CSV의 콘텐츠 유형 증거가 없으면 180초 이하 영상을 **쇼츠 후보**로 표시합니다.
- Analytics 데이터는 처리 지연을 고려해 최근 약 2~3일을 제외한 365일 구간을 사용합니다.
- 태그는 오탈자와 주제 보조용으로만 제안하며 제목·썸네일·도입부보다 우선하지 않습니다.
- 연관 인기 영상은 복제 대상이 아니라 주제, 약속, 길이, 증거 구조를 비교하는 벤치마크입니다.

공식 참고 문서:

- [YouTube Data API](https://developers.google.com/youtube/v3)
- [채널 업로드 재생목록 구현](https://developers.google.com/youtube/v3/guides/implementation/channels)
- [JavaScript 웹 앱 OAuth](https://developers.google.com/youtube/v3/guides/auth/client-side-web-apps)
- [YouTube Analytics Channel Reports](https://developers.google.com/youtube/analytics/channel_reports)
- [YouTube Analytics Metrics](https://developers.google.com/youtube/analytics/metrics)
- [YouTube 태그 안내](https://support.google.com/youtube/answer/146402)

## 프로젝트 구조

```text
src/
  analytics/       채널·영상 진단 및 시장 순위
  api/             공개 Worker, Google OAuth, Data/Analytics API 클라이언트
  data/            명시적 데모 데이터
  import/          로컬 Studio CSV 파서
  ui/              대시보드 렌더링과 상호작용
worker/             공개 채널 진단용 Cloudflare Worker
public/             런타임 설정, 샘플 CSV, 자체 호스팅 폰트
docs/               GitHub Pages 프로덕션 결과
```

상세 설계와 신뢰 경계는 [`ARCHITECTURE.md`](ARCHITECTURE.md), 운영 절차는 [`OPERATIONS.md`](OPERATIONS.md)를 참고하세요.

## 창작과 권리

이 도구는 원본 영상을 내려받아 미세 변경 후 재업로드하기 위한 도구가 아닙니다. 벤치마크에서 발견한 원리를 바탕으로 직접 쓴 대본, 직접 촬영한 화면, 독자적인 사례와 해설을 사용하고 원저작자의 권리와 YouTube 정책을 준수하세요.
