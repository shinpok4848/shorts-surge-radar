# MY CHANNEL PULSE

내가 소유한 여러 YouTube 채널을 Google OAuth로 연결해 진단하고, 60초 쇼츠 원본 작업팩을 CapCut용으로 내보내며, 완성 영상을 비공개 업로드 또는 예약 공개로 발행하는 개인용 크리에이터 대시보드입니다.

**사이트:** https://shinpok4848.github.io/shorts-surge-radar/

## 보안 원칙

이 앱은 Google 계정 ID나 비밀번호를 받지 않습니다. 비밀번호, OAuth Client Secret, API 키, 토큰을 저장소나 채팅에 전달하지 마세요.

- Google 공식 OAuth 팝업만 사용합니다.
- 액세스 토큰은 각 채널별로 현재 브라우저 탭 메모리에만 보관되며, 새로고침하거나 연결을 해제하면 폐기됩니다.
- 사이트 주소와 소스 코드는 공개돼 있지만, 인증 전에는 채널 데이터가 저장되거나 노출되지 않습니다.
- 개인 접근 제한은 Google OAuth 동의 화면을 Testing으로 두고 본인 이메일만 Test user로 등록해 유지합니다.

## 기능

### 다중 채널 연결
- 상단 **계정 추가**로 다른 Google 계정이나 브랜드 채널을 원하는 만큼 연결
- 활성 채널 선택기로 즉시 전환
- 채널별로 토큰·분석 데이터·제작 작업 분리
- 현재 채널만 개별 연결 해제

### 채널 진단
- 모든 공개 업로드 자동 수집, 일반 영상과 180초 이하 쇼츠 후보 분리
- 최근 365일 YouTube Analytics 결합
- 조회·시청 유지·반응·구독 전환·유입 경로 진단, 영상별 건강점수
- 제목·썸네일·첫 훅·영상 구성 개선 가이드와 7일 실행 계획
- 선택적으로 YouTube Studio CSV를 로컬에서 병합해 노출·CTR 보강

### CapCut 제작팩
- 내 60초 이하 영상 또는 시장 레이더의 60초 이하 인기 영상에서 시작
- 참고 영상의 대본·화면·음원을 복제하지 않고, 주제·구조만 참고한 **새 원본 초안**을 생성
- 대본·제목·설명·태그를 직접 편집하거나 본인이 권리를 가진 대본으로 교체
- 권리 확인 후 ZIP 다운로드:
  - `01_capcut_captions.srt` — CapCut Desktop/Web 외부 자막 가져오기용 UTF-8 SRT (60초 이내 자동 타이밍)
  - `02_voiceover_script.txt` — 보이스오버 대본
  - `03_shot_list.csv` — 시간대별 샷·편집 지시
  - `04_youtube_metadata.txt` / `05_youtube_metadata.json` — 제목·설명·태그
  - `06_reference_only.txt` — 참고·권리 안내
  - `README_KO.txt` — 사용법

### 업로드·예약 발행
- 완성한 로컬 MP4/MOV/WebM 파일을 활성 채널로 재개 가능(resumable) 업로드
- 아동용 여부, 합성·변형 콘텐츠 여부를 선언
- **비공개 업로드(권장)** 또는 **자동 예약 공개** 선택
- 예약 공개는 최소 15분 이후 시각과 API 감사 완료 확인 체크가 필요
- 감사받지 않은 API 프로젝트는 비공개로만 업로드될 수 있어, 이 경우 YouTube Studio에서 공개 예약을 완료하도록 안내

### 채널 런치 킷 (신규 숏츠 채널용)
- 니치와 핵심 주제를 고르면 숏츠 성장 원칙에 맞춰 런치 킷 생성
- **채널 약속·시각 정체성**: 3초 안에 채널을 각인하는 한 문장 약속과 썸네일·배지 규칙
- **반복 시리즈 설계**: 단발이 아니라 시리즈로 묶어 시청 지속·구독 전환 유도
- **훅 라이브러리**: 결과 선공개·통념 반박·손실 회피 등 스크롤을 멈추는 첫 1~2초 패턴
- **30일 발행 캘린더**: 선택한 주간 발행 횟수에 맞춘 날짜별 시리즈·훅·목표(도달/유지/반응/전환) 배분
- **유지율 체크리스트**와 **매주 회고 루프**로 한 번에 한 변수만 실험
- 대본이 필요하면 제작·예약 탭의 CapCut 작업팩으로 바로 연결

## CapCut·YouTube 공식 제약

- CapCut의 외부 SRT/TXT 자막 가져오기는 Desktop과 Web에서 지원되며, 모바일 앱은 직접 가져오기가 제한될 수 있습니다. 공개된 CapCut 프로젝트 파일 형식이 없어 독점 프로젝트 파일 대신 표준 SRT·CSV·TXT·JSON을 제공합니다.
- YouTube Data API는 재개 가능한 OAuth 업로드와 `status.publishAt`을 통한 예약 공개를 지원합니다. 다만 2020년 7월 28일 이후 생성된 미감사 API 프로젝트의 업로드는 비공개로 제한됩니다.
- 업로드에는 `youtube.upload` 범위가 필요하며, 변형·합성 콘텐츠는 `status.containsSyntheticMedia`로 고지합니다.
- YouTube Data API에는 신뢰할 수 있는 `isShort`나 화면비 필드가 없어, Studio CSV의 콘텐츠 유형 증거가 없으면 180초 이하 영상을 쇼츠 후보로 표시합니다.

## Google Cloud 설정

1. 프로젝트에서 **YouTube Data API v3**와 **YouTube Analytics API**를 활성화합니다.
2. OAuth 동의 화면을 **External / Testing**으로 두고, 사용할 모든 Google 이메일을 Test user로 등록합니다.
3. 다음 범위를 추가합니다.
   - `https://www.googleapis.com/auth/youtube.readonly`
   - `https://www.googleapis.com/auth/yt-analytics.readonly`
   - `https://www.googleapis.com/auth/youtube.upload`
4. Web OAuth Client의 Authorized JavaScript origins에 `https://shinpok4848.github.io`(로컬 확인 시 `http://localhost:4173`)를 추가합니다.
5. 공개 Client ID만 `public/app-config.json`에 넣습니다. Client Secret은 사용하지 않습니다.

```json
{
  "googleOAuthClientId": "여기에-client-id.apps.googleusercontent.com",
  "appLabel": "MY CHANNEL PULSE"
}
```

## 로컬 빌드

[Bun](https://bun.sh/)과 TypeScript가 준비된 환경에서:

```bash
bun run typecheck
bun run build
python3 -m http.server 4173 -d docs
```

## 창작과 권리

CapCut 작업팩은 참고 영상 복제가 아니라 새 원본 제작을 위한 시작 파일입니다. 직접 쓴 대본, 직접 촬영·제작하거나 사용 권한이 있는 화면·음원만 사용하고 원저작자의 권리와 YouTube 정책을 준수하세요.

## 공식 문서

- [YouTube Data API](https://developers.google.com/youtube/v3)
- [JavaScript 웹 앱 OAuth](https://developers.google.com/youtube/v3/guides/auth/client-side-web-apps)
- [재개 가능한 업로드](https://developers.google.com/youtube/v3/guides/using_resumable_upload_protocol)
- [videos.insert 업로드](https://developers.google.com/youtube/v3/docs/videos/insert)
- [예약 공개 안내](https://support.google.com/youtube/answer/1270709)
- [CapCut 자막 가져오기](https://www.capcut.com/help/how-to-import-subtitles)
