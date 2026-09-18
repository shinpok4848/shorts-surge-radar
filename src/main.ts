import './styles.css';
import { analyzeChannel } from './analytics/channel-diagnosis';
import { rankShorts } from './analytics/ranking';
import {
  activeGoogleSession,
  connectGoogleChannel,
  disconnectGoogleChannel,
  GoogleOAuthError,
} from './api/google-oauth';
import {
  fetchAuthenticatedMarketTrends,
  fetchOwnedChannelBenchmarks,
  fetchOwnedChannelDataset,
  OwnerDataError,
} from './api/youtube-owner';
import { importStudioCsvFiles, StudioCsvError } from './import/studio-csv';
import { assertTargetChannel, TargetChannelError } from './security/target-channel';
import type {
  AppState,
  ChannelDataset,
  ChannelVideo,
  DashboardFilters,
  RuntimeConfig,
  ShortsVideo,
} from './types';
import { renderApp } from './ui/render';

const root = document.querySelector<HTMLDivElement>('#app');
if (!root) throw new Error('App root was not found.');
const appRoot: HTMLDivElement = root;

function runtimeConfig(): RuntimeConfig {
  const config = window.__CHANNEL_PULSE_CONFIG__ ?? {};
  return {
    googleOAuthClientId: config.googleOAuthClientId?.trim() ?? '',
    targetChannelHandle: config.targetChannelHandle?.trim() || '@낭만구조대',
    targetChannelId: config.targetChannelId?.trim() ?? '',
  };
}

let state: AppState = {
  view: 'diagnosis',
  section: 'overview',
  loading: false,
  loadingMessage: '',
  error: null,
  notice: null,
  config: runtimeConfig(),
  dataset: null,
  analysis: null,
  selectedVideoId: null,
  contentFilter: 'all',
  sortBy: 'health',
  googleConnected: false,
  marketFilters: { region: 'KR', periodHours: 168, query: '' },
  marketVideos: [],
  marketLoading: false,
  marketError: null,
};

function update(patch: Partial<AppState>): void {
  state = { ...state, ...patch };
  render();
}

