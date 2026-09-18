import type {
  AnalyzedVideo,
  AppState,
  ChannelAnalysis,
  ChannelDataset,
  ContentKind,
  DashboardFilters,
  DashboardSection,
  Diagnosis,
  MetricScore,
  RankedShort,
} from '../types';

export interface AppActions {
  onNavigate: (view: AppState['view']) => void;
  onPublicAudit: (channelUrl: string) => void;
  onConnectGoogle: () => void;
  onDisconnectGoogle: () => void;
  onImportCsv: (files: File[]) => void;
  onLoadDemo: () => void;
  onReset: () => void;
  onSelectSection: (section: DashboardSection) => void;
  onSelectVideo: (videoId: string) => void;
  onSetContentFilter: (filter: AppState['contentFilter']) => void;
  onSetSort: (sort: AppState['sortBy']) => void;
  onLoadBenchmarks: (videoId: string) => void;
  onMarketSearch: (filters: DashboardFilters) => void;
}

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
  return {
    demo: 'DEMO DATA',
    'public-api': 'PUBLIC AUDIT',
    'google-oauth': 'OWNER ANALYTICS',
    'studio-csv': 'STUDIO CSV',
  }[dataset.source];
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
  return `
    <header class="site-header">
      <a class="brand" href="#" id="brand-home" aria-label="Channel Pulse 홈">
        <span class="brand-mark">ϟ</span>
        <span><strong>CHANNEL</strong><b>PULSE</b></span>
      </a>
      <nav class="top-nav" aria-label="주요 메뉴">
        <button class="${state.view === 'diagnosis' ? 'is-active' : ''}" data-view="diagnosis">내 채널 진단</button>
        <button class="${state.view === 'market' ? 'is-active' : ''}" data-view="market">시장 레이더</button>
      </nav>
      <div class="header-actions">
        ${state.googleConnected ? '<button class="connection-dot" id="google-disconnect-button" title="Google 연결 해제"><i></i>Google 연결됨 <span>×</span></button>' : ''}
        ${state.analysis ? '<button class="quiet-button" id="reset-button">새 진단</button>' : '<span class="header-caption">CREATOR INTELLIGENCE</span>'}
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

function configStatus(configured: boolean, ready: string, pending: string): string {
  return `<span class="config-status ${configured ? 'is-ready' : ''}"><i></i>${configured ? ready : pending}</span>`;
}

function renderLanding(state: AppState): string {
  const publicReady = Boolean(state.config.publicApiBaseUrl);
  const oauthReady = Boolean(state.config.googleOAuthClientId);
  return `
    <main class="landing-main">
      <section class="diagnosis-hero">
        <div class="hero-copy-block">
          <p class="eyebrow accent">CHANNEL INTELLIGENCE / HYBRID AUDIT</p>
          <h1>링크 하나에서<br/><em>다음 성장 행동</em>까지.</h1>
          <p>모든 공개 업로드를 영상과 쇼츠 후보로 나누고, 실제 Analytics 또는 Studio CSV를 합쳐 무엇을 왜 바꿔야 하는지 우선순위로 설명합니다.</p>
          <div class="trust-row"><span>측정값</span><span>공개값</span><span>추정값 구분</span><span>CSV는 브라우저에서만 처리</span></div>
        </div>
        <div class="hero-score-preview" aria-hidden="true">
          <div class="preview-orbit orbit-a"></div><div class="preview-orbit orbit-b"></div>
          <span class="preview-score">78<small>CHANNEL SCORE</small></span>
          <span class="preview-chip chip-one">CTR +1.8%</span>
          <span class="preview-chip chip-two">RETENTION</span>
        </div>
      </section>

      <section class="entry-section">
        <div class="section-heading">
          <div><p class="eyebrow">START YOUR AUDIT</p><h2>원하는 깊이로 시작하세요</h2></div>
          <button class="text-button" id="demo-button">샘플 진단 먼저 보기 <span>↗</span></button>
        </div>
        <div class="entry-grid">
          <article class="entry-card entry-card--primary">
            <div class="entry-number">01</div>
            ${configStatus(publicReady, '공개 진단 준비됨', '서버 설정 필요')}
            <span class="entry-icon">↗</span>
            <h3>채널 링크 빠른 진단</h3>
            <p>로그인 없이 공개 영상, 조회 속도, 반응률, 제목·태그 구조를 채널 평균과 비교합니다.</p>
            <form id="channel-url-form" class="channel-url-form">
              <label><span>YOUTUBE CHANNEL URL</span><input name="channelUrl" type="url" placeholder="https://youtube.com/@channel" required /></label>
              <button class="primary-button" type="submit">공개 채널 분석</button>
            </form>
            <small>실제 노출·CTR·유지율은 공개되지 않으므로 추정하지 않습니다.</small>
          </article>

          <article class="entry-card">
            <div class="entry-number">02</div>
            ${configStatus(oauthReady, 'Google 연결 준비됨', 'OAuth 설정 필요')}
            <span class="entry-icon google-icon">G</span>
            <h3>내 채널 정밀 연결</h3>
            <p>채널 소유자가 승인하면 최근 365일 시청 시간, 평균 조회율, 구독 전환, 유입 경로를 함께 진단합니다.</p>
            <button class="secondary-button full-button" id="google-connect-button">Google로 내 채널 연결</button>
            <small>읽기 전용 권한만 요청하며 토큰은 메모리에만 보관됩니다.</small>
          </article>

          <article class="entry-card drop-card" id="csv-drop-zone">
            <div class="entry-number">03</div>
            ${configStatus(true, '지금 사용 가능', '')}
            <span class="entry-icon">⇧</span>
            <h3>Studio CSV 가져오기</h3>
            <p>노출수, CTR, 평균 조회율이 포함된 고급 모드 표 CSV를 로컬에서 분석합니다.</p>
            <label class="drop-label" for="studio-csv-input"><strong>CSV를 놓거나 선택</strong><span>여러 표 CSV 동시 선택 가능 · ZIP은 압축 해제</span></label>
            <input id="studio-csv-input" class="visually-hidden" type="file" accept=".csv,text/csv" multiple />
            <small>파일 내용은 서버로 전송되지 않습니다. <a class="sample-link" href="./sample-studio.csv" download>샘플 CSV 받기</a></small>
          </article>
        </div>
      </section>

      <section class="method-grid">
        <div><span>01</span><strong>모든 콘텐츠 지도</strong><p>영상과 쇼츠 후보를 같은 기준이 아닌 포맷별 중앙값으로 비교합니다.</p></div>
        <div><span>02</span><strong>원인 기반 진단</strong><p>노출·클릭·유지·반응·구독 중 어느 구간이 막혔는지 분리합니다.</p></div>
        <div><span>03</span><strong>바로 쓰는 처방</strong><p>제목 3안, 썸네일 문구, 첫 훅, 영상 구성을 일주일 행동 계획으로 제공합니다.</p></div>
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
      <div class="overall-copy"><p class="eyebrow accent">DIAGNOSIS SUMMARY</p><h2>${analysis.overallScore >= 75 ? '성공 패턴을 확장할 단계입니다.' : analysis.overallScore >= 55 ? '성장 신호는 있습니다. 병목을 먼저 고치세요.' : '업로드 양보다 기초 구조 개선이 먼저입니다.'}</h2><p>공개 조회수만으로 노출을 단정하지 않고, 확보된 지표 안에서 클릭 포장·시청 유지·전환을 분리해 계산했습니다.</p></div>
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

