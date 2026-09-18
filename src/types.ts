export type DataSource = 'google-oauth' | 'studio-csv';
export type DataBasis = 'measured' | 'public' | 'inferred' | 'unavailable';
export type ContentKind = 'short' | 'video';
export type ContentKindConfidence = 'verified' | 'candidate';
export type DiagnosisPriority = 'critical' | 'high' | 'medium' | 'opportunity';
export type AppView = 'diagnosis' | 'market' | 'produce' | 'launch';
export type DashboardSection = 'overview' | 'content' | 'doctor' | 'plan';

export interface NicheBlueprint {
  id: string;
  label: string;
  promise: string;
  audience: string;
  formats: string[];
  hookAngles: string[];
  keywords: string[];
  postingCadence: string;
  monetizationPath: string;
}

export interface HookTemplate {
  category: string;
  pattern: string;
  example: string;
  why: string;
}

export interface SeriesConcept {
  name: string;
  premise: string;
  episodePattern: string;
  visualRule: string;
  sampleEpisodes: string[];
}

export interface CalendarEntry {
  day: number;
  dateLabel: string;
  seriesName: string;
  workingTitle: string;
  hook: string;
  focus: 'reach' | 'retention' | 'engagement' | 'conversion';
  cta: string;
  trendTie?: string;
  inferredStructure?: string;
}

export interface RetentionCheck {
  label: string;
  target: string;
  detail: string;
}

export interface TrendSignal {
  title: string;
  channelTitle: string;
  keyword: string;
  velocityPerHour: number;
  views: number;
  videoId: string;
}

export interface TrendTopicCandidate {
  topic: string;
  score: number;
  confidence: 'high' | 'medium' | 'exploratory';
  supportCount: number;
  distinctChannels: number;
  evidenceTitles: string[];
}

export interface TrendStructureCandidate {
  id: 'numbered' | 'mistake-fix' | 'before-after' | 'explainer' | 'contrast-reaction';
  label: string;
  score: number;
  supportCount: number;
  evidenceTitles: string[];
}

export interface MarketLaunchInsights {
  primaryTopic: string;
  confidence: 'high' | 'medium' | 'exploratory';
  recommendedNicheId: string;
  topics: TrendTopicCandidate[];
  structures: TrendStructureCandidate[];
  analyzedVideos: number;
  distinctChannels: number;
  generatedAt: string;
}

export interface LaunchKit {
  niche: NicheBlueprint;
  channelPromise: string;
  regionLabel: string;
  marketInsights: MarketLaunchInsights;
  visualIdentity: string[];
  series: SeriesConcept[];
  hooks: HookTemplate[];
  calendar: CalendarEntry[];
  retentionChecklist: RetentionCheck[];
  weeklyReview: string[];
  firstWeekActions: string[];
  trendSignals: TrendSignal[];
  trendPlaybook: string[];
  createdAt: string;
}

export interface LaunchInputs {
  nicheId: string;
  topic: string;
  cadencePerWeek: 3 | 5 | 7;
  startDateLocal: string;
}
export type RegionCode = 'KR' | 'US' | 'JP' | 'GB';
export type PeriodHours = 24 | 168 | 720;

export interface RuntimeConfig {
  googleOAuthClientId: string;
  appLabel: string;
}

export interface ConnectedChannel {
  channelId: string;
  title: string;
  customUrl?: string;
  avatarUrl: string;
  expiresAt: number;
}

export interface ProductionDraft {
  id: string;
  sourceType: 'owned' | 'market';
  sourceVideoId: string;
  sourceTitle: string;
  sourceChannelTitle: string;
  sourceThumbnailUrl: string;
  sourceUrl: string;
  targetDurationSeconds: number;
  title: string;
  description: string;
  tags: string[];
  script: string;
  shotDirections: string[];
  createdAt: string;
}

export interface PublishDraft {
  title: string;
  description: string;
  tags: string[];
  scheduledAtLocal: string;
  madeForKids: boolean;
  containsSyntheticMedia: boolean;
  mode: 'private' | 'scheduled';
  auditConfirmed: boolean;
}

export interface UploadState {
  fileName: string;
  fileSize: number;
  progress: number;
  phase: 'idle' | 'ready' | 'initializing' | 'uploading' | 'processing' | 'complete' | 'error';
  message: string;
  videoId: string | null;
}

export interface ChannelProfile {
  channelId: string;
  title: string;
  description: string;
  customUrl?: string;
  avatarUrl: string;
  bannerUrl?: string;
  subscribers: number | null;
  totalViews: number | null;
  videoCount: number | null;
  publishedAt?: string;
}

export interface VideoMetrics {
  views: number | null;
  lifetimeViews: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  impressions: number | null;
  impressionClickThroughRate: number | null;
  watchTimeMinutes: number | null;
  averageViewDurationSeconds: number | null;
  averagePercentageViewed: number | null;
  subscribersGained: number | null;
  subscribersLost: number | null;
}

