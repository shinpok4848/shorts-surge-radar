import './styles.css';
import { analyzeChannel } from './analytics/channel-diagnosis';
import { rankShorts } from './analytics/ranking';
import { connectGoogleChannel, disconnectGoogleChannel, GoogleOAuthError } from './api/google-oauth';
import { auditPublicChannel, loadMarketTrends, loadRelatedBenchmarks, PublicChannelApiError } from './api/public-channel';
import { fetchOwnedChannelDataset, OwnerDataError } from './api/youtube-owner';
import { createDemoChannelDataset } from './data/channel-demo';
import { createDemoVideos } from './data/demo';
import { importStudioCsvFiles, StudioCsvError } from './import/studio-csv';
import type { AppState, ChannelDataset, ChannelVideo, DashboardFilters, RankedShort, RuntimeConfig, ShortsVideo } from './types';
import { renderApp } from './ui/render';

const root = document.querySelector<HTMLDivElement>('#app');
if (!root) throw new Error('App root was not found.');
const appRoot: HTMLDivElement = root;

function runtimeConfig(): RuntimeConfig {
  const config = window.__CHANNEL_PULSE_CONFIG__ ?? {};
  return {
    publicApiBaseUrl: config.publicApiBaseUrl?.trim() ?? '',
    googleOAuthClientId: config.googleOAuthClientId?.trim() ?? '',
  };
}

function demoMarketVideos(): RankedShort[] {
  return rankShorts(createDemoVideos(), new Map(), Date.now());
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
  marketVideos: demoMarketVideos(),
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
  if (error instanceof PublicChannelApiError
    || error instanceof GoogleOAuthError
    || error instanceof OwnerDataError
    || error instanceof StudioCsvError) return error.message;
  if (error instanceof TypeError) return '네트워크 연결을 확인한 뒤 다시 시도해 주세요.';
  return error instanceof Error ? error.message : '처리 중 알 수 없는 오류가 발생했습니다.';
}

async function runPublicAudit(channelUrl: string): Promise<void> {
  const clean = channelUrl.trim();
  if (!clean) {
    update({ error: 'YouTube 채널 주소를 입력해 주세요.', notice: null });
    return;
  }
  update({ loading: true, loadingMessage: '공개 업로드와 성과 신호를 수집하고 있습니다', error: null, notice: null });
  try {
    const dataset = await auditPublicChannel(state.config.publicApiBaseUrl, clean);
    showDataset(dataset, `공개 영상 ${dataset.videos.length.toLocaleString('ko-KR')}개를 분석했습니다.`);
  } catch (error) {
    update({ loading: false, loadingMessage: '', error: errorMessage(error) });
  }
}

async function connectOwnerChannel(): Promise<void> {
  update({ error: null, notice: null });
  try {
    const session = await connectGoogleChannel(state.config.googleOAuthClientId);
    update({ loading: true, loadingMessage: '내 채널 업로드와 Analytics를 결합하고 있습니다', googleConnected: true });
    const dataset = await fetchOwnedChannelDataset(session.accessToken);
    showDataset(dataset, 'Google 채널 연결과 정밀 진단이 완료됐습니다.');
  } catch (error) {
    update({ loading: false, loadingMessage: '', error: errorMessage(error) });
  }
}

async function disconnectOwnerChannel(): Promise<void> {
  await disconnectGoogleChannel();
  update({ googleConnected: false, notice: { tone: 'info', message: 'Google 연결을 해제했습니다. 현재 화면의 분석 결과는 새 진단 전까지 유지됩니다.' } });
}

async function importCsv(files: File[]): Promise<void> {
  update({ loading: true, loadingMessage: 'Studio CSV 열을 인식하고 영상별 지표를 합치고 있습니다', error: null, notice: null });
  try {
    const base = state.dataset?.source === 'demo' ? null : state.dataset;
    const dataset = await importStudioCsvFiles(files, base);
    showDataset(dataset, `Studio CSV ${files.length}개를 브라우저에서 안전하게 분석했습니다.`);
  } catch (error) {
    update({ loading: false, loadingMessage: '', error: errorMessage(error) });
  }
}

function loadDemo(): void {
  showDataset(createDemoChannelDataset(), '샘플 데이터로 전체 진단 기능을 보여드리고 있습니다.');
}

function resetDiagnosis(): void {
  update({
    dataset: null,
    analysis: null,
    selectedVideoId: null,
    section: 'overview',
    error: null,
    notice: null,
  });
  window.scrollTo({ top: 0, behavior: 'smooth' });
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
  if (!dataset || !video) return;
  update({ loading: true, loadingMessage: '같은 주제의 연관 인기 영상을 비교하고 있습니다', error: null, notice: null });
  try {
    const benchmarks = await loadRelatedBenchmarks(
      state.config.publicApiBaseUrl,
      benchmarkQuery(video),
      dataset.channel.channelId,
      'KR',
    );
    const enriched = { ...dataset, benchmarks };
    const analysis = analyzeChannel(enriched);
    update({
      dataset: enriched,
      analysis,
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
  update({ marketFilters: filters, marketLoading: true, marketError: null, error: null, notice: null });
  if (!state.config.publicApiBaseUrl) {
    update({
      marketLoading: false,
      marketVideos: demoMarketVideos(),
      marketError: '공개 진단 서버가 연결되기 전까지 시장 레이더는 명시된 샘플 신호를 보여줍니다.',
    });
    return;
  }
  try {
    const videos = await loadMarketTrends(
      state.config.publicApiBaseUrl,
      filters.query || '#shorts',
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
    onPublicAudit: (channelUrl) => void runPublicAudit(channelUrl),
    onConnectGoogle: () => void connectOwnerChannel(),
    onDisconnectGoogle: () => void disconnectOwnerChannel(),
    onImportCsv: (files) => void importCsv(files),
    onLoadDemo: loadDemo,
    onReset: resetDiagnosis,
    onSelectSection: (section) => update({ section, error: null, notice: null }),
    onSelectVideo: (videoId) => update({ selectedVideoId: videoId, section: 'doctor', error: null, notice: null }),
    onSetContentFilter: (contentFilter) => update({ contentFilter }),
    onSetSort: (sortBy) => update({ sortBy }),
    onLoadBenchmarks: (videoId) => void loadBenchmarks(videoId),
    onMarketSearch: (filters) => void searchMarket(filters),
  });
}

render();
