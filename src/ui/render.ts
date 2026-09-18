import type {
  AnalyzedVideo,
  AppState,
  CalendarEntry,
  ChannelAnalysis,
  ChannelDataset,
  ContentKind,
  DashboardFilters,
  DashboardSection,
  Diagnosis,
  LaunchInputs,
  LaunchKit,
  MetricScore,
  ProductionDraft,
  PublishDraft,
  RankedShort,
} from '../types';

export interface AppActions {
  onNavigate: (view: AppState['view']) => void;
  onConnectGoogle: () => void;
  onDisconnectGoogle: () => void;
  onSwitchChannel: (channelId: string) => void;
  onImportCsv: (files: File[]) => void;
  onRefresh: () => void;
  onSelectSection: (section: DashboardSection) => void;
  onSelectVideo: (videoId: string) => void;
  onSetContentFilter: (filter: AppState['contentFilter']) => void;
  onSetSort: (sort: AppState['sortBy']) => void;
  onLoadBenchmarks: (videoId: string) => void;
  onMarketSearch: (filters: DashboardFilters) => void;
  onCreateProduction: (sourceType: ProductionDraft['sourceType'], videoId: string) => void;
  onDownloadProduction: (fields: {
    title: string;
    description: string;
    tags: string;
    script: string;
    rightsConfirmed: boolean;
  }) => void;
  onPublishVideo: (file: File | null, draft: PublishDraft, rightsConfirmed: boolean) => void;
  onGenerateLaunchKit: (inputs: LaunchInputs) => void;
}

import { NICHE_BLUEPRINTS } from '../launch/niches';

const compactNumber = new Intl.NumberFormat('ko-KR', { notation: 'compact', maximumFractionDigits: 1 });
const wholeNumber = new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 0 });
const relativeFormatter = new Intl.RelativeTimeFormat('ko', { numeric: 'auto' });

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  })[character] ?? character);
}

function safeUrl(value: string): string {
  if (!value) return '';
  if (value.startsWith('data:image/')) return escapeHtml(value);
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) ? escapeHtml(url.toString()) : '';
  } catch {
    return '';
  }
}

function formatNumber(value: number | null, fallback = '—'): string {
  return value === null || !Number.isFinite(value) ? fallback : compactNumber.format(value);
}