function showDataset(dataset: ChannelDataset, notice?: string): void {
  const analysis = analyzeChannel(dataset);
  update({
    dataset,
    analysis,
    selectedVideoId: analysis.videos[0]?.videoId ?? null,
    section: 'overview',
    contentFilter: 'all',
    sortBy: 'health',
    loading: false,
    loadingMessage: '',
    error: null,
    notice: notice ? { tone: 'success', message: notice } : null,
  });
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function errorMessage(error: unknown): string {
  if (error instanceof GoogleOAuthError
    || error instanceof OwnerDataError
    || error instanceof StudioCsvError
    || error instanceof TargetChannelError) return error.message;
  if (error instanceof TypeError) return 'Google 또는 YouTube 연결 상태를 확인한 뒤 다시 시도해 주세요.';
  return error instanceof Error ? error.message : '처리 중 알 수 없는 오류가 발생했습니다.';
}

async function fetchAndVerifyChannel(accessToken: string): Promise<ChannelDataset> {
  const dataset = await fetchOwnedChannelDataset(accessToken);
  assertTargetChannel(dataset.channel, state.config);
  return dataset;
}

async function connectOwnerChannel(): Promise<void> {
  update({ error: null, notice: null });
  try {
    const session = await connectGoogleChannel(state.config.googleOAuthClientId);
    update({ loading: true, loadingMessage: '낭만구조대 업로드와 Analytics를 결합하고 있습니다', googleConnected: true });
    const dataset = await fetchAndVerifyChannel(session.accessToken);
    showDataset(dataset, '낭만구조대 채널 인증과 정밀 진단이 완료됐습니다.');
  } catch (error) {
    if (error instanceof TargetChannelError) await disconnectGoogleChannel();
    update({
      loading: false,
      loadingMessage: '',
      googleConnected: false,
      dataset: null,
      analysis: null,
      error: errorMessage(error),
    });
  }
}

async function refreshOwnerChannel(): Promise<void> {
  const session = activeGoogleSession();
  if (!session) {
    await connectOwnerChannel();
    return;
  }
  update({ loading: true, loadingMessage: '낭만구조대 최신 데이터를 다시 불러오고 있습니다', error: null, notice: null });
  try {
    const dataset = await fetchAndVerifyChannel(session.accessToken);
    showDataset(dataset, '채널 데이터를 최신 상태로 갱신했습니다.');
  } catch (error) {
    update({ loading: false, loadingMessage: '', error: errorMessage(error) });
  }
}

async function disconnectOwnerChannel(): Promise<void> {
  await disconnectGoogleChannel();
  update({
    view: 'diagnosis',
    section: 'overview',
    googleConnected: false,
    dataset: null,
    analysis: null,
    selectedVideoId: null,
    marketVideos: [],
    marketError: null,
    error: null,
    notice: { tone: 'info', message: 'Google 연결을 안전하게 해제했습니다.' },
  });
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function importCsv(files: File[]): Promise<void> {
  if (!state.dataset || !state.googleConnected) {
    update({ error: '먼저 Google로 낭만구조대 채널을 인증해 주세요.' });
    return;
  }
  update({ loading: true, loadingMessage: 'Studio CSV 지표를 낭만구조대 영상과 결합하고 있습니다', error: null, notice: null });
  try {
    const dataset = await importStudioCsvFiles(files, state.dataset);
    assertTargetChannel(dataset.channel, state.config);
    showDataset(dataset, `Studio CSV ${files.length}개를 현재 채널 데이터에 추가했습니다.`);
  } catch (error) {
    update({ loading: false, loadingMessage: '', error: errorMessage(error) });
  }
}

function benchmarkQuery(video: ChannelVideo): string {
  return video.title
    .replace(/[#|｜()[\]{}!?.,:;“”"']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .slice(0, 5)
    .join(' ');
}

async function loadBenchmarks(videoId: string): Promise<void> {
  const dataset = state.dataset;
  const video = dataset?.videos.find((item) => item.videoId === videoId);
  const session = activeGoogleSession();
  if (!dataset || !video) return;
  if (!session) {
    update({ error: 'Google 연결이 만료됐습니다. 다시 로그인해 주세요.' });
    return;
  }
  update({ loading: true, loadingMessage: '같은 주제의 연관 인기 영상을 비교하고 있습니다', error: null, notice: null });
  try {
    const benchmarks = await fetchOwnedChannelBenchmarks(
      session.accessToken,
      benchmarkQuery(video),
      dataset.channel.channelId,
      'KR',
    );
    const enriched = { ...dataset, benchmarks };
    update({
      dataset: enriched,
      analysis: analyzeChannel(enriched),
      selectedVideoId: videoId,
      loading: false,
      loadingMessage: '',
      notice: { tone: 'success', message: `연관 인기 영상 ${benchmarks.length}개를 비교에 추가했습니다.` },
    });
  } catch (error) {
    update({ loading: false, loadingMessage: '', error: errorMessage(error) });
  }
}

function marketVideo(video: ChannelVideo): ShortsVideo {
  return {
    videoId: video.videoId,
    title: video.title,
    channelTitle: video.channelTitle ?? 'YouTube 채널',
    publishedAt: video.publishedAt,
    description: video.description,
    thumbnailUrl: video.thumbnailUrl,
    durationSeconds: video.durationSeconds ?? 0,
    views: video.metrics.views ?? 0,
    likes: video.metrics.likes ?? 0,
    comments: video.metrics.comments ?? 0,
    tags: video.tags,
    hasCaptions: false,
  };
}

async function searchMarket(filters: DashboardFilters): Promise<void> {
  const session = activeGoogleSession();
  update({ marketFilters: filters, marketLoading: true, marketError: null, error: null, notice: null });
  if (!session || !state.googleConnected) {
    update({ marketLoading: false, marketError: 'Google 연결이 만료됐습니다. 다시 로그인해 주세요.' });
    return;
  }
  try {
    const videos = await fetchAuthenticatedMarketTrends(
      session.accessToken,
      filters.query || 'shorts',
      filters.region,
      filters.periodHours,
    );
    update({
      marketLoading: false,
      marketVideos: rankShorts(videos.map(marketVideo), new Map(), Date.now()),
      marketError: null,
    });
  } catch (error) {
    update({ marketLoading: false, marketError: errorMessage(error) });
  }
}

function render(): void {
  renderApp(appRoot, state, {
    onNavigate: (view) => update({ view, error: null, notice: null }),
    onConnectGoogle: () => void connectOwnerChannel(),
    onDisconnectGoogle: () => void disconnectOwnerChannel(),
    onImportCsv: (files) => void importCsv(files),
    onRefresh: () => void refreshOwnerChannel(),
    onSelectSection: (section) => update({ section, error: null, notice: null }),
    onSelectVideo: (videoId) => update({ selectedVideoId: videoId, section: 'doctor', error: null, notice: null }),
    onSetContentFilter: (contentFilter) => update({ contentFilter }),
    onSetSort: (sortBy) => update({ sortBy }),
    onLoadBenchmarks: (videoId) => void loadBenchmarks(videoId),
    onMarketSearch: (filters) => void searchMarket(filters),
  });
}

render();
