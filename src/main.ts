import './styles.css';
import { analyzeChannel } from './analytics/channel-diagnosis';
import { rankShorts } from './analytics/ranking';
import {
  connectGoogleChannel,
  GoogleOAuthError,
  type GoogleSession,
  isGoogleSessionActive,
  revokeGoogleSession,
} from './api/google-oauth';
import {
  fetchAuthenticatedMarketTrends,
  fetchOwnedChannelBenchmarks,
  fetchOwnedChannelDataset,
  OwnerDataError,
  uploadYouTubeVideo,
} from './api/youtube-owner';
import { importStudioCsvFiles, StudioCsvError } from './import/studio-csv';
import {
  createProductionDraft,
  downloadCapCutPackage,
  updateProductionDraft,
} from './export/capcut-package';
import {
  generateLaunchKit,
  inferMarketLaunchInsights,
  toTrendSignals,
} from './launch/launch-kit';
import { titleMatchesRegion } from './launch/region-language';
import type {
  AppState,
  ChannelDataset,
  ChannelVideo,
  ConnectedChannel,
  DashboardFilters,
  LaunchInputs,
  PublishDraft,
  ProductionDraft,
  RuntimeConfig,
  ShortsVideo,
} from './types';
import { renderApp } from './ui/render';

const root = document.querySelector<HTMLDivElement>('#app');
if (!root) throw new Error('App root was not found.');
const appRoot: HTMLDivElement = root;

const sessionsByChannel = new Map<string, GoogleSession>();
const datasetsByChannel = new Map<string, ChannelDataset>();
let marketRequestId = 0;

const DEFAULT_MARKET_FILTERS: DashboardFilters = { region: 'KR', periodHours: 168, query: '' };
const MARKET_PAGE_SIZE = 20;

function defaultLaunchInputs(): LaunchInputs {
  return {
    nicheId: 'how-to-fix',
    topic: '',
    cadencePerWeek: 5,
    startDateLocal: new Date(Date.now() + 86_400_000).toISOString().slice(0, 10),
  };
}

function emptyUploadState(): AppState['upload'] {
  return { fileName: '', fileSize: 0, progress: 0, phase: 'idle', message: '', videoId: null };
}