function formatDuration(seconds: number | null): string {
  if (seconds === null) return '길이 미확인';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remain = Math.round(seconds % 60);
  return hours
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(remain).padStart(2, '0')}`
    : `${minutes}:${String(remain).padStart(2, '0')}`;
}

function relativeDate(value: string): string {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return '게시일 없음';
  const days = Math.round((timestamp - Date.now()) / 86_400_000);
  if (Math.abs(days) < 30) return relativeFormatter.format(days, 'day');
  const months = Math.round(days / 30);
  if (Math.abs(months) < 12) return relativeFormatter.format(months, 'month');
  return new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' }).format(timestamp);
}

function sourceLabel(dataset: ChannelDataset): string {
  return dataset.source === 'studio-csv' ? 'OWNER + STUDIO CSV' : 'OWNER ANALYTICS';
}

function basisLabel(basis: MetricScore['basis']): string {
  return { measured: '측정', public: '공개', inferred: '추정', unavailable: '없음' }[basis];
}

function formatLabel(kind: ContentKind, confidence: AnalyzedVideo['contentKindConfidence']): string {
  if (kind === 'video') return '일반 영상';
  return confidence === 'verified' ? '쇼츠' : '쇼츠 후보';
}

function priorityLabel(priority: Diagnosis['priority']): string {
  return { critical: '즉시 개선', high: '높은 우선순위', medium: '점검', opportunity: '성장 기회' }[priority];
}

function renderHeader(state: AppState): string {
  const hasActiveChannel = Boolean(state.dataset && state.activeChannelId);
  return `
    <header class="site-header">
      <a class="brand" href="#" id="brand-home" aria-label="My Channel Pulse 홈">
        <span class="brand-mark">ϟ</span>
        <span><strong>MY CHANNEL</strong><b>PULSE</b></span>
      </a>
      ${hasActiveChannel ? `<nav class="top-nav" aria-label="주요 메뉴">
        <button class="${state.view === 'diagnosis' ? 'is-active' : ''}" data-view="diagnosis">채널 진단</button>
        <button class="${state.view === 'market' ? 'is-active' : ''}" data-view="market">시장 레이더</button>
        <button class="${state.view === 'produce' ? 'is-active' : ''}" data-view="produce">제작·예약</button>
        <button class="${state.view === 'launch' ? 'is-active' : ''}" data-view="launch">채널 런치</button>
      </nav>` : '<span class="personal-lock">PRIVATE CREATOR DESK</span>'}
      <div class="header-actions">
        ${hasActiveChannel ? `<label class="channel-switch-label"><span>활성 채널</span><select id="channel-switcher">${state.connectedChannels.map((channel) => `<option value="${escapeHtml(channel.channelId)}" ${channel.channelId === state.activeChannelId ? 'selected' : ''}>${escapeHtml(channel.title)}</option>`).join('')}</select></label><button class="quiet-button" id="add-channel-button">＋ 계정 추가</button><button class="connection-dot" id="google-disconnect-button" title="현재 채널 연결 해제"><i></i><span>연결 해제</span></button>` : '<span class="header-caption">OWNER ACCOUNTS ONLY</span>'}
        ${state.analysis ? '<button class="quiet-button refresh-owner" id="refresh-button">갱신</button>' : ''}
      </div>
    </header>`;
}

function renderFeedback(state: AppState): string {
  return `
    ${state.notice ? `<div class="notice notice--${state.notice.tone}" role="status">${escapeHtml(state.notice.message)}</div>` : ''}
    ${state.error ? `<div class="notice notice--error" role="alert"><strong>확인해 주세요</strong>${escapeHtml(state.error)}</div>` : ''}
    ${state.loading ? `<div class="loading-layer" role="status"><div class="radar-loader"><i></i><i></i><span>ϟ</span></div><strong>${escapeHtml(state.loadingMessage)}</strong><small>데이터 양에 따라 잠시 걸릴 수 있습니다.</small></div>` : ''}
  `;
}

function renderLanding(state: AppState): string {
  const oauthReady = Boolean(state.config.googleOAuthClientId);
  return `
    <main class="landing-main personal-main">
      <section class="diagnosis-hero personal-hero">
        <div class="hero-copy-block">
          <p class="eyebrow accent">PRIVATE MULTI-CHANNEL INTELLIGENCE</p>
          <h1>내 채널들의<br/><em>성장 관제실.</em></h1>
          <p>Google 계정과 브랜드 채널을 원하는 만큼 연결하고, 채널마다 업로드·Analytics·제작 작업을 분리해 관리합니다.</p>
          <div class="trust-row"><span>비밀번호 미수집</span><span>채널별 세션 분리</span><span>읽기·업로드 OAuth</span><span>토큰 메모리 보관</span></div>
        </div>
        <div class="hero-score-preview personal-orbit" aria-hidden="true">
          <div class="preview-orbit orbit-a"></div><div class="preview-orbit orbit-b"></div>
          <span class="preview-score"><b>ϟ</b><small>MULTI ACCOUNT</small></span>
          <span class="preview-chip chip-one">OAUTH ONLY</span>
          <span class="preview-chip chip-two">PRIVATE DATA</span>
        </div>
      </section>

      <section class="personal-login-section">
        <article class="personal-login-card">
          <div class="login-security-mark"><span></span><b>OWNER<br/>ACCOUNTS</b></div>
          <div class="login-copy">
            <p class="eyebrow">SECURE CHANNEL ACCESS</p>
            <h2>첫 Google 채널을 연결하세요</h2>
            <p>계정 선택 창에서 분석할 YouTube 채널을 고릅니다. 연결 후 상단의 ‘계정 추가’로 다른 Google 계정이나 브랜드 채널을 더할 수 있습니다.</p>
            <ul><li>각 Google 이메일을 OAuth Test user에 등록</li><li>비밀번호·Client Secret은 앱이 받지 않음</li><li>새로고침하면 모든 액세스 토큰 폐기</li></ul>
          </div>
          <div class="login-action">
            <span class="config-status ${oauthReady ? 'is-ready' : ''}"><i></i>${oauthReady ? 'OAuth 준비됨' : 'OAuth Client ID 설정 필요'}</span>
            <button class="primary-button google-login-button" id="google-connect-button"><b>G</b> Google 채널 연결</button>
            <small>${oauthReady ? 'Google 계정 선택 창에서 사용할 채널을 선택하세요.' : '운영 OAuth 설정이 완료되어야 연결할 수 있습니다.'}</small>
          </div>
        </article>
      </section>

      <section class="method-grid personal-methods">
        <div><span>01</span><strong>다중 채널 전환</strong><p>연결한 계정마다 토큰과 분석 데이터를 현재 탭의 메모리에서 분리합니다.</p></div>
        <div><span>02</span><strong>CapCut 제작팩</strong><p>60초 원본 대본, SRT 자막, 샷리스트와 업로드 메타데이터를 ZIP으로 받습니다.</p></div>
        <div><span>03</span><strong>검토 후 예약</strong><p>완성 MP4와 메타데이터를 확인한 뒤 비공개 업로드 또는 예약 공개를 요청합니다.</p></div>
      </section>
    </main>`;
}

function scoreCard(score: MetricScore, className = ''): string {
  const value = score.value === null ? '—' : String(score.value);
  return `<article class="score-card ${className}">
    <div><span>${escapeHtml(score.label)}</span><b class="basis basis--${score.basis}">${basisLabel(score.basis)}</b></div>
    <strong>${value}<small>${score.value === null ? '' : '/100'}</small></strong>
    <div class="score-track"><i style="width:${score.value ?? 0}%"></i></div>
    <p>${escapeHtml(score.detail)}</p>
  </article>`;
}

function diagnosisCard(diagnosis: Diagnosis, index: number): string {
  return `<article class="diagnosis-card diagnosis-card--${diagnosis.priority}">
    <div class="diagnosis-index">${String(index + 1).padStart(2, '0')}</div>
    <div class="diagnosis-body">
      <div class="diagnosis-meta"><span>${priorityLabel(diagnosis.priority)}</span><b class="basis basis--${diagnosis.basis}">${basisLabel(diagnosis.basis)}</b></div>
      <h3>${escapeHtml(diagnosis.title)}</h3>
      <p>${escapeHtml(diagnosis.summary)}</p>
      <div class="evidence-row">${diagnosis.evidence.map((item) => `<span>${escapeHtml(item)}</span>`).join('')}</div>
      <ol>${diagnosis.actions.map((action) => `<li>${escapeHtml(action)}</li>`).join('')}</ol>
    </div>
  </article>`;
}

function renderProfile(dataset: ChannelDataset, analysis: ChannelAnalysis): string {
  const dateRange = dataset.dateRange
    ? `${dataset.dateRange.startDate.replaceAll('-', '.')} — ${dataset.dateRange.endDate.replaceAll('-', '.')}`
    : '공개 누적 데이터';
  return `<section class="channel-masthead">
    <div class="channel-identity">
      <img src="${safeUrl(dataset.channel.avatarUrl)}" alt="${escapeHtml(dataset.channel.title)} 채널 이미지" />
      <div><div class="source-line"><span class="live-pill"><i></i>${sourceLabel(dataset)}</span><span>${escapeHtml(dateRange)}</span></div>
      <h1>${escapeHtml(dataset.channel.title)}</h1><p>${escapeHtml(dataset.channel.customUrl ?? dataset.channel.channelId)}</p></div>
    </div>
    <div class="channel-kpis">
      <div><span>구독자</span><strong>${formatNumber(dataset.channel.subscribers)}</strong></div>
      <div><span>분석 콘텐츠</span><strong>${analysis.videos.length}</strong></div>
      <div><span>데이터 충실도</span><strong>${analysis.metricCoverage}%</strong></div>
    </div>
    <label class="csv-enrich" for="dashboard-csv-input">＋ Studio CSV로 보강</label>
    <input id="dashboard-csv-input" class="visually-hidden" type="file" accept=".csv,text/csv" multiple />
  </section>`;
}

function renderWarnings(dataset: ChannelDataset): string {
  if (!dataset.warnings.length) return '';
  return `<details class="data-notes"><summary>데이터 범위와 주의사항 ${dataset.warnings.length}개 <span>＋</span></summary><ul>${dataset.warnings.map((warning) => `<li>${escapeHtml(warning)}</li>`).join('')}</ul></details>`;
}

function renderOverview(dataset: ChannelDataset, analysis: ChannelAnalysis): string {
  const maxTraffic = Math.max(1, ...dataset.trafficSources.map((source) => source.views));
  return `
    <section class="overall-panel">
      <div class="overall-ring" style="--score:${analysis.overallScore}"><div><strong>${analysis.overallScore}</strong><span>CHANNEL<br/>SCORE</span></div></div>
      <div class="overall-copy"><p class="eyebrow accent">DIAGNOSIS SUMMARY</p><h2>${analysis.overallScore >= 75 ? '성공 패턴을 확장할 단계입니다.' : analysis.overallScore >= 55 ? '성장 신호는 있습니다. 병목을 먼저 고치세요.' : '업로드 양보다 기초 구조 개선이 먼저입니다.'}</h2><p>현재 채널의 소유자 Analytics 안에서 조회·시청 유지·반응·구독 전환을 분리해 계산했습니다. Studio CSV를 추가하면 노출·CTR 진단도 더 정밀해집니다.</p></div>
    </section>
    <section class="score-grid">
      ${scoreCard(analysis.scores.reach)}${scoreCard(analysis.scores.packaging)}${scoreCard(analysis.scores.retention)}
      ${scoreCard(analysis.scores.engagement)}${scoreCard(analysis.scores.conversion)}${scoreCard(analysis.scores.consistency)}
    </section>
    <section class="dashboard-block">
      <div class="block-heading"><div><p class="eyebrow">PRIORITY DIAGNOSIS</p><h2>먼저 바꿀 것</h2></div><span>${analysis.diagnoses.length} ACTION SIGNALS</span></div>
      <div class="diagnosis-list">${analysis.diagnoses.map(diagnosisCard).join('')}</div>
    </section>
    <section class="split-block">
      <div class="dashboard-block format-block">
        <div class="block-heading"><div><p class="eyebrow">CONTENT FORMAT</p><h2>포맷별 성과</h2></div></div>
        <div class="format-comparison">${analysis.formats.map((format) => `<article>
          <div><span class="format-pill">${format.kind === 'short' ? 'SHORTS' : 'VIDEO'}</span><strong>${format.count}개</strong></div>
          <h3>${formatNumber(format.views)}<small> 분석 조회</small></h3>
          <dl><div><dt>일평균 중앙값</dt><dd>${formatNumber(format.medianViewsPerDay)}</dd></div><div><dt>반응률 중앙값</dt><dd>${format.medianEngagementRate === null ? '—' : `${(format.medianEngagementRate * 100).toFixed(2)}%`}</dd></div><div><dt>평균 조회율</dt><dd>${format.medianAveragePercentageViewed === null ? '—' : `${format.medianAveragePercentageViewed.toFixed(1)}%`}</dd></div></dl>
        </article>`).join('')}</div>
      </div>
      <div class="dashboard-block traffic-block">
        <div class="block-heading"><div><p class="eyebrow">DISCOVERY PATH</p><h2>유입 경로</h2></div></div>
        ${dataset.trafficSources.length ? `<div class="traffic-list">${dataset.trafficSources.slice(0, 6).map((source) => `<div><span>${escapeHtml(trafficLabel(source.source))}</span><i><b style="width:${source.views / maxTraffic * 100}%"></b></i><strong>${formatNumber(source.views)}</strong></div>`).join('')}</div>` : '<div class="unavailable-panel"><strong>소유자 데이터 필요</strong><p>Google로 채널을 연결하면 시청자가 어디에서 유입되는지 확인할 수 있습니다.</p></div>'}
      </div>
    </section>`;
}

function trafficLabel(source: string): string {
  return ({
    SHORTS: 'Shorts 피드', SHORTS_FEED: 'Shorts 피드', SUGGESTED: '추천 동영상', RELATED_VIDEO: '추천 동영상',
    BROWSE: '탐색 기능', SUBSCRIBER: '구독 피드', YT_SEARCH: 'YouTube 검색', EXTERNAL: '외부', PLAYLIST: '재생목록',
  } as Record<string, string>)[source] ?? source.replaceAll('_', ' ');
}

function sortedVideos(state: AppState): AnalyzedVideo[] {
  const videos = (state.analysis?.videos ?? []).filter((video) => state.contentFilter === 'all' || video.contentKind === state.contentFilter);
  return videos.sort((a, b) => {
    if (state.sortBy === 'views') return (b.metrics.views ?? -1) - (a.metrics.views ?? -1);
    if (state.sortBy === 'recent') return (Date.parse(b.publishedAt) || 0) - (Date.parse(a.publishedAt) || 0);
    return b.healthScore - a.healthScore;
  });
}

function contentRow(video: AnalyzedVideo, selected: boolean): string {
  return `<button class="content-row ${selected ? 'is-selected' : ''}" data-video-id="${escapeHtml(video.videoId)}">
    <span class="content-rank">${String(video.rank).padStart(2, '0')}</span>
    <span class="content-thumb"><img src="${safeUrl(video.thumbnailUrl)}" alt=""/><i>${formatDuration(video.durationSeconds)}</i></span>
    <span class="content-title"><b>${escapeHtml(video.title)}</b><small><em>${formatLabel(video.contentKind, video.contentKindConfidence)}</em>${relativeDate(video.publishedAt)}</small></span>
    <span class="content-metric"><small>조회</small><b>${formatNumber(video.metrics.views)}</b></span>
    <span class="content-metric"><small>${video.metrics.impressionClickThroughRate === null ? '반응률' : 'CTR'}</small><b>${video.metrics.impressionClickThroughRate === null ? (video.engagementRate === null ? '—' : `${(video.engagementRate * 100).toFixed(1)}%`) : `${video.metrics.impressionClickThroughRate.toFixed(1)}%`}</b></span>
    <span class="content-metric"><small>평균 조회율</small><b>${video.metrics.averagePercentageViewed === null ? '—' : `${video.metrics.averagePercentageViewed.toFixed(0)}%`}</b></span>
    <span class="content-health" style="--score:${video.healthScore}"><b>${video.healthScore}</b></span>
    <span class="row-arrow">→</span>
  </button>`;
}

function renderContent(state: AppState): string {
  const videos = sortedVideos(state);
  return `<section class="dashboard-block content-map">
    <div class="block-heading content-heading"><div><p class="eyebrow">CONTENT MAP</p><h2>모든 영상 진단</h2></div>
      <div class="content-controls">
        <label><span>포맷</span><select id="content-filter"><option value="all" ${state.contentFilter === 'all' ? 'selected' : ''}>전체</option><option value="short" ${state.contentFilter === 'short' ? 'selected' : ''}>쇼츠 / 후보</option><option value="video" ${state.contentFilter === 'video' ? 'selected' : ''}>일반 영상</option></select></label>
        <label><span>정렬</span><select id="content-sort"><option value="health" ${state.sortBy === 'health' ? 'selected' : ''}>진단 점수</option><option value="views" ${state.sortBy === 'views' ? 'selected' : ''}>조회수</option><option value="recent" ${state.sortBy === 'recent' ? 'selected' : ''}>최신순</option></select></label>
      </div>
    </div>
    <div class="content-table-head"><span>#</span><span>콘텐츠</span><span>성과</span><span>선택률</span><span>유지</span><span>점수</span><span></span></div>
    <div class="content-rows">${videos.slice(0, 120).map((video) => contentRow(video, state.selectedVideoId === video.videoId)).join('') || '<div class="empty-state">선택한 포맷의 영상이 없습니다.</div>'}</div>
    ${videos.length > 120 ? `<p class="table-note">화면 성능을 위해 상위 120개를 표시합니다. 진단 계산에는 ${videos.length}개 전체가 포함됐습니다.</p>` : ''}
  </section>`;
}

function metricTile(label: string, value: string, note: string): string {
  return `<div class="metric-tile"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong><small>${escapeHtml(note)}</small></div>`;
}

function videoLink(video: AnalyzedVideo): string {
  if (video.videoId.startsWith('csv-')) return '';
  return `https://www.youtube.com/watch?v=${encodeURIComponent(video.videoId)}`;
}

