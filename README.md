# ROMANCE PULSE

`@낭만구조대` 채널 소유자만 사용하는 개인 YouTube 성장 진단 대시보드입니다.

**사이트:** https://shinpok4848.github.io/shorts-surge-radar/

## 보안 원칙

이 앱은 Google 계정 ID나 비밀번호를 받지 않습니다. 비밀번호, OAuth Client Secret, API 키를 저장소나 채팅에 전달하지 마세요.

개인 전용 접근은 두 단계로 제한합니다.

1. Google OAuth 동의 화면을 **Testing**으로 유지하고 본인의 Google 계정만 Test user로 등록
2. 인증된 계정의 YouTube 채널이 `@낭만구조대`인지 앱에서 재검증

채널이 다르면 액세스 토큰을 즉시 폐기하고 데이터를 표시하지 않습니다. OAuth 토큰은 브라우저 메모리에만 있으며 새로고침하거나 로그아웃하면 사라집니다. GitHub Pages 주소와 소스 코드는 공개되어 있지만, 인증 전에는 채널 데이터가 저장되거나 노출되지 않습니다.

## 기능

- 낭만구조대 모든 공개 업로드 자동 수집
- 일반 영상과 180초 이하 쇼츠 후보 분리
- 최근 365일 YouTube Analytics 결합
- 조회·시청 시간·평균 조회율·반응·순구독·유입 경로 진단
- 포맷별 중앙값과 영상별 건강점수
- 문제 원인과 근거, 우선순위 제시
- 제목 3안, 썸네일 문구, 첫 훅, 영상 구성 가이드
- 연관 인기 영상 OAuth 검색
- 인증된 시장 레이더
- 7일 실행 계획
- 선택적으로 YouTube Studio CSV를 로컬에서 병합해 노출·CTR 보강

데모 데이터, 채널 URL 공개 조회, 사용자 API 키 입력, 공개 Worker는 모두 제거했습니다.

## 최초 Google 설정

### 1. Google Cloud 프로젝트

1. [Google Cloud Console](https://console.cloud.google.com/)에서 본인 프로젝트를 생성합니다.
2. **YouTube Data API v3**를 활성화합니다.
3. **YouTube Analytics API**를 활성화합니다.

별도 YouTube API 키는 만들 필요가 없습니다. 로그인 후 받은 OAuth 액세스 토큰으로 두 API를 직접 호출합니다.

### 2. OAuth 동의 화면

1. Google Auth Platform에서 앱 정보를 입력합니다.
2. Audience를 **External**로 선택합니다.
3. Publishing status는 **Testing**으로 유지합니다.
4. Test users에 낭만구조대 채널을 소유한 본인의 Google 이메일만 추가합니다.
5. 다음 읽기 전용 범위를 추가합니다.
   - `https://www.googleapis.com/auth/youtube.readonly`
   - `https://www.googleapis.com/auth/yt-analytics.readonly`

### 3. Web OAuth Client ID

1. OAuth Client → **Web application**을 생성합니다.
2. Authorized JavaScript origins에 다음을 추가합니다.
   - `https://shinpok4848.github.io`
   - 로컬 확인이 필요하면 `http://localhost:4173`
3. Redirect URI는 이 토큰 방식에서 사용하지 않습니다.
4. 생성된 `...apps.googleusercontent.com` 형식의 **Client ID만** 사용합니다.

OAuth Client ID는 공개 식별자이므로 저장소에 들어가도 됩니다. Client Secret은 절대 사용하거나 공유하지 않습니다.

### 4. 앱 설정

`public/app-config.json`:

```json
{
  "googleOAuthClientId": "여기에-client-id.apps.googleusercontent.com",
  "targetChannelHandle": "@낭만구조대",
  "targetChannelId": ""
}
```

`targetChannelId`는 실제 `UC...` 채널 ID를 알게 된 뒤 입력하면 핸들보다 강한 정확한 ID 검증을 사용합니다. 비워 두면 현재 설정된 핸들을 검증합니다.

설정 후:

```bash
bun run typecheck
bun run build
```

생성된 `docs/`를 기본 브랜치에 반영하면 GitHub Pages가 재배포됩니다.

## 사용법

1. 사이트에서 **낭만구조대 채널로 로그인**을 누릅니다.
2. 낭만구조대 채널을 소유한 Google/브랜드 계정을 선택합니다.
3. 읽기 전용 권한을 승인합니다.
4. 채널 일치 검증 후 진단 화면이 열립니다.
5. 필요한 영상에서 연관 인기 영상을 검색하거나 시장 레이더를 실행합니다.
6. 노출수·CTR까지 보려면 로그인 후 YouTube Studio CSV를 추가합니다.

## Studio CSV

YouTube Studio → Analytics → 고급 모드의 영상별 표에서 다음 열을 포함해 CSV로 내보내는 것을 권장합니다.

- 동영상 ID, 제목, 게시일, 콘텐츠 유형, 길이
- 조회수, 노출수, 노출 클릭률
- 시청 시간, 평균 시청 지속 시간, 평균 조회율
- 구독자 증가/감소, 좋아요, 댓글, 공유

CSV는 브라우저에서만 파싱되며 서버로 전송되지 않습니다. 기존 OAuth 영상 데이터와 ID 또는 제목으로 병합됩니다.

## 데이터 한계

- YouTube Data API에는 신뢰할 수 있는 `isShort`나 화면비 필드가 없습니다. Studio CSV의 콘텐츠 유형이 없으면 180초 이하 영상을 **쇼츠 후보**로 표시합니다.
- Analytics는 처리 지연을 고려해 최근 약 2~3일을 제외한 365일 구간을 사용합니다.
- 노출수와 CTR은 일반 Analytics 쿼리에서 제한될 수 있어 Studio CSV로 보강합니다.
- 시장 레이더와 연관영상 검색은 Google Cloud 프로젝트의 YouTube API 할당량을 사용합니다.
- 태그는 오탈자·주제 보조 용도로만 취급하며 제목·썸네일·도입부보다 우선하지 않습니다.

## 로컬 빌드

[Bun](https://bun.sh/)과 TypeScript가 준비된 환경에서:

```bash
bun run typecheck
bun run build
python3 -m http.server 4173 -d docs
```

## 구조

```text
src/
  analytics/   채널·영상 진단과 시장 순위
  api/         Google OAuth, YouTube Data/Analytics API
  import/      로컬 Studio CSV 파서
  ui/          개인 로그인 게이트와 진단 화면
public/
  app-config.json
  fonts/
docs/          GitHub Pages 결과
```

상세 보안 구조는 [`ARCHITECTURE.md`](ARCHITECTURE.md), 설정·장애 대응은 [`OPERATIONS.md`](OPERATIONS.md)를 확인하세요.

## 공식 문서

- [YouTube Data API](https://developers.google.com/youtube/v3)
- [JavaScript 웹 앱 OAuth](https://developers.google.com/youtube/v3/guides/auth/client-side-web-apps)
- [YouTube Analytics Channel Reports](https://developers.google.com/youtube/analytics/channel_reports)
- [YouTube Analytics Metrics](https://developers.google.com/youtube/analytics/metrics)

## 창작과 권리

연관 인기 영상은 복제 대상이 아니라 구조와 성과를 비교하는 자료입니다. 직접 쓴 대본, 직접 촬영한 장면, 독자적인 사례와 해설을 사용하고 원저작자의 권리와 YouTube 정책을 준수하세요.
