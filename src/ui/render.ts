import type { AppState, DashboardFilters, RankedShort } from '../types';

export interface AppActions {
  onOpenSettings: () => void;
  onSaveApiKey: (apiKey: string) => void;
  onClearApiKey: () => void;
  onRefresh: () => void;
  onApplyFilters: (filters: DashboardFilters) => void;
}

const numberFormatter = new Intl.NumberFormat('ko-KR', { notation: 'compact', maximumFractionDigits: 1 });
const fullNumberFormatter = new Intl.NumberFormat('ko-KR');
const relativeFormatter = new Intl.RelativeTimeFormat('ko', { numeric: 'auto' });

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  })[character] ?? character);
}

function relativeTime(timestamp: number): string {
  const diffMinutes = Math.round((timestamp - Date.now()) / 60_000);
  if (Math.abs(diffMinutes) < 60) return relativeFormatter.format(diffMinutes, 'minute');
  return relativeFormatter.format(Math.round(diffMinutes / 60), 'hour');
}

function duration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
}

function originalScriptBrief(video: RankedShort): string {
  const subject = video.title.replace(/[#|]/g, ' ').trim();
  return [
    `0–3초 · 질문/결과 선공개: “${subject}—왜 지금 주목받을까요?”`,
    '3–15초 · 직접 확인한 맥락과 핵심 사실 1개를 제시',
    '15–40초 · 내 사례·실험·해설로 차별화한 전개',
    '40–55초 · 결과와 배운 점을 한 문장으로 정리',
    '55–60초 · 시청자의 경험을 묻는 자연스러운 질문',
  ].join('\n');
}

function videoCard(video: RankedShort): string {
  const videoUrl = video.isDemo ? '#' : `https://www.youtube.com/shorts/${encodeURIComponent(video.videoId)}`;
  const quality = video.dataQuality === 'observed' ? '5분 실측' : '게시 후 평균 추정';
  const tags = video.tags.slice(0, 8).map((tag) => `<span>#${escapeHtml(tag.replace(/^#/, ''))}</span>`).join('');
  const delta = video.dataQuality === 'observed'
    ? `+${numberFormatter.format(video.viewDelta)}회`
    : `${numberFormatter.format(video.velocity)}/시간`;

  return `
    <article class="video-card ${video.rank <= 3 ? 'video-card--top' : ''}">
      <div class="rank-block">
        <span class="rank-label">RANK</span>
        <strong>${String(video.rank).padStart(2, '0')}</strong>
        <div class="score-ring" style="--score:${video.score}" aria-label="급상승 점수 ${video.score}점">
          <span>${video.score}</span>
        </div>
      </div>
      <a class="thumb-wrap ${video.isDemo ? 'is-demo' : ''}" href="${videoUrl}" ${video.isDemo ? 'aria-disabled="true"' : 'target="_blank" rel="noopener noreferrer"'}>
        <img src="${escapeHtml(video.thumbnailUrl)}" alt="${escapeHtml(video.title)} 썸네일" loading="lazy" />
        <span class="duration">${duration(video.durationSeconds)}</span>
        <span class="play-icon" aria-hidden="true">▶</span>
      </a>
      <div class="video-main">
        <div class="card-kicker"><span class="pulse-dot"></span>${quality} <b>${delta}</b></div>
        <h2>${escapeHtml(video.title)}</h2>
        <p class="channel">${escapeHtml(video.channelTitle)} · ${relativeTime(Date.parse(video.publishedAt))}</p>
        <div class="metrics">
          <div><span>조회수</span><strong>${numberFormatter.format(video.views)}</strong></div>
          <div><span>시간당 속도</span><strong>${numberFormatter.format(video.velocity)}</strong></div>
          <div><span>반응률</span><strong>${(video.engagementRate * 100).toFixed(1)}%</strong></div>
        </div>
        <div class="tags">${tags || '<span>#태그없음</span>'}</div>
        <details>
          <summary>콘텐츠 브리프 · 대본 가이드 보기 <span>＋</span></summary>
          <div class="brief-grid">
            <section>
              <p class="eyebrow">원본 내용 요약</p>
              <p>${escapeHtml(video.description.slice(0, 420) || '영상 설명이 제공되지 않았습니다.')}</p>
            </section>
            <section>
              <p class="eyebrow">독창적 대본 가이드</p>
              <pre>${escapeHtml(originalScriptBrief(video))}</pre>
            </section>
          </div>
          <div class="caption-note">
            <strong>${video.hasCaptions ? '자막 트랙 감지됨' : '공개 자막 미감지'}</strong>
            실제 자막 원문은 영상 소유자 OAuth 권한 없이는 공식 API로 제공되지 않습니다. 원본을 재편집하기보다 사실을 재검증하고 직접 촬영·해설한 새 영상으로 제작하세요.
          </div>
        </details>
      </div>
      <div class="card-action">
        ${video.isDemo
          ? '<span class="demo-link">DEMO</span>'
          : `<a href="${videoUrl}" target="_blank" rel="noopener noreferrer">원본 보기 <span>↗</span></a>`}
        <small>${fullNumberFormatter.format(video.likes)} 좋아요</small>
      </div>
    </article>
  `;
}

function emptyState(state: AppState): string {
  if (state.loading) {
    return `<div class="empty-state"><div class="loader"></div><h2>급상승 신호를 스캔하고 있습니다</h2><p>YouTube 후보 영상과 최신 통계를 불러오는 중입니다.</p></div>`;
  }
  if (state.error) {
    return `<div class="empty-state error-state"><span>!</span><h2>데이터를 불러오지 못했습니다</h2><p>${escapeHtml(state.error)}</p><button class="primary-button" id="retry-button">다시 시도</button></div>`;
  }
  return `<div class="empty-state"><h2>조건에 맞는 쇼츠가 없습니다</h2><p>검색어나 기간을 넓혀 다시 확인해 보세요.</p></div>`;
}

export function renderApp(root: HTMLElement, state: AppState, actions: AppActions): void {
  const topThreeViews = state.videos.slice(0, 3).reduce((sum, video) => sum + video.views, 0);
  const averageVelocity = state.videos.length
    ? state.videos.reduce((sum, video) => sum + video.velocity, 0) / state.videos.length
    : 0;

  root.innerHTML = `
    <div class="noise"></div>
    <header class="site-header">
      <a class="brand" href="#" aria-label="Shorts Pulse 홈">
        <span class="brand-mark">ϟ</span>
        <span><strong>SHORTS</strong><b>PULSE</b></span>
      </a>
      <div class="header-status">
        <span class="live-pill"><i></i>${state.mode === 'live' ? 'LIVE API' : 'DEMO FEED'}</span>
        <span class="desktop-only">통계 5분 · 후보 1시간 자동 갱신</span>
      </div>
      <button class="icon-button" id="settings-button" aria-label="API 설정">API 설정 <span>⚙</span></button>
    </header>

    <main>
      <section class="hero">
        <div>
          <p class="eyebrow accent">CREATOR INTELLIGENCE / ${state.filters.region}</p>
          <h1>다음 바이럴을<br/><em>숫자로 먼저</em> 발견하세요.</h1>
          <p class="hero-copy">조회수 스냅샷을 5분 간격으로 비교해, 지금 가속 중인 쇼츠를 우선순위로 정렬합니다.</p>
        </div>
        <div class="hero-orbit" aria-hidden="true">
          <div class="orbit orbit-1"></div><div class="orbit orbit-2"></div>
          <span class="orbit-core">ϟ</span>
          <span class="signal signal-a">+184%</span><span class="signal signal-b">VPH</span>
        </div>
      </section>

      ${state.mode === 'demo' ? `
        <aside class="demo-banner">
          <div><strong>현재 샘플 데이터입니다.</strong><span>YouTube API 키를 브라우저에 연결하면 실제 급상승 데이터를 확인할 수 있습니다.</span></div>
          <button id="connect-api-button">실시간 API 연결 →</button>
        </aside>` : ''}

      <section class="control-panel">
        <form id="filter-form">
          <label><span>국가</span><select name="region">
            ${[['KR', '대한민국'], ['US', '미국'], ['JP', '일본'], ['GB', '영국']].map(([value, label]) => `<option value="${value}" ${state.filters.region === value ? 'selected' : ''}>${label}</option>`).join('')}
          </select></label>
          <label><span>게시 기간</span><select name="periodHours">
            <option value="24" ${state.filters.periodHours === 24 ? 'selected' : ''}>최근 24시간</option>
            <option value="168" ${state.filters.periodHours === 168 ? 'selected' : ''}>최근 7일</option>
            <option value="720" ${state.filters.periodHours === 720 ? 'selected' : ''}>최근 30일</option>
          </select></label>
          <label class="search-field"><span>주제 키워드</span><input name="query" value="${escapeHtml(state.filters.query)}" placeholder="예: AI, 요리, 운동 (비우면 전체)" /></label>
          <button class="primary-button" type="submit">레이더 스캔</button>
        </form>
        <button class="refresh-button" id="refresh-button" ${state.loading ? 'disabled' : ''}><span class="refresh-icon">↻</span> 지금 갱신</button>
      </section>

      <section class="stat-strip">
        <div><span>감지 영상</span><strong>${state.videos.length}</strong><small>SHORTS</small></div>
        <div><span>TOP 3 누적 조회</span><strong>${numberFormatter.format(topThreeViews)}</strong><small>VIEWS</small></div>
        <div><span>평균 확산 속도</span><strong>${numberFormatter.format(averageVelocity)}</strong><small>VIEWS / H</small></div>
        <div><span>마지막 신호</span><strong>${state.lastUpdatedAt ? relativeTime(state.lastUpdatedAt) : '대기'}</strong><small id="countdown" data-next="${state.nextStatsRefreshAt ?? ''}">${state.nextStatsRefreshAt ? '다음 갱신 계산 중' : 'API 연결 필요'}</small></div>
      </section>

      <section class="radar-heading">
        <div><p class="eyebrow">SURGE RANKING</p><h2>지금 가속 중인 쇼츠</h2></div>
        <div class="legend"><span><i class="observed"></i>5분 실측</span><span><i></i>게시 후 평균 추정</span></div>
      </section>

      <section class="video-list">
        ${state.videos.length ? state.videos.map(videoCard).join('') : emptyState(state)}
      </section>

      <section class="method-note">
        <span>01</span><div><strong>후보 탐색</strong><p>#shorts와 선택 주제를 기준으로 최대 50개 후보를 1시간마다 검색합니다.</p></div>
        <span>02</span><div><strong>속도 측정</strong><p>브라우저에 저장된 조회수 스냅샷을 비교해 시간당 증가량을 계산합니다.</p></div>
        <span>03</span><div><strong>우선순위</strong><p>증가 속도 55% · 최신성 23% · 반응률 17% · 실측 신뢰도 5%를 합산합니다.</p></div>
      </section>
    </main>

    <footer><span>SHORTS PULSE © ${new Date().getFullYear()}</span><p>트렌드는 참고하고, 창작은 새롭게. 원본 영상의 저작권과 YouTube 정책을 존중하세요.</p></footer>

    <dialog id="api-dialog">
      <form method="dialog" id="api-form">
        <button class="dialog-close" value="cancel" aria-label="닫기">×</button>
        <p class="eyebrow accent">LIVE DATA CONNECTION</p>
        <h2>YouTube API 연결</h2>
        <p>Google Cloud에서 YouTube Data API v3를 활성화한 뒤 API 키를 입력하세요. 키는 이 브라우저에만 저장되며 Google API 호출에만 사용됩니다.</p>
        <label><span>API KEY</span><input id="api-key-input" type="password" autocomplete="off" placeholder="AIza..." /></label>
        <div class="dialog-actions">
          <button class="danger-button" type="button" id="clear-api-button">연결 해제</button>
          <button class="primary-button" type="submit">저장하고 실시간 시작</button>
        </div>
        <small>권장: HTTP 리퍼러를 이 사이트 주소로 제한한 별도 키를 사용하세요. 키를 GitHub 저장소에 커밋하지 않습니다.</small>
      </form>
    </dialog>
  `;

  const dialog = root.querySelector<HTMLDialogElement>('#api-dialog');
  const openDialog = () => dialog?.showModal();
  root.querySelector('#settings-button')?.addEventListener('click', openDialog);
  root.querySelector('#connect-api-button')?.addEventListener('click', openDialog);
  root.querySelector('#refresh-button')?.addEventListener('click', actions.onRefresh);
  root.querySelector('#retry-button')?.addEventListener('click', actions.onRefresh);

  root.querySelector<HTMLFormElement>('#filter-form')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget as HTMLFormElement);
    actions.onApplyFilters({
      region: String(data.get('region')) as DashboardFilters['region'],
      periodHours: Number(data.get('periodHours')) as DashboardFilters['periodHours'],
      query: String(data.get('query') ?? ''),
    });
  });

  root.querySelector<HTMLFormElement>('#api-form')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const input = root.querySelector<HTMLInputElement>('#api-key-input');
    if (input?.value.trim()) {
      actions.onSaveApiKey(input.value);
      dialog?.close();
    } else {
      input?.focus();
    }
  });

  root.querySelector('#clear-api-button')?.addEventListener('click', () => {
    actions.onClearApiKey();
    dialog?.close();
  });
}

export function updateCountdown(root: HTMLElement): void {
  const element = root.querySelector<HTMLElement>('#countdown');
  const target = Number(element?.dataset.next ?? 0);
  if (!element || !target) return;
  const seconds = Math.max(0, Math.ceil((target - Date.now()) / 1000));
  const minutes = Math.floor(seconds / 60);
  element.textContent = `NEXT IN ${String(minutes).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}