function renderDoctor(state: AppState, dataset: ChannelDataset, analysis: ChannelAnalysis): string {
  const selected = analysis.videos.find((video) => video.videoId === state.selectedVideoId) ?? analysis.videos[0];
  if (!selected) return '<section class="empty-state"><h2>진단할 영상이 없습니다.</h2></section>';
  const link = videoLink(selected);
  const benchmarkAverage = dataset.benchmarks.length
    ? dataset.benchmarks.reduce((sum, video) => sum + (video.metrics.views ?? 0), 0) / dataset.benchmarks.length
    : null;
  return `<section class="doctor-layout">
    <aside class="doctor-selector">
      <p class="eyebrow">SELECT VIDEO</p>
      <select id="doctor-video-select">${analysis.videos.map((video) => `<option value="${escapeHtml(video.videoId)}" ${video.videoId === selected.videoId ? 'selected' : ''}>${escapeHtml(video.title)}</option>`).join('')}</select>
      <div class="doctor-thumb"><img src="${safeUrl(selected.thumbnailUrl)}" alt="${escapeHtml(selected.title)} 썸네일"/><span>${formatLabel(selected.contentKind, selected.contentKindConfidence)} · ${formatDuration(selected.durationSeconds)}</span></div>
      <h2>${escapeHtml(selected.title)}</h2>
      <p>${relativeDate(selected.publishedAt)} · ${selected.tags.length}개 태그</p>
      ${link ? `<a class="secondary-button full-button" href="${link}" target="_blank" rel="noopener noreferrer">YouTube에서 보기 ↗</a>` : ''}
      <div class="mini-score-list">${Object.values(selected.scores).map((score) => `<div><span>${escapeHtml(score.label)} <i>${basisLabel(score.basis)}</i></span><b>${score.value ?? '—'}</b></div>`).join('')}</div>
    </aside>
    <div class="doctor-main">
      <section class="doctor-hero">
        <div><p class="eyebrow accent">VIDEO DOCTOR / SCORE ${selected.healthScore}</p><h1>${selected.diagnoses[0]?.title ?? '성공 패턴을 다음 영상으로 확장하세요'}</h1><p>${selected.diagnoses[0]?.summary ?? '현재 확보된 데이터에서 치명적인 병목이 확인되지 않았습니다.'}</p></div>
        <div class="doctor-score" style="--score:${selected.healthScore}"><strong>${selected.healthScore}</strong><span>HEALTH</span></div>
      </section>
      <section class="metric-tile-grid">
        ${metricTile('분석 조회', formatNumber(selected.metrics.views), dataset.dateRange ? '선택 기간' : '공개 누적')}
        ${metricTile('노출 클릭률', selected.metrics.impressionClickThroughRate === null ? '—' : `${selected.metrics.impressionClickThroughRate.toFixed(1)}%`, selected.metrics.impressions === null ? 'CSV로 보강 가능' : `노출 ${formatNumber(selected.metrics.impressions)}`)}
        ${metricTile('평균 조회율', selected.metrics.averagePercentageViewed === null ? '—' : `${selected.metrics.averagePercentageViewed.toFixed(1)}%`, selected.metrics.averageViewDurationSeconds === null ? '유지율 데이터 필요' : `평균 ${formatDuration(selected.metrics.averageViewDurationSeconds)}`)}
        ${metricTile('순구독', selected.netSubscribers === null ? '—' : wholeNumber.format(selected.netSubscribers), selected.netSubscribers === null ? '소유자 데이터 필요' : '획득 - 이탈')}
      </section>

      <section class="dashboard-block doctor-diagnosis">
        <div class="block-heading"><div><p class="eyebrow">WHY IT HAPPENED</p><h2>문제와 근거</h2></div></div>
        <div class="diagnosis-list">${selected.diagnoses.length ? selected.diagnoses.map(diagnosisCard).join('') : '<div class="unavailable-panel"><strong>치명적 병목이 없습니다</strong><p>아래 구성 가이드로 성공 공식을 새 주제에 확장해 보세요.</p></div>'}</div>
      </section>

      <section class="dashboard-block prescription-block">
        <div class="block-heading"><div><p class="eyebrow">CREATIVE PRESCRIPTION</p><h2>다음 버전 제작 가이드</h2></div><span>복사보다 새 사례·촬영·해설을 사용하세요</span></div>
        <div class="prescription-grid">
          <article><span class="prescription-no">01</span><h3>제목 3안</h3><ol>${selected.guide.titleOptions.map((title) => `<li>${escapeHtml(title)}</li>`).join('')}</ol></article>
          <article><span class="prescription-no">02</span><h3>썸네일</h3><div class="copy-chips">${selected.guide.thumbnailCopy.map((copy) => `<span>${escapeHtml(copy)}</span>`).join('')}</div><p>${escapeHtml(selected.guide.thumbnailDirection)}</p></article>
          <article><span class="prescription-no">03</span><h3>첫 훅</h3><ol>${selected.guide.hookOptions.map((hook) => `<li>${escapeHtml(hook)}</li>`).join('')}</ol></article>
          <article class="structure-card"><span class="prescription-no">04</span><h3>영상 구성</h3><div class="structure-list">${selected.guide.structure.map((beat) => `<div><b>${escapeHtml(beat.range)}</b><span>${escapeHtml(beat.purpose)}</span><p>${escapeHtml(beat.direction)}</p></div>`).join('')}</div></article>
        </div>
        <div class="tag-guidance"><strong>보조 태그</strong>${selected.guide.supportingTags.map((tag) => `<span>#${escapeHtml(tag)}</span>`).join('')}<small>태그는 오탈자·주제 보조용입니다. 제목·썸네일·첫 구간보다 우선하지 마세요.</small></div>
        <button class="primary-button doctor-pack-button" data-create-production="owned" data-production-id="${escapeHtml(selected.videoId)}">이 주제로 CapCut 원본 작업팩 만들기</button>
      </section>

      <section class="dashboard-block benchmark-block">
        <div class="block-heading"><div><p class="eyebrow">RELATED WINNERS</p><h2>연관 인기 영상 비교</h2></div><button class="text-button" data-load-benchmarks="${escapeHtml(selected.videoId)}">현재 주제로 비교 불러오기 ↻</button></div>
        ${dataset.benchmarks.length ? `<div class="benchmark-grid">${dataset.benchmarks.slice(0, 6).map((video, index) => `<article><span>${String(index + 1).padStart(2, '0')}</span><img src="${safeUrl(video.thumbnailUrl)}" alt=""/><div><small>${escapeHtml(video.channelTitle ?? '연관 채널')}</small><h3>${escapeHtml(video.title)}</h3><p>조회 ${formatNumber(video.metrics.views)} · ${video.contentKind === 'short' ? '쇼츠 후보' : '일반 영상'}</p></div></article>`).join('')}</div><p class="benchmark-note">비교 영상 평균 조회 ${formatNumber(benchmarkAverage)}. 조회수 차이만 따라가지 말고 제목의 약속, 도입 증거, 영상 길이의 차이를 새 사례에 적용하세요.</p>` : '<div class="unavailable-panel"><strong>아직 비교 영상을 불러오지 않았습니다</strong><p>위 버튼을 누르면 현재 Google 인증으로 같은 주제의 인기 영상을 검색합니다.</p></div>'}
      </section>
    </div>
  </section>`;
}

function renderPlan(analysis: ChannelAnalysis): string {
  return `<section class="dashboard-block plan-block">
    <div class="block-heading"><div><p class="eyebrow">7-DAY GROWTH SPRINT</p><h2>이번 주 실행 계획</h2></div><span>한 번에 한 가설만 바꾸세요</span></div>
    <div class="plan-list">${analysis.weeklyPlan.map((item, index) => `<article><span>${escapeHtml(item.day)}</span><i>${String(index + 1).padStart(2, '0')}</i><div><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.detail)}</p></div><strong>${escapeHtml(item.outcome)}</strong></article>`).join('')}</div>
  </section>`;
}

function renderPackSourceList(state: AppState): string {
  const candidates = (state.analysis?.videos ?? [])
    .filter((video) => video.durationSeconds !== null && video.durationSeconds <= 60)
    .slice(0, 12);
  return `<section class="production-empty">
    <div class="production-intro"><p class="eyebrow accent">CAPCUT PRODUCTION PACK</p><h1>분석에서<br/><em>편집 시작 파일</em>까지.</h1><p>내 60초 이하 영상 또는 시장 레이더의 인기 쇼츠를 선택하면, 복제 대본이 아닌 새 원본 초안을 CapCut용 SRT·TXT·샷리스트와 함께 만듭니다.</p></div>
    <div class="production-source-list">
      <div class="block-heading"><div><p class="eyebrow">MY SHORT-FORM</p><h2>내 채널에서 시작</h2></div><span>60초 이하</span></div>
      ${candidates.length ? candidates.map((video) => `<article><img src="${safeUrl(video.thumbnailUrl)}" alt=""/><div><small>${formatDuration(video.durationSeconds)} · ${formatNumber(video.metrics.views)} 조회</small><h3>${escapeHtml(video.title)}</h3></div><button class="secondary-button" data-create-production="owned" data-production-id="${escapeHtml(video.videoId)}">원본 작업팩 만들기</button></article>`).join('') : '<div class="unavailable-panel"><strong>60초 이하 내 영상이 없습니다</strong><p>시장 레이더에서 60초 이하 영상을 찾아 새 원본 작업팩을 만들 수 있습니다.</p></div>'}
    </div>
  </section>`;
}

function minimumScheduleLocal(): string {
  const date = new Date(Date.now() + 30 * 60_000);
  date.setMinutes(Math.ceil(date.getMinutes() / 5) * 5, 0, 0);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function renderUploadPanel(state: AppState, draft: ProductionDraft): string {
  const publish = state.publishDraft ?? {
    title: draft.title,
    description: draft.description,
    tags: draft.tags,
    scheduledAtLocal: '',
    madeForKids: false,
    containsSyntheticMedia: false,
    mode: 'private' as const,
    auditConfirmed: false,
  };
  const upload = state.upload;
  const busy = ['initializing', 'uploading', 'processing'].includes(upload.phase);
  const completeLink = upload.videoId ? `https://studio.youtube.com/video/${encodeURIComponent(upload.videoId)}/edit` : '';
  return `<section class="youtube-publish-panel">
    <div class="block-heading"><div><p class="eyebrow">YOUTUBE DELIVERY</p><h2>완성 영상 업로드·예약</h2></div><span>${escapeHtml(state.dataset?.channel.title ?? '활성 채널')}</span></div>
    <aside class="upload-audit-warning"><strong>예약 공개 제한</strong><p>감사받지 않은 신규 YouTube API 프로젝트의 API 업로드는 비공개로 제한될 수 있습니다. 가장 안전한 기본값은 ‘비공개 업로드 후 Studio에서 예약’입니다. API 감사 완료가 확인된 경우에만 자동 예약을 선택하세요.</p></aside>
    <form id="youtube-upload-form" class="youtube-upload-form">
      <label class="video-file-drop" for="youtube-video-file"><span>완성 영상 파일</span><strong id="selected-video-name">${upload.fileName ? escapeHtml(upload.fileName) : 'MP4 / MOV / WebM 선택'}</strong><small>파일은 브라우저에서 활성 YouTube 채널로 직접 전송됩니다.</small></label>
      <input id="youtube-video-file" class="visually-hidden" name="videoFile" type="file" accept="video/mp4,video/quicktime,video/webm,.m4v" ${busy ? 'disabled' : ''} required />
      <div class="publish-fields">
        <label><span>제목</span><input name="publishTitle" maxlength="100" value="${escapeHtml(publish.title)}" required /></label>
        <label><span>태그 — 쉼표 구분</span><input name="publishTags" value="${escapeHtml(publish.tags.join(', '))}" /></label>
        <label class="publish-description"><span>세부 설명</span><textarea name="publishDescription" rows="7" maxlength="5000">${escapeHtml(publish.description)}</textarea></label>
        <fieldset class="publish-mode"><legend>공개 방식</legend><label><input type="radio" name="publishMode" value="private" ${publish.mode === 'private' ? 'checked' : ''}/>비공개 업로드 — 권장</label><label><input type="radio" name="publishMode" value="scheduled" ${publish.mode === 'scheduled' ? 'checked' : ''}/>자동 예약 공개</label></fieldset>
        <label class="schedule-field ${publish.mode === 'scheduled' ? 'is-visible' : ''}"><span>예약 시각 — 현재 기기 시간대</span><input name="scheduledAtLocal" type="datetime-local" min="${minimumScheduleLocal()}" value="${escapeHtml(publish.scheduledAtLocal)}" /></label>
        <div class="declarations"><label><input type="checkbox" name="madeForKids" value="yes" ${publish.madeForKids ? 'checked' : ''}/><span>아동용 콘텐츠입니다</span></label><label><input type="checkbox" name="containsSyntheticMedia" value="yes" ${publish.containsSyntheticMedia ? 'checked' : ''}/><span>현실적으로 보이는 변형·합성 콘텐츠를 포함합니다</span></label><label class="audit-confirm ${publish.mode === 'scheduled' ? 'is-visible' : ''}"><input type="checkbox" name="auditConfirmed" value="yes" ${publish.auditConfirmed ? 'checked' : ''}/><span>이 Google Cloud 프로젝트는 YouTube API 감사 완료로 공개 제한이 해제됐음을 확인합니다</span></label></div>
      </div>
      <label class="rights-confirm upload-rights"><input name="uploadRightsConfirmed" type="checkbox" value="yes" required/><span>이 영상, 음원, 대본, 이미지의 권리를 보유하거나 YouTube 업로드 허가를 받았고, 제목·설명·대상 채널을 최종 확인했습니다.</span></label>
      ${upload.phase !== 'idle' ? `<div class="upload-progress upload-progress--${upload.phase}"><div><span>${escapeHtml(upload.message)}</span><strong>${upload.progress}%</strong></div><i><b style="width:${upload.progress}%"></b></i>${completeLink ? `<a href="${completeLink}" target="_blank" rel="noopener noreferrer">YouTube Studio에서 최종 확인 ↗</a>` : ''}</div>` : ''}
      <div class="upload-actions"><button class="primary-button" type="submit" ${busy ? 'disabled' : ''}>${publish.mode === 'scheduled' ? '최종 확인 후 예약 업로드' : '비공개로 업로드'}</button><a class="secondary-button" href="https://studio.youtube.com" target="_blank" rel="noopener noreferrer">YouTube Studio 열기 ↗</a></div>
    </form>
  </section>`;
}