function runtimeConfig(): RuntimeConfig {
  const config = window.__CHANNEL_PULSE_CONFIG__ ?? {};
  return {
    googleOAuthClientId: config.googleOAuthClientId?.trim() ?? '',
    appLabel: config.appLabel?.trim() || 'MY CHANNEL PULSE',
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
  connectedChannels: [],
  activeChannelId: null,
  marketFilters: { ...DEFAULT_MARKET_FILTERS },
  marketVideos: [],
  marketLoading: false,
  marketError: null,
  marketPage: 1,
  marketMeta: null,
  productionDraft: null,
  publishDraft: null,
  upload: emptyUploadState(),
  launchInputs: defaultLaunchInputs(),
  launchKit: null,
};

function update(patch: Partial<AppState>): void {
  state = { ...state, ...patch };
  render();
}

function connectedSummary(dataset: ChannelDataset, session: GoogleSession): ConnectedChannel {
  return {
    channelId: dataset.channel.channelId,
    title: dataset.channel.title,
    customUrl: dataset.channel.customUrl,
    avatarUrl: dataset.channel.avatarUrl,
    expiresAt: session.expiresAt,
  };
}

function upsertConnectedChannel(channel: ConnectedChannel): ConnectedChannel[] {
  const others = state.connectedChannels.filter((item) => item.channelId !== channel.channelId);
  return [...others, channel].sort((a, b) => a.title.localeCompare(b.title, 'ko'));
}

function showDataset(dataset: ChannelDataset, notice?: string): void {
  marketRequestId += 1;
  const analysis = analyzeChannel(dataset);
  update({
    dataset,
    analysis,
    activeChannelId: dataset.channel.channelId,
    selectedVideoId: analysis.videos[0]?.videoId ?? null,
    section: 'overview',
    contentFilter: 'all',
    sortBy: 'health',
    loading: false,
    loadingMessage: '',
    marketVideos: [],
    marketError: null,
    marketPage: 1,
    marketMeta: null,
    productionDraft: null,
    publishDraft: null,
    upload: emptyUploadState(),
    launchInputs: defaultLaunchInputs(),
    launchKit: null,
    error: null,
    notice: notice ? { tone: 'success', message: notice } : null,
  });
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function errorMessage(error: unknown): string {
  if (error instanceof GoogleOAuthError
    || error instanceof OwnerDataError
    || error instanceof StudioCsvError) return error.message;
  if (error instanceof TypeError) return 'Google 또는 YouTube 연결 상태를 확인한 뒤 다시 시도해 주세요.';
  return error instanceof Error ? error.message : '처리 중 알 수 없는 오류가 발생했습니다.';
}

function activeSession(): GoogleSession | null {
  if (!state.activeChannelId) return null;
  const session = sessionsByChannel.get(state.activeChannelId);
  return isGoogleSessionActive(session) ? session : null;
}

async function connectOwnerChannel(): Promise<void> {
  update({ error: null, notice: null });
  try {
    const session = await connectGoogleChannel(state.config.googleOAuthClientId);
    update({ loading: true, loadingMessage: '선택한 채널의 업로드와 Analytics를 결합하고 있습니다' });
    const dataset = await fetchOwnedChannelDataset(session.accessToken);
    const channelId = dataset.channel.channelId;
    sessionsByChannel.set(channelId, session);
    datasetsByChannel.set(channelId, dataset);
    state = { ...state, connectedChannels: upsertConnectedChannel(connectedSummary(dataset, session)) };
    showDataset(dataset, `${dataset.channel.title} 채널을 개인 계정 목록에 추가했습니다.`);
  } catch (error) {
    update({ loading: false, loadingMessage: '', error: errorMessage(error) });
  }
}

function switchChannel(channelId: string): void {
  const dataset = datasetsByChannel.get(channelId);
  const session = sessionsByChannel.get(channelId);
  if (!dataset || !isGoogleSessionActive(session)) {
    update({
      error: '이 채널의 Google 연결이 만료됐습니다. 계정 추가 버튼으로 다시 연결해 주세요.',
      notice: null,
    });
    return;
  }
  showDataset(dataset, `${dataset.channel.title} 채널로 전환했습니다.`);
}

async function refreshOwnerChannel(): Promise<void> {
  const session = activeSession();
  if (!session) {
    update({ error: '현재 채널의 Google 연결이 만료됐습니다. 계정을 다시 연결해 주세요.' });
    return;
  }
  update({ loading: true, loadingMessage: '현재 채널의 최신 데이터를 다시 불러오고 있습니다', error: null, notice: null });
  try {
    const dataset = await fetchOwnedChannelDataset(session.accessToken);
    datasetsByChannel.set(dataset.channel.channelId, dataset);
    state = { ...state, connectedChannels: upsertConnectedChannel(connectedSummary(dataset, session)) };
    showDataset(dataset, '채널 데이터를 최신 상태로 갱신했습니다.');
  } catch (error) {
    update({ loading: false, loadingMessage: '', error: errorMessage(error) });
  }
}

async function disconnectActiveChannel(): Promise<void> {
  const channelId = state.activeChannelId;
  if (!channelId) return;
  await revokeGoogleSession(sessionsByChannel.get(channelId));
  sessionsByChannel.delete(channelId);
  datasetsByChannel.delete(channelId);
  const remaining = state.connectedChannels.filter((channel) => channel.channelId !== channelId);
  const next = remaining.find((channel) => isGoogleSessionActive(sessionsByChannel.get(channel.channelId)));
  if (next) {
    state = { ...state, connectedChannels: remaining };
    const nextDataset = datasetsByChannel.get(next.channelId);
    if (nextDataset) {
      showDataset(nextDataset, '선택한 채널 연결을 해제하고 다른 채널로 전환했습니다.');
      return;
    }
  }
  marketRequestId += 1;
  update({
    view: 'diagnosis',
    section: 'overview',
    connectedChannels: remaining,
    activeChannelId: null,
    dataset: null,
    analysis: null,
    selectedVideoId: null,
    marketFilters: { ...DEFAULT_MARKET_FILTERS },
    marketVideos: [],
    marketLoading: false,
    marketError: null,
    marketPage: 1,
    marketMeta: null,
    productionDraft: null,
    publishDraft: null,
    upload: emptyUploadState(),
    launchInputs: defaultLaunchInputs(),
    launchKit: null,
    error: null,
    notice: { tone: 'info', message: 'Google 채널 연결을 안전하게 해제했습니다.' },
  });
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function importCsv(files: File[]): Promise<void> {
  if (!state.dataset || !activeSession()) {
    update({ error: '먼저 CSV를 합칠 Google 채널을 연결해 주세요.' });
    return;
  }
  update({ loading: true, loadingMessage: 'Studio CSV 지표를 현재 채널 영상과 결합하고 있습니다', error: null, notice: null });
  try {
    const dataset = await importStudioCsvFiles(files, state.dataset);
    datasetsByChannel.set(dataset.channel.channelId, dataset);
    showDataset(dataset, `Studio CSV ${files.length}개를 ${dataset.channel.title} 데이터에 추가했습니다.`);
  } catch (error) {
    update({ loading: false, loadingMessage: '', error: errorMessage(error) });
  }
}

function benchmarkQuery(video: ChannelVideo): string {
  // Prefer the video's own tags (same-topic signal), then fall back to title keywords.
  const tagQuery = video.tags
    .map((tag) => tag.replace(/^#/, '').trim())
    .filter((tag) => tag.length >= 2)
    .slice(0, 3)
    .join(' ');
  if (tagQuery) return tagQuery;
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
  const session = activeSession();
  if (!dataset || !video) return;
  if (!session) {
    update({ error: '현재 채널의 Google 연결이 만료됐습니다.' });
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
    datasetsByChannel.set(dataset.channel.channelId, enriched);
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
  const session = activeSession();
  const requestId = ++marketRequestId;
  const channelId = state.activeChannelId;
  update({
    marketFilters: filters,
    marketLoading: true,
    marketError: null,
    marketPage: 1,
    marketMeta: null,
    launchKit: null,
    error: null,
    notice: null,
  });
  if (!session || !channelId) {
    update({ marketLoading: false, marketError: '현재 채널의 Google 연결이 만료됐습니다.' });
    return;
  }
  try {
    const result = await fetchAuthenticatedMarketTrends(
      session.accessToken,
      filters.query,
      filters.region,
      filters.periodHours,
    );
    if (requestId !== marketRequestId || state.activeChannelId !== channelId) return;

    const regionMatched = result.videos.filter((video) => titleMatchesRegion(video.title, filters.region));
    const shorts = regionMatched.filter((video) => (
      video.durationSeconds !== null
      && video.durationSeconds > 0
      && video.durationSeconds <= 60
    ));
    const ranked = rankShorts(shorts.map(marketVideo), new Map(), Date.now());
    const regionLabel = filters.region === 'KR' ? '대한민국' : filters.region;
    update({
      marketLoading: false,
      marketVideos: ranked,
      marketPage: 1,
      marketMeta: {
        requestedLimit: 200,
        candidateCount: result.candidateCount,
        displayedCount: ranked.length,
        pagesFetched: result.pagesFetched,
        scannedAt: new Date().toISOString(),
      },
      marketError: ranked.length
        ? ranked.length < 20
          ? `${regionLabel} 언어·60초 이하 조건을 통과한 영상이 ${ranked.length}개입니다. 한국어 주제어를 추가하거나 기간을 30일로 넓혀 보세요.`
          : null
        : `${regionLabel} 언어·60초 이하 조건에 맞는 영상이 없습니다. 검색어 또는 기간을 바꿔 주세요.`,
    });
  } catch (error) {
    if (requestId !== marketRequestId) return;
    update({ marketLoading: false, marketError: errorMessage(error) });
  }
}

function startProduction(sourceType: ProductionDraft['sourceType'], videoId: string): void {
  const source = sourceType === 'market'
    ? state.marketVideos.find((video) => video.videoId === videoId)
    : state.analysis?.videos.find((video) => video.videoId === videoId);
  if (!source) {
    update({ error: '작업팩을 만들 원본 항목을 찾지 못했습니다.' });
    return;
  }
  if (sourceType === 'market' && (!source.durationSeconds || source.durationSeconds > 60)) {
    update({ error: '시장 참고 작업팩은 60초 이하 영상만 지원합니다.' });
    return;
  }
  const newDraft = createProductionDraft(source, sourceType);
  update({
    view: 'produce',
    productionDraft: newDraft,
    publishDraft: {
      title: newDraft.title,
      description: newDraft.description,
      tags: newDraft.tags,
      scheduledAtLocal: '',
      madeForKids: false,
      containsSyntheticMedia: false,
      mode: 'private',
      auditConfirmed: false,
    },
    upload: emptyUploadState(),
    error: null,
    notice: { tone: 'info', message: '참고 구조를 바탕으로 새 원본 대본 초안을 만들었습니다. 다운로드 전에 직접 편집해 주세요.' },
  });
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function downloadProduction(fields: {
  title: string;
  description: string;
  tags: string;
  script: string;
  rightsConfirmed: boolean;
}): void {
  const draft = state.productionDraft;
  if (!draft) return;
  if (!fields.rightsConfirmed) {
    update({ error: '직접 제작하거나 사용 권한이 있는 자료만 사용한다는 확인이 필요합니다.' });
    return;
  }
  try {
    const updatedDraft = updateProductionDraft(draft, fields);
    if (!updatedDraft.title || !updatedDraft.script) throw new Error('제목과 대본을 모두 입력해 주세요.');
    const filename = downloadCapCutPackage(updatedDraft);
    update({
      productionDraft: updatedDraft,
      publishDraft: {
        title: updatedDraft.title,
        description: updatedDraft.description,
        tags: updatedDraft.tags,
        scheduledAtLocal: '',
        madeForKids: false,
        containsSyntheticMedia: false,
        mode: 'private',
        auditConfirmed: false,
      },
      error: null,
      notice: { tone: 'success', message: `${filename} 다운로드를 시작했습니다. CapCut Desktop/Web에서 SRT를 가져오세요.` },
    });
  } catch (error) {
    update({ error: errorMessage(error) });
  }
}

async function publishVideo(file: File | null, draft: PublishDraft, rightsConfirmed: boolean): Promise<void> {
  const session = activeSession();
  if (!session) {
    update({ error: '현재 채널의 Google 연결이 만료됐습니다. 계정을 다시 연결해 주세요.' });
    return;
  }
  if (!file) {
    update({ error: '업로드할 완성 영상 파일을 선택해 주세요.' });
    return;
  }
  if (!rightsConfirmed) {
    update({ error: '영상·음원·대본의 권리 보유와 최종 확인 체크가 필요합니다.' });
    return;
  }

  update({
    publishDraft: draft,
    error: null,
    notice: null,
    upload: {
      fileName: file.name,
      fileSize: file.size,
      progress: 1,
      phase: 'initializing',
      message: '업로드 세션을 준비하고 있습니다',
      videoId: null,
    },
  });

  try {
    const result = await uploadYouTubeVideo(session.accessToken, file, draft, (progress) => {
      update({
        upload: {
          ...state.upload,
          progress,
          phase: 'uploading',
          message: '영상을 YouTube로 전송하고 있습니다',
        },
      });
    });
    const scheduledNote = draft.mode === 'scheduled'
      ? result.scheduledAccepted
        ? '예약 공개 시각이 적용됐습니다.'
        : 'API 프로젝트 제한으로 비공개로 업로드됐습니다. YouTube Studio에서 공개 예약을 완료하세요.'
      : '비공개로 업로드됐습니다. YouTube Studio에서 검토 후 공개하세요.';
    update({
      upload: {
        fileName: file.name,
        fileSize: file.size,
        progress: 100,
        phase: 'complete',
        message: `업로드 완료 · ${scheduledNote}`,
        videoId: result.videoId,
      },
      notice: { tone: 'success', message: `“${result.title}” 업로드가 끝났습니다. ${scheduledNote}` },
    });
  } catch (error) {
    update({
      upload: {
        fileName: file.name,
        fileSize: file.size,
        progress: 0,
        phase: 'error',
        message: errorMessage(error),
        videoId: null,
      },
      error: errorMessage(error),
    });
  }
}

function buildLaunchKit(inputs: LaunchInputs): void {
  const insights = inferMarketLaunchInsights(
    state.marketVideos,
    state.marketFilters.region,
    inputs.topic || state.marketFilters.query,
  );
  const effectiveTopic = inputs.topic.trim() || insights.primaryTopic;
  if (!effectiveTopic) {
    update({ launchInputs: inputs, error: '시장 레이더를 먼저 실행하거나 핵심 주제를 입력해 주세요.' });
    return;
  }
  const startDateLocal = inputs.startDateLocal || new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
  const normalized: LaunchInputs = { ...inputs, topic: effectiveTopic, startDateLocal };
  try {
    const trendSignals = toTrendSignals(state.marketVideos, state.marketFilters.region);
    const launchKit = generateLaunchKit(
      normalized,
      state.marketFilters.region,
      trendSignals,
      insights,
    );
    const trendNote = trendSignals.length
      ? `“${insights.primaryTopic}”을 ${insights.confidence} 신뢰도로 선정하고, 성과 구조 ${insights.structures.length}개를 반영했습니다.`
      : '시장 레이더를 먼저 실행하면 반복 주제와 성과 구조를 자동 기획합니다.';
    update({
      launchInputs: normalized,
      launchKit,
      error: null,
      notice: { tone: 'success', message: `숏츠 채널 런치 킷을 만들었습니다. ${trendNote}` },
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch (error) {
    update({ launchInputs: normalized, error: errorMessage(error) });
  }
}

function launchFromMarket(): void {
  if (!state.marketVideos.length) {
    update({ view: 'market', error: '먼저 시장 스캔을 실행해 트렌드 데이터를 만들어 주세요.' });
    return;
  }
  const insights = inferMarketLaunchInsights(
    state.marketVideos,
    state.marketFilters.region,
    state.marketFilters.query,
  );
  const inputs: LaunchInputs = {
    ...state.launchInputs,
    topic: insights.primaryTopic,
    nicheId: insights.recommendedNicheId,
  };
  state = { ...state, view: 'launch', launchInputs: inputs, launchKit: null };
  buildLaunchKit(inputs);
}

function produceFromLaunch(): void {
  // Send the user to the production source list where the same scanned trend videos appear.
  update({
    view: 'produce',
    productionDraft: null,
    publishDraft: null,
    upload: emptyUploadState(),
    error: null,
    notice: state.marketVideos.length
      ? { tone: 'info', message: '지금 뜨는 트렌드 영상에서 원본 작업팩을 만들어 보세요.' }
      : { tone: 'warning', message: '시장 레이더를 먼저 실행하면 트렌드 영상이 제작 소스로 채워집니다.' },
  });
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function resetMarket(): void {
  marketRequestId += 1;
  update({
    marketFilters: { ...DEFAULT_MARKET_FILTERS },
    marketVideos: [],
    marketLoading: false,
    marketError: null,
    marketPage: 1,
    marketMeta: null,
    launchInputs: defaultLaunchInputs(),
    launchKit: null,
    productionDraft: null,
    publishDraft: null,
    upload: emptyUploadState(),
    error: null,
    notice: { tone: 'info', message: '시장 검색과 연결된 런치·제작 데이터를 초기화했습니다.' },
  });
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function resetLaunch(): void {
  update({
    launchInputs: defaultLaunchInputs(),
    launchKit: null,
    productionDraft: null,
    publishDraft: null,
    upload: emptyUploadState(),
    error: null,
    notice: { tone: 'info', message: '런치 기획을 초기화했습니다. 시장 데이터는 유지됩니다.' },
  });
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function setMarketPage(page: number): void {
  const pages = Math.max(1, Math.ceil(state.marketVideos.length / MARKET_PAGE_SIZE));
  update({ marketPage: Math.min(pages, Math.max(1, page)), error: null, notice: null });
  document.querySelector('.market-list')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function render(): void {
  renderApp(appRoot, state, {
    onNavigate: (view) => update({ view, error: null, notice: null }),
    onConnectGoogle: () => void connectOwnerChannel(),
    onDisconnectGoogle: () => void disconnectActiveChannel(),
    onSwitchChannel: switchChannel,
    onImportCsv: (files) => void importCsv(files),
    onRefresh: () => void refreshOwnerChannel(),
    onSelectSection: (section) => update({ section, error: null, notice: null }),
    onSelectVideo: (videoId) => update({ selectedVideoId: videoId, section: 'doctor', error: null, notice: null }),
    onSetContentFilter: (contentFilter) => update({ contentFilter }),
    onSetSort: (sortBy) => update({ sortBy }),
    onLoadBenchmarks: (videoId) => void loadBenchmarks(videoId),
    onMarketSearch: (filters) => void searchMarket(filters),
    onCreateProduction: startProduction,
    onDownloadProduction: downloadProduction,
    onPublishVideo: (file, draft, rightsConfirmed) => void publishVideo(file, draft, rightsConfirmed),
    onGenerateLaunchKit: buildLaunchKit,
    onLaunchFromMarket: launchFromMarket,
    onProduceFromLaunch: produceFromLaunch,
    onResetMarket: resetMarket,
    onResetLaunch: resetLaunch,
    onSetMarketPage: setMarketPage,
  });
}

render();
