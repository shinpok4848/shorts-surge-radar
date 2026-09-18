# MY CHANNEL PULSE 운영 가이드

## 절대 공유하지 않을 정보

- Google 계정 비밀번호
- 2단계 인증 코드
- OAuth Client Secret
- 액세스 토큰 또는 갱신 토큰
- API 키

이 앱은 위 값을 요구하지 않습니다. 필요한 것은 공개 식별자인 **OAuth Web Client ID** 하나뿐입니다.

## 최초 설정 체크리스트

### Google Cloud API

- [ ] YouTube Data API v3 활성화
- [ ] YouTube Analytics API 활성화

### OAuth 동의 화면

- [ ] Audience: External
- [ ] Publishing status: Testing
- [ ] Test users: 연결할 모든 Google 이메일 등록
- [ ] Scope: `youtube.readonly`
- [ ] Scope: `yt-analytics.readonly`
- [ ] Scope: `youtube.upload`

### OAuth Web Client

- [ ] Application type: Web application
- [ ] Authorized JavaScript origin: `https://shinpok4848.github.io`
- [ ] 로컬 확인 시 origin: `http://localhost:4173`
- [ ] Client ID만 `public/app-config.json`에 입력
- [ ] Client Secret은 어디에도 입력하지 않음

## 설정 파일

```json
{
  "googleOAuthClientId": "<client-id>.apps.googleusercontent.com",
  "appLabel": "MY CHANNEL PULSE"
}
```

## 배포

```bash
bun run typecheck
bun run build
git diff --check
```

`docs/`를 기본 브랜치에 반영하면 현재 GitHub Pages 설정이 자동 배포합니다.

## 사용 세션

- 로그인 버튼 클릭 전에는 API 호출이 없습니다.
- Google 팝업에서 사용할 계정 또는 브랜드 채널을 선택합니다.
- **계정 추가**로 다른 Google 계정·채널을 원하는 만큼 연결하고, 상단 선택기로 전환합니다.
- 채널별 토큰은 메모리에만 있고 약 1시간 후 만료될 수 있습니다.
- 새로고침 또는 연결 해제 후 다시 인증해야 합니다.
- Studio CSV는 현재 활성 채널 데이터에만 병합됩니다.

## CapCut 제작팩

- 내 60초 이하 영상 또는 60초 이하 시장 영상에서 작업팩을 생성합니다.
- 참고 영상의 대본·화면·음원을 복제하지 않습니다. 초안은 주제·구조만 참고해 새로 작성됩니다.
- 대본과 메타데이터를 편집하고 권리 확인 후 ZIP을 받습니다.
- CapCut Desktop 또는 Web에서 `01_capcut_captions.srt`를 UTF-8 자막으로 가져옵니다. 모바일 앱은 직접 가져오기가 제한될 수 있습니다.

## 업로드·예약 발행

- 완성한 로컬 MP4/MOV/WebM 파일을 활성 채널로 재개 가능 업로드합니다.
- 기본값은 **비공개 업로드**이며, YouTube Studio에서 검토 후 공개를 권장합니다.
- **자동 예약 공개**는 최소 15분 이후 시각과 API 감사 완료 확인 체크가 필요합니다.
- 미감사 API 프로젝트는 비공개로만 업로드될 수 있으며, 이 경우 Studio에서 공개 예약을 완료합니다.
- 아동용 여부와 합성·변형 콘텐츠 여부를 정확히 선언합니다.

## API 할당량

- 업로드 수집은 저비용 uploads playlist와 `videos.list` 배치를 사용합니다.
- 비용이 큰 `search.list`는 연관영상·시장 스캔 시에만 실행합니다.
- `videos.insert` 업로드도 프로젝트 할당량을 소비합니다.
- 앱은 기본적으로 채널당 최대 2,000개 업로드를 불러옵니다.

## 장애 대응

| 증상 | 확인 사항 |
|---|---|
| OAuth Client ID 설정 필요 | `public/app-config.json` 입력 후 `bun run build` 및 재배포 |
| `origin_mismatch` | Authorized JavaScript origins에 `https://shinpok4848.github.io` 추가 |
| 앱이 테스트 액세스를 거부 | OAuth Test users에 해당 Google 이메일 추가 |
| API가 활성화되지 않음 | Data API와 Analytics API 모두 활성화 |
| 업로드 권한 오류 | `youtube.upload` 범위 추가 후 채널 다시 연결 |
| 예약이 비공개로 적용됨 | API 프로젝트 감사 완료 여부 확인, Studio에서 공개 예약 |
| Analytics 데이터가 적음 | 최근 2~3일 처리 지연과 365일 분석 범위 확인 |
| CTR이 없음 | YouTube Studio 고급 모드 CSV에서 노출·CTR 열 포함 |
| 시장 검색 할당량 초과 | 검색 횟수를 줄이고 다음 할당량 갱신까지 대기 |
| 팝업 차단 | 브라우저에서 사이트의 팝업 허용 |

## 계정 보안 사고 시

1. Google 계정 보안 페이지에서 앱 접근 권한을 철회합니다.
2. Google Cloud에서 OAuth Client를 비활성화하거나 삭제합니다.
3. 필요하면 새 Client ID를 생성해 설정을 교체합니다.
4. 비밀번호를 이 앱이나 저장소에 넣었다면 즉시 비밀번호를 변경합니다.

## 릴리스 검증

1. Client ID가 없는 빌드에서 로그인 버튼이 안전한 설정 안내를 표시하는지 확인
2. 허용된 Test user로 Google 팝업이 열리는지 확인
3. 여러 채널을 연결하고 선택기로 전환되는지 확인
4. 콘텐츠 지도, 영상 닥터, 연관영상, 시장 레이더 확인
5. CapCut 작업팩 ZIP이 SRT·CSV·메타데이터를 포함해 생성되는지 확인
6. 비공개 업로드와 예약 옵션·감사 확인 게이트가 동작하는지 확인
7. 로그아웃 후 데이터가 화면에서 사라지는지 확인
8. 390px 모바일에서 가로 넘침이 없는지 확인
9. 저장소와 `docs/`에 비밀번호, Client Secret, 토큰, API 키가 없는지 검색