function renderProductionWorkbench(state: AppState, draft: ProductionDraft): string {
  const sourceType = draft.sourceType === 'market' ? '시장 참고 영상' : '내 채널 영상';
  return `<section class="production-workbench">
    <header class="production-heading"><div><p class="eyebrow accent">ORIGINAL SHORTS WORKBENCH</p><h1>CapCut 작업팩</h1><p>대본과 메타데이터를 편집한 뒤 ZIP을 받으세요. SRT는 CapCut Desktop/Web의 외부 자막 가져오기에 사용할 수 있습니다.</p></div><div class="duration-lock"><strong>${draft.targetDurationSeconds}</strong><span>SECONDS MAX</span></div></header>
    <aside class="copyright-boundary"><strong>복제가 아닌 새 제작</strong><p>참고 영상의 정확한 대본·화면·음원은 포함하지 않습니다. 아래 초안은 주제와 구조만 참고해 새로 작성됐습니다. 본인이 권리를 가진 대본은 직접 붙여넣어 패키징할 수 있습니다.</p></aside>
    <form id="production-form" class="production-form">
      <section class="production-reference"><img src="${safeUrl(draft.sourceThumbnailUrl)}" alt="${escapeHtml(draft.sourceTitle)} 썸네일"/><div><span>${sourceType}</span><h2>${escapeHtml(draft.sourceTitle)}</h2><p>${escapeHtml(draft.sourceChannelTitle)}</p><a href="${escapeHtml(draft.sourceUrl)}" target="_blank" rel="noopener noreferrer">참고 링크 확인 ↗</a></div></section>
      <div class="production-editor-grid">
        <label><span>업로드 제목</span><input name="title" maxlength="100" value="${escapeHtml(draft.title)}" required /></label>
        <label><span>태그 — 쉼표로 구분</span><input name="tags" value="${escapeHtml(draft.tags.join(', '))}" /></label>
        <label class="script-editor"><span>원본 60초 대본 — 한 문장당 한 줄</span><textarea name="script" rows="12" required>${escapeHtml(draft.script)}</textarea><small>각 줄은 문자 수에 따라 60초 안에서 자동 타이밍되어 SRT로 변환됩니다.</small></label>
        <label class="description-editor"><span>YouTube 세부 설명</span><textarea name="description" rows="12">${escapeHtml(draft.description)}</textarea></label>
      </div>
      <label class="rights-confirm"><input name="rightsConfirmed" type="checkbox" value="yes" required/><span>내가 직접 제작했거나 사용 권한이 있는 대본·영상·음원만 CapCut과 YouTube에서 사용하겠습니다.</span></label>
      <div class="production-actions"><button class="primary-button" type="submit">CapCut 작업팩 ZIP 다운로드</button><button class="secondary-button" type="button" data-view="market">시장 레이더에서 다른 영상 찾기</button></div>
      <div class="pack-contents"><span>01 SRT 자막</span><span>02 보이스오버 TXT</span><span>03 샷리스트 CSV</span><span>04 제목·설명·태그</span><span>05 JSON 메타데이터</span><span>06 참고·권리 안내</span></div>
    </form>
    ${renderUploadPanel(state, draft)}
  </section>`;
}

