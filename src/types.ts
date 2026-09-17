export type RegionCode = 'KR' | 'US' | 'JP' | 'GB';
export type PeriodHours = 24 | 168 | 720;

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
  isDemo?: boolean;
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

export interface AppState {
  mode: 'demo' | 'live';
  loading: boolean;
  error: string | null;
  filters: DashboardFilters;
  videos: RankedShort[];
  lastUpdatedAt: number | null;
  nextStatsRefreshAt: number | null;
  nextCandidateSearchAt: number | null;
}