export interface ChannelVideo {
  videoId: string;
  channelId?: string;
  channelTitle?: string;
  title: string;
  description: string;
  publishedAt: string;
  thumbnailUrl: string;
  durationSeconds: number | null;
  tags: string[];
  categoryId?: string;
  contentKind: ContentKind;
  contentKindConfidence: ContentKindConfidence;
  metrics: VideoMetrics;
  source: DataSource;
}

export interface TrafficSource {
  source: string;
  views: number;
  watchTimeMinutes: number | null;
}

export interface RetentionPoint {
  elapsedRatio: number;
  audienceWatchRatio: number;
  relativeRetentionPerformance: number | null;
}

export interface ChannelDataset {
  source: DataSource;
  fetchedAt: string;
  dateRange?: { startDate: string; endDate: string };
  channel: ChannelProfile;
  videos: ChannelVideo[];
  trafficSources: TrafficSource[];
  benchmarks: ChannelVideo[];
  truncated: boolean;
  warnings: string[];
}

export interface MetricScore {
  value: number | null;
  basis: DataBasis;
  label: string;
  detail: string;
}

export interface Diagnosis {
  id: string;
  priority: DiagnosisPriority;
  title: string;
  summary: string;
  evidence: string[];
  actions: string[];
  basis: DataBasis;
  videoId?: string;
}

export interface ScriptBeat {
  range: string;
  purpose: string;
  direction: string;
}

export interface VideoGuide {
  titleOptions: string[];
  thumbnailCopy: string[];
  thumbnailDirection: string;
  hookOptions: string[];
  structure: ScriptBeat[];
  supportingTags: string[];
}

export interface AnalyzedVideo extends ChannelVideo {
  rank: number;
  healthScore: number;
  velocityPerDay: number | null;
  engagementRate: number | null;
  netSubscribers: number | null;
  scores: {
    reach: MetricScore;
    packaging: MetricScore;
    retention: MetricScore;
    engagement: MetricScore;
    conversion: MetricScore;
  };
  diagnoses: Diagnosis[];
  guide: VideoGuide;
}

export interface FormatSummary {
  kind: ContentKind;
  count: number;
  views: number;
  medianViewsPerDay: number;
  medianEngagementRate: number | null;
  medianClickThroughRate: number | null;
  medianAveragePercentageViewed: number | null;
  topVideoId?: string;
}

export interface WeeklyAction {
  day: string;
  title: string;
  detail: string;
  outcome: string;
}

export interface ChannelAnalysis {
  overallScore: number;
  confidence: 'owner' | 'studio';
  metricCoverage: number;
  scores: {
    reach: MetricScore;
    packaging: MetricScore;
    retention: MetricScore;
    engagement: MetricScore;
    conversion: MetricScore;
    consistency: MetricScore;
  };
  formats: FormatSummary[];
  diagnoses: Diagnosis[];
  videos: AnalyzedVideo[];
  weeklyPlan: WeeklyAction[];
}

export interface AppNotice {
  tone: 'info' | 'success' | 'warning' | 'error';
  message: string;
}

export interface MarketSearchMeta {
  requestedLimit: number;
  candidateCount: number;
  displayedCount: number;
  pagesFetched: number;
  scannedAt: string;
}

export interface AppState {
  view: AppView;
  section: DashboardSection;
  loading: boolean;
  loadingMessage: string;
  error: string | null;
  notice: AppNotice | null;
  config: RuntimeConfig;
  dataset: ChannelDataset | null;
  analysis: ChannelAnalysis | null;
  selectedVideoId: string | null;
  contentFilter: 'all' | ContentKind;
  sortBy: 'health' | 'views' | 'recent';
  connectedChannels: ConnectedChannel[];
  activeChannelId: string | null;
  marketFilters: DashboardFilters;
  marketVideos: RankedShort[];
  marketLoading: boolean;
  marketError: string | null;
  marketPage: number;
  marketMeta: MarketSearchMeta | null;
  productionDraft: ProductionDraft | null;
  publishDraft: PublishDraft | null;
  upload: UploadState;
  launchInputs: LaunchInputs;
  launchKit: LaunchKit | null;
}

// Market radar types retained for the authenticated secondary trend view.
export interface DashboardFilters {
  region: RegionCode;
  periodHours: PeriodHours;
  query: string;
}

export interface VideoSnapshot {
  videoId: string;
  capturedAt: number;
  views: number;
}

export interface ShortsVideo {
  videoId: string;
  title: string;
  channelTitle: string;
  publishedAt: string;
  description: string;
  thumbnailUrl: string;
  durationSeconds: number;
  views: number;
  likes: number;
  comments: number;
  tags: string[];
  hasCaptions: boolean;
}

export interface RankedShort extends ShortsVideo {
  score: number;
  rank: number;
  velocity: number;
  viewDelta: number;
  engagementRate: number;
  dataQuality: 'observed' | 'estimated';
  previousCapturedAt?: number;
}

export interface CandidateCache {
  filtersKey: string;
  searchedAt: number;
  videos: ShortsVideo[];
}