function renderProduce(state: AppState): string {
  return `<main class="production-main">${state.productionDraft ? renderProductionWorkbench(state, state.productionDraft) : renderPackSourceList(state)}</main>`;
}

function focusBadge(focus: CalendarEntry['focus']): string {
  return { reach: '도달', retention: '유지', engagement: '반응', conversion: '전환' }[focus];
}

function renderLaunchForm(state: AppState): string {
  const inputs = state.launchInputs;
  return `<section class="launch-hero">
    <div class="hero-copy-block">
      <p class="eyebrow accent">SHORTS CHANNEL LAUNCH KIT</p>
      <h1>새 숏츠 채널을<br/><em>설계부터 30일까지.</em></h1>
      <p>니치와 주제를 고르면 채널 약속, 시각 규칙, 시리즈, 훅 라이브러리, 30일 발행 캘린더, 유지율 체크리스트를 한 번에 만듭니다. 20년차 숏츠 운영 원칙을 그대로 적용했습니다.</p>
    </div>
    <form id="launch-form" class="launch-form">
      <label><span>채널 니치</span><select name="nicheId">${NICHE_BLUEPRINTS.map((niche) => `<option value="${niche.id}" ${inputs.nicheId === niche.id ? 'selected' : ''}>${escapeHtml(niche.label)}</option>`).join('')}</select></label>
      <label><span>핵심 주제 · 키워드</span><input name="topic" value="${escapeHtml(inputs.topic)}" placeholder="예: 홈카페, 강아지 훈련, 엑셀" required /></label>
      <label><span>주간 발행 횟수</span><select name="cadencePerWeek">${[3, 5, 7].map((count) => `<option value="${count}" ${inputs.cadencePerWeek === count ? 'selected' : ''}>주 ${count}회</option>`).join('')}</select></label>
      <label><span>시작일</span><input name="startDateLocal" type="date" value="${escapeHtml(inputs.startDateLocal)}" /></label>
      <button class="primary-button" type="submit">런치 킷 생성</button>
    </form>
    <div class="niche-preview">${NICHE_BLUEPRINTS.map((niche) => `<article class="${inputs.nicheId === niche.id ? 'is-active' : ''}"><h3>${escapeHtml(niche.label)}</h3><p>${escapeHtml(niche.promise)}</p><small>${escapeHtml(niche.postingCadence)}</small></article>`).join('')}</div>
  </section>`;
}

