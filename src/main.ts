import './styles.css';
import { fetchVideoDetails, searchShorts, YouTubeApiError } from './api/youtube';
import { rankShorts } from './analytics/ranking';
import { createDemoVideos } from './data/demo';
import {
  filtersKey,
  getApiKey,
  loadCandidateCache,
  loadFilters,
  previousSnapshots,
  recordSnapshots,
  saveApiKey,
  saveCandidateCache,
  saveFilters,
} from './storage/snapshots';
import type { AppState, DashboardFilters, ShortsVideo } from './types';
import { renderApp, updateCountdown } from './ui/render';

const STATS_REFRESH_MS = 5 * 60 * 1000;
const CANDIDATE_REFRESH_MS = 60 * 60 * 1000;
const DEFAULT_FILTERS: DashboardFilters = { region: 'KR', periodHours: 24, query: '' };
const root = document.querySelector<HTMLDivElement>('#app');

if (!root) throw new Error('App root was not found.');
const appRoot: HTMLDivElement = root;

let state: AppState = {
  mode: getApiKey() ? 'live' : 'demo',
  loading: false,
  error: null,
  filters: loadFilters(DEFAULT_FILTERS),
  videos: [],
  lastUpdatedAt: null,
  nextStatsRefreshAt: null,
  nextCandidateSearchAt: null,
};
let requestId = 0;
let inFlight = false;

function update(patch: Partial<AppState>): void {
  state = { ...state, ...patch };
  render();
}

function ranked(videos: ShortsVideo[], capturedAt: number) {
  const previous = previousSnapshots(videos.map((video) => video.videoId), capturedAt);
  const result = rankShorts(videos, previous, capturedAt);
  recordSnapshots(videos, capturedAt);
  return result;
}

function render(): void {
  renderApp(appRoot, state, {
    onOpenSettings: () => undefined,
    onSaveApiKey: (apiKey) => {
      saveApiKey(apiKey);
      update({ mode: 'live', error: null, videos: [] });
      void loadLive(true);
    },
    onClearApiKey: () => {
      saveApiKey('');
      update({ mode: 'demo', error: null });
      loadDemo();
    },
    onRefresh: () => {
      if (state.mode === 'live') void loadLive(false);
      else loadDemo();
    },
    onApplyFilters: (filters) => {
      saveFilters(filters);
      update({ filters, error: null });
      if (state.mode === 'live') void loadLive(true);
      else loadDemo();
    },
  });
  updateCountdown(appRoot);
}

function loadDemo(): void {
  requestId += 1;
  const capturedAt = Date.now();
  const videos = ranked(createDemoVideos(capturedAt), capturedAt);
  update({
    mode: 'demo',
    loading: false,
    error: null,
    videos,
    lastUpdatedAt: capturedAt,
    nextStatsRefreshAt: capturedAt + STATS_REFRESH_MS,
    nextCandidateSearchAt: null,
  });
}

function readableError(error: unknown): string {
  if (error instanceof YouTubeApiError) {
    if (error.reason === 'quotaExceeded' || error.reason === 'dailyLimitExceeded') {
      return '오늘의 YouTube API 할당량을 모두 사용했습니다. Google Cloud 할당량을 확인해 주세요.';
    }
    if (error.reason === 'keyInvalid' || error.reason === 'ipRefererBlocked') {
      return 'API 키가 유효하지 않거나 현재 사이트 주소가 허용되지 않았습니다.';
    }
    return error.message;
  }
  if (error instanceof TypeError) return '네트워크 연결 또는 API 키의 HTTP 리퍼러 제한을 확인해 주세요.';
  return error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';
}

async function loadLive(forceCandidateSearch: boolean): Promise<void> {
  const apiKey = getApiKey();
  if (!apiKey) {
    loadDemo();
    return;
  }
  if (inFlight) return;

  inFlight = true;
  const currentRequest = ++requestId;
  update({ mode: 'live', loading: true, error: null });

  try {
    const now = Date.now();
    const key = filtersKey(state.filters);
    const cache = loadCandidateCache();
    const cacheIsFresh = cache
      && cache.filtersKey === key
      && now - cache.searchedAt < CANDIDATE_REFRESH_MS
      && cache.videos.length > 0;

    let videos: ShortsVideo[];
    let searchedAt: number;
    if (!forceCandidateSearch && cacheIsFresh) {
      videos = await fetchVideoDetails(apiKey, cache.videos.map((video) => video.videoId));
      searchedAt = cache.searchedAt;
    } else {
      videos = await searchShorts(apiKey, state.filters);
      searchedAt = now;
    }

    if (currentRequest !== requestId) return;
    const capturedAt = Date.now();
    saveCandidateCache({ filtersKey: key, searchedAt, videos });
    update({
      mode: 'live',
      loading: false,
      error: null,
      videos: ranked(videos, capturedAt),
      lastUpdatedAt: capturedAt,
      nextStatsRefreshAt: capturedAt + STATS_REFRESH_MS,
      nextCandidateSearchAt: searchedAt + CANDIDATE_REFRESH_MS,
    });
  } catch (error) {
    if (currentRequest === requestId) {
      update({
        loading: false,
        error: readableError(error),
        videos: [],
        nextStatsRefreshAt: null,
        nextCandidateSearchAt: null,
      });
    }
  } finally {
    inFlight = false;
  }
}

render();
if (state.mode === 'live') void loadLive(false);
else loadDemo();

window.setInterval(() => {
  updateCountdown(appRoot);
  if (inFlight) return;
  const now = Date.now();
  if (state.mode === 'demo' && state.nextStatsRefreshAt && now >= state.nextStatsRefreshAt) {
    loadDemo();
  } else if (state.mode === 'live' && state.nextCandidateSearchAt && now >= state.nextCandidateSearchAt) {
    void loadLive(true);
  } else if (state.mode === 'live' && state.nextStatsRefreshAt && now >= state.nextStatsRefreshAt) {
    void loadLive(false);
  }
}, 1000);