function videoLink(video: AnalyzedVideo, dataset: ChannelDataset): string {
  if (dataset.source === 'demo' || video.videoId.startsWith('csv-')) return '';
  return `https://www.youtube.com/watch?v=${encodeURIComponent(video.videoId)}`;
}

function renderDoctor(state: AppState, dataset: ChannelDataset, analysis: ChannelAnalysis): string {
  const selected = analysis.videos.find((video) => video.videoId === state.selectedVideoId) ?? analysis.videos[0];
  if (!selected) return '<section class="empty-state"><h2>진단할 영상이 없습니다.</h2></section>';
  const link = videoLink(selected, dataset);
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
      </section>

      <section class="dashboard-block benchmark-block">
        <div class="block-heading"><div><p class="eyebrow">RELATED WINNERS</p><h2>연관 인기 영상 비교</h2></div>${dataset.source !== 'demo' ? `<button class="text-button" data-load-benchmarks="${escapeHtml(selected.videoId)}">현재 주제로 비교 불러오기 ↻</button>` : '<span>SAMPLE BENCHMARK</span>'}</div>
        ${dataset.benchmarks.length ? `<div class="benchmark-grid">${dataset.benchmarks.slice(0, 6).map((video, index) => `<article><span>${String(index + 1).padStart(2, '0')}</span><img src="${safeUrl(video.thumbnailUrl)}" alt=""/><div><small>${escapeHtml(video.channelTitle ?? '연관 채널')}</small><h3>${escapeHtml(video.title)}</h3><p>조회 ${formatNumber(video.metrics.views)} · ${video.contentKind === 'short' ? '쇼츠 후보' : '일반 영상'}</p></div></article>`).join('')}</div><p class="benchmark-note">비교 영상 평균 조회 ${formatNumber(benchmarkAverage)}. 조회수 차이만 따라가지 말고 제목의 약속, 도입 증거, 영상 길이의 차이를 새 사례에 적용하세요.</p>` : '<div class="unavailable-panel"><strong>비교 데이터가 아직 없습니다</strong><p>진단 서버가 연결되면 선택한 영상의 핵심 주제로 관련 인기 영상을 불러옵니다.</p></div>'}
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
  const link = video.isDemo ? '' : `https://www.youtube.com/shorts/${encodeURIComponent(video.videoId)}`;
  return `<article class="market-card">
    <span class="market-rank">${String(video.rank).padStart(2, '0')}</span>
    <img src="${safeUrl(video.thumbnailUrl)}" alt="${escapeHtml(video.title)} 썸네일"/>
    <div><p><span class="pulse-dot"></span>${video.dataQuality === 'observed' ? '실측 증가' : '게시 후 평균'} <b>${formatNumber(video.velocity)}/h</b></p><h3>${escapeHtml(video.title)}</h3><small>${escapeHtml(video.channelTitle)} · ${relativeDate(video.publishedAt)}</small><div class="market-metrics"><span>조회 <b>${formatNumber(video.views)}</b></span><span>반응 <b>${(video.engagementRate * 100).toFixed(1)}%</b></span><span>점수 <b>${video.score}</b></span></div></div>
    ${link ? `<a href="${link}" target="_blank" rel="noopener noreferrer">원본 ↗</a>` : '<em>DEMO</em>'}
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
    <section class="market-list"><div class="block-heading"><div><p class="eyebrow">SURGE RANKING</p><h2>지금 가속 중인 영상</h2></div><span>${state.config.publicApiBaseUrl ? 'LIVE PUBLIC DATA' : 'DEMO SIGNALS'}</span></div>${state.marketVideos.map(marketCard).join('')}</section>
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
  root.querySelector('#reset-button')?.addEventListener('click', actions.onReset);
  root.querySelector('#google-disconnect-button')?.addEventListener('click', actions.onDisconnectGoogle);
  root.querySelector('#demo-button')?.addEventListener('click', actions.onLoadDemo);
  root.querySelector('#google-connect-button')?.addEventListener('click', actions.onConnectGoogle);
  root.querySelector<HTMLFormElement>('#channel-url-form')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget as HTMLFormElement);
    actions.onPublicAudit(String(data.get('channelUrl') ?? ''));
  });
  bindFileInput(root, '#studio-csv-input', actions);
  bindFileInput(root, '#dashboard-csv-input', actions);

  const dropZone = root.querySelector<HTMLElement>('#csv-drop-zone');
  dropZone?.addEventListener('dragover', (event) => { event.preventDefault(); dropZone.classList.add('is-dragging'); });
  dropZone?.addEventListener('dragleave', () => dropZone.classList.remove('is-dragging'));
  dropZone?.addEventListener('drop', (event) => {
    event.preventDefault();
    dropZone.classList.remove('is-dragging');
    const files = [...(event.dataTransfer?.files ?? [])];
    if (files.length) actions.onImportCsv(files);
  });

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
  root.querySelector<HTMLFormElement>('#market-form')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget as HTMLFormElement);
    actions.onMarketSearch({
      region: String(data.get('region')) as DashboardFilters['region'],
      periodHours: Number(data.get('periodHours')) as DashboardFilters['periodHours'],
      query: String(data.get('query') ?? ''),
    });
  });
}

export function renderApp(root: HTMLElement, state: AppState, actions: AppActions): void {
  root.innerHTML = `<div class="noise"></div>${renderHeader(state)}${state.view === 'market' ? renderMarket(state) : renderDashboard(state)}${renderFeedback(state)}<footer><span>CHANNEL PULSE © ${new Date().getFullYear()}</span><p>측정값과 추정값을 구분합니다. 트렌드는 참고하고 창작은 새롭게.</p></footer>`;
  bindActions(root, actions);
}
