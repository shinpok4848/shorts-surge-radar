# ROMANCE PULSE 운영 가이드

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
- [ ] Test users: 낭만구조대 소유 Google 이메일 1명만 등록
- [ ] Scope: `youtube.readonly`
- [ ] Scope: `yt-analytics.readonly`

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
  "targetChannelHandle": "@낭만구조대",
  "targetChannelId": ""
}
```

최초 연결 후 실제 채널 ID를 확인할 수 있으면 `targetChannelId`에 `UC...` 값을 넣고 다시 배포하는 것을 권장합니다.

## 배포

```bash
bun run typecheck
bun run build
git diff --check
```

`docs/`를 기본 브랜치에 반영하면 현재 GitHub Pages 설정이 자동 배포합니다.

## 사용 세션

- 로그인 버튼 클릭 전에는 API 호출이 없습니다.
- Google 팝업에서 본인 계정 또는 연결된 브랜드 채널을 선택합니다.
- 채널이 `@낭만구조대`와 다르면 토큰을 폐기합니다.
- 토큰은 메모리에만 있고 약 1시간 후 만료될 수 있습니다.
- 페이지 새로고침 또는 로그아웃 후 다시 인증해야 합니다.
- Studio CSV는 로그인된 낭만구조대 데이터에만 병합합니다.

## API 할당량

- 업로드 수집은 저비용 uploads playlist와 `videos.list` 배치를 사용합니다.
- 비용이 큰 `search.list`는 사용자가 연관영상 또는 시장 스캔을 요청할 때만 실행합니다.
- 같은 검색을 반복하면 Google Cloud 프로젝트 할당량을 소비합니다.
- 앱은 기본적으로 최대 2,000개 업로드를 불러옵니다.

## 장애 대응

| 증상 | 확인 사항 |
|---|---|
| OAuth Client ID 설정 필요 | `public/app-config.json` 입력 후 `bun run build` 및 재배포 |
| `origin_mismatch` | Authorized JavaScript origins에 `https://shinpok4848.github.io` 추가 |
| 앱이 테스트 액세스를 거부 | OAuth Test users에 본인 Google 이메일 추가 |
| API가 활성화되지 않음 | Data API와 Analytics API 모두 활성화 |
| 낭만구조대가 아니라는 오류 | Google/브랜드 계정 선택을 변경; 필요하면 YouTube에서 채널 전환 후 재로그인 |
| Analytics 데이터가 적음 | 최근 2~3일 처리 지연과 365일 분석 범위 확인 |
| CTR이 없음 | YouTube Studio 고급 모드 CSV에서 노출·CTR 열을 포함해 가져오기 |
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
3. 다른 채널 선택 시 대시보드가 열리지 않는지 확인
4. 낭만구조대 선택 시 모든 업로드와 Analytics가 표시되는지 확인
5. 콘텐츠 지도, 영상 닥터, 연관영상, 시장 레이더 확인
6. 로그아웃 후 데이터가 화면에서 사라지는지 확인
7. 390px 모바일에서 가로 넘침이 없는지 확인
8. 저장소와 `docs/`에 비밀번호, Client Secret, 토큰, API 키가 없는지 검색
