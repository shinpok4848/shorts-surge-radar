# CHANNEL PULSE 운영 가이드

## 현재 운영 준비 상태

- GitHub Pages 프런트엔드: 배포 가능
- 데모 및 Studio CSV: 별도 자격 증명 없이 동작
- 공개 채널 진단 Worker: 코드 완료, Cloudflare 배포 및 `YOUTUBE_API_KEY` secret 필요
- Google 소유자 진단: 코드 완료, Google OAuth Web Client ID 필요

## 배포 체크리스트

### 1. Google Cloud

1. 프로젝트 생성
2. YouTube Data API v3 활성화
3. YouTube Analytics API 활성화
4. YouTube Data API로 제한한 API 키 생성
5. OAuth 동의 화면 구성
6. Web OAuth Client ID 생성
7. 승인된 JavaScript 원본 등록
   - `https://shinpok4848.github.io`
   - `http://localhost:4173`(로컬 개발용)

API 키는 Worker secret에만 저장합니다. OAuth Client ID는 공개 식별자이므로 프런트 설정에 둘 수 있지만 Client Secret은 절대 저장소에 넣지 않습니다.

### 2. Worker

```bash
cd worker
wrangler secret put YOUTUBE_API_KEY
wrangler deploy
```

배포 후 확인:

```text
GET https://<worker-url>/health
```

정상 응답 예시:

```json
{"ok":true,"configured":true}
```

허용 원본과 최대 수집 영상 수는 `worker/wrangler.toml`에서 관리합니다.

### 3. 프런트 설정

`public/app-config.json`에 Worker URL과 OAuth Client ID를 입력합니다.

```bash
bun run typecheck
bun run build
```

생성된 `docs/`를 커밋하면 GitHub Pages가 자동 재배포합니다.

## 데이터 흐름

| 기능 | 데이터 출처 | 자격 증명 | 캐시/보관 |
|---|---|---|---|
| 공개 채널 진단 | YouTube Data API | Worker API key secret | CDN 15분 |
| 연관 인기 영상 | YouTube Data API search | Worker API key secret | CDN 15분 |
| 시장 레이더 | YouTube Data API search | Worker API key secret | CDN 15분 |
| 내 채널 진단 | Data + Analytics API | 사용자 OAuth access token | 메모리만 사용 |
| Studio CSV | 사용자 로컬 파일 | 없음 | 브라우저 메모리만 사용 |

## API 할당량 관리

- 채널 업로드 수집은 저비용 `playlistItems.list`와 `videos.list` 배치를 사용합니다.
- 비용이 큰 검색 호출은 연관영상 버튼을 눌렀을 때와 시장 스캔 시에만 실행합니다.
- 공개 응답은 15분 캐시해 같은 요청의 반복 비용을 줄입니다.
- `MAX_UPLOADS` 기본값은 1,000, 최대값은 2,000입니다.
- Google Cloud에서 일일 할당량과 오류율 알림을 설정하세요.

## 진단 점수 해석

- **확산력:** 같은 포맷 내 활성일 기준 조회 속도 비교
- **클릭 포장:** CTR이 있으면 측정값, 없으면 제목 구조만 낮은 신뢰도의 추정값
- **시청 유지:** 평균 조회율 또는 평균 시청 지속 시간/영상 길이
- **반응:** 좋아요 + 댓글 가중치 + 공유 가중치를 조회수로 정규화
- **구독 전환:** 조회 1천회당 순구독자
- **일관성:** 최근 게시 간격의 변동성

누락 지표는 0점 처리하지 않고 가중치에서 제외합니다. 공개 진단과 소유자/CSV 정밀 진단 점수를 직접 동일한 신뢰도로 비교하면 안 됩니다.

## 개인정보와 보안

- OAuth 토큰은 로컬 스토리지에 저장하지 않습니다.
- CSV 파일은 네트워크로 전송하지 않습니다.
- Worker는 허용 원본 이외의 브라우저 요청을 거부합니다.
- API 오류 응답에 Google API 키나 원문 요청 정보를 노출하지 않습니다.
- 저장소와 `docs/`에서 실제 키 패턴이 없는지 배포 전 확인합니다.

## 장애 대응

| 증상/코드 | 확인 사항 |
|---|---|
| `PUBLIC_API_NOT_CONFIGURED` | `publicApiBaseUrl` 설정 및 재빌드 |
| `GOOGLE_OAUTH_NOT_CONFIGURED` | `googleOAuthClientId` 설정 및 재빌드 |
| `ORIGIN_NOT_ALLOWED` | Worker `ALLOWED_ORIGINS`에 Pages 원본 추가 |
| `YOUTUBE_QUOTA_EXCEEDED` | Google Cloud 할당량, 캐시, 검색 호출 빈도 확인 |
| `API_NOT_ENABLED` | Data API와 Analytics API 활성화 확인 |
| `INSUFFICIENT_PERMISSIONS` | 두 읽기 전용 OAuth 범위와 사용자 승인 확인 |
| Google 팝업 차단 | 승인된 JavaScript 원본, 브라우저 팝업 정책 확인 |
| CSV 열 인식 실패 | 고급 모드 표 CSV인지, ZIP을 풀었는지 확인 |
| 쇼츠 오분류 | Studio CSV의 콘텐츠 유형 열을 포함해 가져오기 |

## 릴리스 검증

```bash
bun run typecheck
bun run build
bun run build:worker
git diff --check
```

브라우저에서 확인할 최소 흐름:

1. 랜딩 → 샘플 진단
2. 진단 요약 → 콘텐츠 지도 → 포맷 필터
3. 영상 선택 → 영상 닥터 → 제작 가이드
4. 7일 실행 계획 7개 표시
5. 샘플 CSV 가져오기
6. 390px 모바일 가로 넘침 없음
7. 운영 설정 후 실제 채널 URL과 Google OAuth 각각 확인