function renderLaunchKit(kit: LaunchKit): string {
  return `<section class="launch-result">
    <header class="launch-result-head"><div><p class="eyebrow accent">LAUNCH BLUEPRINT / ${escapeHtml(kit.niche.label)}</p><h1>${escapeHtml(kit.channelPromise)}</h1><p>대상 시청자: ${escapeHtml(kit.niche.audience)} · 권장 수익화 경로: ${escapeHtml(kit.niche.monetizationPath)}</p></div><button class="quiet-button" id="launch-reset">다시 설계</button></header>

    <div class="launch-grid">
      <article class="launch-card"><p class="eyebrow">CHANNEL IDENTITY</p><h2>채널 시각 규칙</h2><ul>${kit.visualIdentity.map((rule) => `<li>${escapeHtml(rule)}</li>`).join('')}</ul></article>
      <article class="launch-card"><p class="eyebrow">FIRST WEEK</p><h2>첫 주 실행</h2><ol>${kit.firstWeekActions.map((action) => `<li>${escapeHtml(action)}</li>`).join('')}</ol></article>
    </div>

    <div class="dashboard-block">
      <div class="block-heading"><div><p class="eyebrow">SERIES SYSTEM</p><h2>반복 시리즈 설계</h2></div><span>단발 대신 시리즈로 구독 전환</span></div>
      <div class="series-grid">${kit.series.map((series) => `<article><h3>${escapeHtml(series.name)}</h3><p>${escapeHtml(series.premise)}</p><div class="series-meta"><span>패턴</span><b>${escapeHtml(series.episodePattern)}</b></div><div class="series-meta"><span>시각 규칙</span><b>${escapeHtml(series.visualRule)}</b></div><ul>${series.sampleEpisodes.map((episode) => `<li>${escapeHtml(episode)}</li>`).join('')}</ul></article>`).join('')}</div>
    </div>

    <div class="dashboard-block">
      <div class="block-heading"><div><p class="eyebrow">HOOK LIBRARY</p><h2>스크롤을 멈추는 훅</h2></div><span>첫 1~2초 설계</span></div>
      <div class="hook-grid">${kit.hooks.map((hook) => `<article><span class="hook-cat">${escapeHtml(hook.category)}</span><p class="hook-example">${escapeHtml(hook.example)}</p><p class="hook-why">${escapeHtml(hook.why)}</p></article>`).join('')}</div>
    </div>

    <div class="dashboard-block">
      <div class="block-heading"><div><p class="eyebrow">30-DAY CALENDAR</p><h2>발행 캘린더</h2></div><span>같은 시간대 일관 발행</span></div>
      <div class="calendar-head"><span>#</span><span>날짜</span><span>시리즈 · 작업 제목</span><span>훅</span><span>목표</span></div>
      <div class="calendar-rows">${kit.calendar.map((entry) => `<div class="calendar-row"><span class="cal-day">${String(entry.day).padStart(2, '0')}</span><span class="cal-date">${escapeHtml(entry.dateLabel)}</span><span class="cal-title"><b>${escapeHtml(entry.seriesName)}</b><small>${escapeHtml(entry.workingTitle)}</small></span><span class="cal-hook">${escapeHtml(entry.hook)}</span><span class="cal-focus focus--${entry.focus}">${focusBadge(entry.focus)}</span></div>`).join('')}</div>
    </div>

    <div class="launch-grid">
      <article class="launch-card"><p class="eyebrow">RETENTION</p><h2>영상마다 지킬 체크리스트</h2><div class="retention-list">${kit.retentionChecklist.map((check) => `<div><b>${escapeHtml(check.label)}</b><span>${escapeHtml(check.target)}</span><p>${escapeHtml(check.detail)}</p></div>`).join('')}</div></article>
      <article class="launch-card"><p class="eyebrow">WEEKLY REVIEW</p><h2>매주 회고 루프</h2><ol>${kit.weeklyReview.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ol></article>
    </div>

    <div class="launch-cta"><p>대본과 자막이 필요하면 <b>제작·예약</b> 탭에서 CapCut 작업팩을 만들고, 완성 영상을 예약 발행하세요.</p><button class="secondary-button" data-view="produce">제작·예약으로 이동</button></div>
  </section>`;
}

function renderLaunch(state: AppState): string {
  return `<main class="launch-main">${state.launchKit ? renderLaunchKit(state.launchKit) : renderLaunchForm(state)}</main>`;
}

function renderDashboard(state: AppState): string {
  const dataset = state.dataset;
  const analysis = state.analysis;
  if (!dataset || !analysis) return renderLanding(state);
  const sections: Array<[DashboardSection, string]> = [['overview', '진단 요약'], ['content', '콘텐츠 지도'], ['doctor', '영상 닥터'], ['plan', '7일 실행 계획']];
  const content = state.section === 'overview'
    ? renderOverview(dataset, analysis)
    : state.section === 'content'
      ? renderContent(state)
      : state.section === 'doctor'
        ? renderDoctor(state, dataset, analysis)
        : renderPlan(analysis);
  return `<main class="dashboard-main">
    ${renderProfile(dataset, analysis)}
    ${renderWarnings(dataset)}
    <nav class="section-tabs" aria-label="진단 섹션">${sections.map(([value, label]) => `<button class="${state.section === value ? 'is-active' : ''}" data-section="${value}">${label}</button>`).join('')}</nav>
    ${content}
  </main>`;
}

function marketCard(video: RankedShort): string {
  const link = `https://www.youtube.com/watch?v=${encodeURIComponent(video.videoId)}`;
  return `<article class="market-card">
    <span class="market-rank">${String(video.rank).padStart(2, '0')}</span>
    <img src="${safeUrl(video.thumbnailUrl)}" alt="${escapeHtml(video.title)} 썸네일"/>
    <div><p><span class="pulse-dot"></span>게시 후 평균 <b>${formatNumber(video.velocity)}/h</b></p><h3>${escapeHtml(video.title)}</h3><small>${escapeHtml(video.channelTitle)} · ${relativeDate(video.publishedAt)}</small><div class="market-metrics"><span>조회 <b>${formatNumber(video.views)}</b></span><span>반응 <b>${(video.engagementRate * 100).toFixed(1)}%</b></span><span>점수 <b>${video.score}</b></span></div></div>
    <div class="market-card-actions"><a href="${link}" target="_blank" rel="noopener noreferrer">원본 ↗</a>${video.durationSeconds > 0 && video.durationSeconds <= 60 ? `<button data-create-production="market" data-production-id="${escapeHtml(video.videoId)}">CapCut 팩</button>` : ''}</div>
  </article>`;
}

function renderMarket(state: AppState): string {
  return `<main class="market-main">
    <section class="market-hero"><p class="eyebrow accent">MARKET SIGNAL</p><h1>내 채널 밖의<br/><em>가속 신호</em>를 비교하세요.</h1><p>시장 레이더는 아이디어를 복사하는 목록이 아니라, 내 콘텐츠와 다른 주제·포장·속도를 비교하는 보조 도구입니다.</p></section>
    <form id="market-form" class="market-form">
      <label><span>국가</span><select name="region">${[['KR', '대한민국'], ['US', '미국'], ['JP', '일본'], ['GB', '영국']].map(([value, label]) => `<option value="${value}" ${state.marketFilters.region === value ? 'selected' : ''}>${label}</option>`).join('')}</select></label>
      <label><span>기간</span><select name="periodHours"><option value="24" ${state.marketFilters.periodHours === 24 ? 'selected' : ''}>24시간</option><option value="168" ${state.marketFilters.periodHours === 168 ? 'selected' : ''}>7일</option><option value="720" ${state.marketFilters.periodHours === 720 ? 'selected' : ''}>30일</option></select></label>
      <label class="market-query"><span>주제</span><input name="query" value="${escapeHtml(state.marketFilters.query)}" placeholder="예: AI, 요리, 운동"/></label>
      <button class="primary-button" type="submit" ${state.marketLoading ? 'disabled' : ''}>시장 스캔</button>
    </form>
    ${state.marketError ? `<div class="notice notice--warning">${escapeHtml(state.marketError)}</div>` : ''}
    <section class="market-list"><div class="block-heading"><div><p class="eyebrow">SURGE RANKING</p><h2>지금 가속 중인 영상</h2></div><span>OWNER OAUTH DATA</span></div>${state.marketVideos.length ? state.marketVideos.map(marketCard).join('') : '<div class="unavailable-panel market-empty"><strong>주제를 입력해 시장 스캔을 시작하세요</strong><p>현재 채널과 같은 시청자 관심사를 가진 최근 인기 영상을 Google 인증으로 검색합니다. 검색은 YouTube API 할당량을 사용합니다.</p></div>'}</section>
  </main>`;
}

function bindFileInput(root: HTMLElement, selector: string, actions: AppActions): void {
  root.querySelector<HTMLInputElement>(selector)?.addEventListener('change', (event) => {
    const files = [...((event.currentTarget as HTMLInputElement).files ?? [])];
    if (files.length) actions.onImportCsv(files);
  });
}

function bindActions(root: HTMLElement, actions: AppActions): void {
  root.querySelector('#brand-home')?.addEventListener('click', (event) => {
    event.preventDefault();
    actions.onNavigate('diagnosis');
  });
  root.querySelectorAll<HTMLButtonElement>('[data-view]').forEach((button) => button.addEventListener('click', () => {
    actions.onNavigate(button.dataset.view as AppState['view']);
  }));
  root.querySelector('#refresh-button')?.addEventListener('click', actions.onRefresh);
  root.querySelector('#google-disconnect-button')?.addEventListener('click', actions.onDisconnectGoogle);
  root.querySelector('#google-connect-button')?.addEventListener('click', actions.onConnectGoogle);
  root.querySelector('#add-channel-button')?.addEventListener('click', actions.onConnectGoogle);
  root.querySelector<HTMLSelectElement>('#channel-switcher')?.addEventListener('change', (event) => {
    actions.onSwitchChannel((event.currentTarget as HTMLSelectElement).value);
  });
  bindFileInput(root, '#dashboard-csv-input', actions);

  root.querySelectorAll<HTMLButtonElement>('[data-section]').forEach((button) => button.addEventListener('click', () => {
    actions.onSelectSection(button.dataset.section as DashboardSection);
  }));
  root.querySelector<HTMLSelectElement>('#content-filter')?.addEventListener('change', (event) => {
    actions.onSetContentFilter((event.currentTarget as HTMLSelectElement).value as AppState['contentFilter']);
  });
  root.querySelector<HTMLSelectElement>('#content-sort')?.addEventListener('change', (event) => {
    actions.onSetSort((event.currentTarget as HTMLSelectElement).value as AppState['sortBy']);
  });
  root.querySelectorAll<HTMLButtonElement>('[data-video-id]').forEach((button) => button.addEventListener('click', () => {
    actions.onSelectVideo(button.dataset.videoId ?? '');
  }));
  root.querySelector<HTMLSelectElement>('#doctor-video-select')?.addEventListener('change', (event) => {
    actions.onSelectVideo((event.currentTarget as HTMLSelectElement).value);
  });
  root.querySelector<HTMLButtonElement>('[data-load-benchmarks]')?.addEventListener('click', (event) => {
    actions.onLoadBenchmarks((event.currentTarget as HTMLButtonElement).dataset.loadBenchmarks ?? '');
  });
  root.querySelectorAll<HTMLButtonElement>('[data-create-production]').forEach((button) => button.addEventListener('click', () => {
    actions.onCreateProduction(
      button.dataset.createProduction as ProductionDraft['sourceType'],
      button.dataset.productionId ?? '',
    );
  }));
  root.querySelector<HTMLFormElement>('#production-form')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget as HTMLFormElement);
    actions.onDownloadProduction({
      title: String(data.get('title') ?? ''),
      description: String(data.get('description') ?? ''),
      tags: String(data.get('tags') ?? ''),
      script: String(data.get('script') ?? ''),
      rightsConfirmed: data.get('rightsConfirmed') === 'yes',
    });
  });
  root.querySelector<HTMLFormElement>('#market-form')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget as HTMLFormElement);
    actions.onMarketSearch({
      region: String(data.get('region')) as DashboardFilters['region'],
      periodHours: Number(data.get('periodHours')) as DashboardFilters['periodHours'],
      query: String(data.get('query') ?? ''),
    });
  });

  const publishModeInputs = root.querySelectorAll<HTMLInputElement>('input[name="publishMode"]');
  publishModeInputs.forEach((input) => input.addEventListener('change', () => {
    const scheduled = input.value === 'scheduled' && input.checked;
    root.querySelector('.schedule-field')?.classList.toggle('is-visible', scheduled);
    root.querySelector('.audit-confirm')?.classList.toggle('is-visible', scheduled);
  }));

  const uploadInput = root.querySelector<HTMLInputElement>('#youtube-video-file');
  uploadInput?.addEventListener('change', () => {
    const label = root.querySelector('#selected-video-name');
    if (label) label.textContent = uploadInput.files?.[0]?.name ?? 'MP4 / MOV / WebM 선택';
  });

  root.querySelector('#launch-reset')?.addEventListener('click', () => actions.onNavigate('launch'));
  root.querySelector<HTMLFormElement>('#launch-form')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget as HTMLFormElement);
    const cadence = Number(data.get('cadencePerWeek'));
    actions.onGenerateLaunchKit({
      nicheId: String(data.get('nicheId') ?? ''),
      topic: String(data.get('topic') ?? ''),
      cadencePerWeek: (cadence === 3 || cadence === 5 || cadence === 7 ? cadence : 5),
      startDateLocal: String(data.get('startDateLocal') ?? ''),
    });
  });
  root.querySelector<HTMLFormElement>('#youtube-upload-form')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget as HTMLFormElement);
    const fileEntry = data.get('videoFile');
    const file = fileEntry instanceof File && fileEntry.size > 0 ? fileEntry : null;
    actions.onPublishVideo(file, {
      title: String(data.get('publishTitle') ?? ''),
      description: String(data.get('publishDescription') ?? ''),
      tags: String(data.get('publishTags') ?? '').split(/[,\n]/).map((tag) => tag.replace(/^#/, '').trim()).filter(Boolean),
      scheduledAtLocal: String(data.get('scheduledAtLocal') ?? ''),
      madeForKids: data.get('madeForKids') === 'yes',
      containsSyntheticMedia: data.get('containsSyntheticMedia') === 'yes',
      mode: data.get('publishMode') === 'scheduled' ? 'scheduled' : 'private',
      auditConfirmed: data.get('auditConfirmed') === 'yes',
    }, data.get('uploadRightsConfirmed') === 'yes');
  });
}

export function renderApp(root: HTMLElement, state: AppState, actions: AppActions): void {
  const content = !state.dataset || !state.activeChannelId
    ? renderLanding(state)
    : state.view === 'market'
      ? renderMarket(state)
      : state.view === 'produce'
        ? renderProduce(state)
        : state.view === 'launch'
          ? renderLaunch(state)
          : renderDashboard(state);
  root.innerHTML = `<div class="noise"></div>${renderHeader(state)}${content}${renderFeedback(state)}<footer><span>${escapeHtml(state.config.appLabel)} © ${new Date().getFullYear()}</span><p>개인 Google 채널 세션은 현재 탭의 메모리에만 보관됩니다.</p></footer>`;
  bindActions(root, actions);
}
