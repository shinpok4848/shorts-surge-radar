import type {
  ChannelDataset,
  ChannelProfile,
  ChannelVideo,
  ContentKind,
  RetentionPoint,
  TrafficSource,
  VideoMetrics,
} from '../types';

const DATA_API_ROOT = 'https://www.googleapis.com/youtube/v3';
const ANALYTICS_API_ROOT = 'https://youtubeanalytics.googleapis.com/v2';
const MAX_UPLOADS = 2000;
const ANALYTICS_PAGE_SIZE = 200;
const ANALYTICS_MAX_PAGES = 10;

interface ApiErrorPayload {
  error?: { code?: number; message?: string; status?: string; errors?: Array<{ reason?: string }> };
}

interface ChannelItem {
  id: string;
  snippet: {
    title: string;
    description?: string;
    customUrl?: string;
    publishedAt?: string;
    thumbnails?: Record<string, { url: string }>;
  };
  statistics?: {
    subscriberCount?: string;
    viewCount?: string;
    videoCount?: string;
    hiddenSubscriberCount?: boolean;
  };
  contentDetails?: { relatedPlaylists?: { uploads?: string } };
  brandingSettings?: { image?: { bannerExternalUrl?: string } };
}

interface VideoItem {
  id: string;
  snippet: {
    channelId?: string;
    channelTitle?: string;
    title: string;
    description?: string;
    publishedAt: string;
    tags?: string[];
    categoryId?: string;
    thumbnails?: Record<string, { url: string }>;
  };
  contentDetails?: { duration?: string };
  statistics?: { viewCount?: string; likeCount?: string; commentCount?: string };
}

interface AnalyticsResponse extends ApiErrorPayload {
  columnHeaders?: Array<{ name: string; columnType?: string; dataType?: string }>;
  rows?: Array<Array<string | number>>;
}

interface AnalyticsVideoMetrics {
  views: number;
  watchTimeMinutes: number;
  averageViewDurationSeconds: number | null;
  averagePercentageViewed: number | null;
  subscribersGained: number;
  subscribersLost: number;
  likes: number;
  comments: number;
  shares: number;
}

export class OwnerDataError extends Error {
  constructor(message: string, public readonly code: string, public readonly status = 0) {
    super(message);
    this.name = 'OwnerDataError';
  }
}

function bestThumbnail(thumbnails?: Record<string, { url: string }>): string {
  if (!thumbnails) return '';
  return thumbnails.maxres?.url
    ?? thumbnails.standard?.url
    ?? thumbnails.high?.url
    ?? thumbnails.medium?.url
    ?? thumbnails.default?.url
    ?? '';
}

function toNumber(value: unknown): number | null {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseDuration(value?: string): number | null {
  if (!value) return null;
  const match = value.match(/^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!match) return null;
  return Number(match[1] ?? 0) * 86400
    + Number(match[2] ?? 0) * 3600
    + Number(match[3] ?? 0) * 60
    + Number(match[4] ?? 0);
}

function privateMetrics(): Omit<VideoMetrics, 'views' | 'lifetimeViews' | 'likes' | 'comments'> {
  return {
    shares: null,
    impressions: null,
    impressionClickThroughRate: null,
    watchTimeMinutes: null,
    averageViewDurationSeconds: null,
    averagePercentageViewed: null,
    subscribersGained: null,
    subscribersLost: null,
  };
}

function mapVideo(item: VideoItem): ChannelVideo {
  const durationSeconds = parseDuration(item.contentDetails?.duration);
  const contentKind: ContentKind = durationSeconds !== null && durationSeconds <= 180 ? 'short' : 'video';
  const lifetimeViews = toNumber(item.statistics?.viewCount);
  return {
    videoId: item.id,
    channelId: item.snippet.channelId,
    channelTitle: item.snippet.channelTitle,
    title: item.snippet.title,
    description: item.snippet.description ?? '',
    publishedAt: item.snippet.publishedAt,
    thumbnailUrl: bestThumbnail(item.snippet.thumbnails),
    durationSeconds,
    tags: item.snippet.tags ?? [],
    categoryId: item.snippet.categoryId,
    contentKind,
    contentKindConfidence: 'candidate',
    metrics: {
      views: lifetimeViews,
      lifetimeViews,
      likes: toNumber(item.statistics?.likeCount),
      comments: toNumber(item.statistics?.commentCount),
      ...privateMetrics(),
    },
    source: 'google-oauth',
  };
}

function mapChannel(item: ChannelItem): ChannelProfile {
  return {
    channelId: item.id,
    title: item.snippet.title,
    description: item.snippet.description ?? '',
    customUrl: item.snippet.customUrl,
    avatarUrl: bestThumbnail(item.snippet.thumbnails),
    bannerUrl: item.brandingSettings?.image?.bannerExternalUrl,
    subscribers: item.statistics?.hiddenSubscriberCount ? null : toNumber(item.statistics?.subscriberCount),
    totalViews: toNumber(item.statistics?.viewCount),
    videoCount: toNumber(item.statistics?.videoCount),
    publishedAt: item.snippet.publishedAt,
  };
}

function apiError(payload: ApiErrorPayload, status: number): OwnerDataError {
  const reason = payload.error?.errors?.[0]?.reason ?? payload.error?.status ?? 'GOOGLE_API_ERROR';
  if (status === 401) return new OwnerDataError('Google 연결이 만료되었습니다. 다시 연결해 주세요.', 'GOOGLE_SESSION_EXPIRED', status);
  if (reason === 'insufficientPermissions') {
    return new OwnerDataError('채널과 Analytics 읽기 권한이 모두 필요합니다.', 'INSUFFICIENT_PERMISSIONS', status);
  }
  if (reason === 'accessNotConfigured') {
    return new OwnerDataError('Google Cloud 프로젝트에서 YouTube Data API와 YouTube Analytics API를 활성화해 주세요.', 'API_NOT_ENABLED', status);
  }
  return new OwnerDataError(payload.error?.message ?? 'YouTube 소유자 데이터를 불러오지 못했습니다.', reason, status);
}

async function googleRequest<T extends ApiErrorPayload>(url: string, accessToken: string): Promise<T> {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
  });
  const payload = await response.json() as T;
  if (!response.ok || payload.error) throw apiError(payload, response.status);
  return payload;
}

async function dataRequest<T extends ApiErrorPayload>(
  path: string,
  params: Record<string, string>,
  accessToken: string,
): Promise<T> {
  const query = new URLSearchParams(params);
  return googleRequest<T>(`${DATA_API_ROOT}/${path}?${query.toString()}`, accessToken);
}

async function analyticsRequest(
  params: Record<string, string>,
  accessToken: string,
): Promise<AnalyticsResponse> {
  return googleRequest<AnalyticsResponse>(
    `${ANALYTICS_API_ROOT}/reports?${new URLSearchParams(params).toString()}`,
    accessToken,
  );
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function analysisRange(): { startDate: string; endDate: string } {
  const end = new Date();
  end.setUTCDate(end.getUTCDate() - 3);
  const start = new Date(end);
  start.setUTCFullYear(start.getUTCFullYear() - 1);
  start.setUTCDate(start.getUTCDate() + 1);
  return { startDate: isoDate(start), endDate: isoDate(end) };
}

async function myChannel(accessToken: string): Promise<ChannelItem> {
  const response = await dataRequest<ApiErrorPayload & { items?: ChannelItem[] }>('channels', {
    part: 'snippet,statistics,contentDetails,brandingSettings',
    mine: 'true',
  }, accessToken);
  const channel = response.items?.[0];
  if (!channel) throw new OwnerDataError('연결된 Google 계정에서 YouTube 채널을 찾지 못했습니다.', 'CHANNEL_NOT_FOUND');
  return channel;
}

async function allUploadIds(playlistId: string, accessToken: string): Promise<{ ids: string[]; truncated: boolean }> {
  const ids: string[] = [];
  let pageToken: string | undefined;
  do {
    const response = await dataRequest<ApiErrorPayload & {
      nextPageToken?: string;
      items?: Array<{ contentDetails?: { videoId?: string } }>;
    }>('playlistItems', {
      part: 'contentDetails',
      playlistId,
      maxResults: '50',
      ...(pageToken ? { pageToken } : {}),
    }, accessToken);
    for (const item of response.items ?? []) {
      const videoId = item.contentDetails?.videoId;
      if (videoId) ids.push(videoId);
      if (ids.length >= MAX_UPLOADS) break;
    }
    pageToken = response.nextPageToken;
  } while (pageToken && ids.length < MAX_UPLOADS);
  return { ids, truncated: Boolean(pageToken) };
}

async function ownedVideoDetails(ids: string[], accessToken: string): Promise<ChannelVideo[]> {
  const videos: ChannelVideo[] = [];
  for (let index = 0; index < ids.length; index += 50) {
    const response = await dataRequest<ApiErrorPayload & { items?: VideoItem[] }>('videos', {
      part: 'snippet,contentDetails,statistics',
      id: ids.slice(index, index + 50).join(','),
      maxResults: '50',
    }, accessToken);
    videos.push(...(response.items ?? []).map(mapVideo));
  }
  return videos;
}

function rowObject(response: AnalyticsResponse, row: Array<string | number>): Record<string, string | number> {
  return Object.fromEntries((response.columnHeaders ?? []).map((header, index) => [header.name, row[index]]));
}

async function videoAnalytics(
  accessToken: string,
  range: { startDate: string; endDate: string },
): Promise<Map<string, AnalyticsVideoMetrics>> {
  const result = new Map<string, AnalyticsVideoMetrics>();
  for (let page = 0; page < ANALYTICS_MAX_PAGES; page += 1) {
    const response = await analyticsRequest({
      ids: 'channel==MINE',
      startDate: range.startDate,
      endDate: range.endDate,
      dimensions: 'video',
      metrics: [
        'views', 'estimatedMinutesWatched', 'averageViewDuration', 'averageViewPercentage',
        'subscribersGained', 'subscribersLost', 'likes', 'comments', 'shares',
      ].join(','),
      sort: '-views',
      maxResults: String(ANALYTICS_PAGE_SIZE),
      startIndex: String(page * ANALYTICS_PAGE_SIZE + 1),
    }, accessToken);
    const rows = response.rows ?? [];
    for (const row of rows) {
      const value = rowObject(response, row);
      const videoId = String(value.video ?? '');
      if (!videoId) continue;
      result.set(videoId, {
        views: toNumber(value.views) ?? 0,
        watchTimeMinutes: toNumber(value.estimatedMinutesWatched) ?? 0,
        averageViewDurationSeconds: toNumber(value.averageViewDuration),
        averagePercentageViewed: toNumber(value.averageViewPercentage),
        subscribersGained: toNumber(value.subscribersGained) ?? 0,
        subscribersLost: toNumber(value.subscribersLost) ?? 0,
        likes: toNumber(value.likes) ?? 0,
        comments: toNumber(value.comments) ?? 0,
        shares: toNumber(value.shares) ?? 0,
      });
    }
    if (rows.length < ANALYTICS_PAGE_SIZE) break;
  }
  return result;
}

async function trafficAnalytics(
  accessToken: string,
  range: { startDate: string; endDate: string },
): Promise<TrafficSource[]> {
  try {
    const response = await analyticsRequest({
      ids: 'channel==MINE',
      startDate: range.startDate,
      endDate: range.endDate,
      dimensions: 'insightTrafficSourceType',
      metrics: 'views,estimatedMinutesWatched',
      sort: '-views',
      maxResults: '25',
    }, accessToken);
    return (response.rows ?? []).map((row) => {
      const value = rowObject(response, row);
      return {
        source: String(value.insightTrafficSourceType ?? 'UNKNOWN'),
        views: toNumber(value.views) ?? 0,
        watchTimeMinutes: toNumber(value.estimatedMinutesWatched),
      };
    });
  } catch {
    return [];
  }
}

function mergeAnalytics(
  videos: ChannelVideo[],
  analytics: Map<string, AnalyticsVideoMetrics>,
): ChannelVideo[] {
  return videos.map((video) => {
    const period = analytics.get(video.videoId);
    if (!period) {
      return {
        ...video,
        metrics: {
          ...video.metrics,
          views: 0,
          likes: 0,
          comments: 0,
          shares: 0,
          watchTimeMinutes: 0,
          averageViewDurationSeconds: null,
          averagePercentageViewed: null,
          subscribersGained: 0,
          subscribersLost: 0,
        },
      };
    }
    return {
      ...video,
      metrics: {
        ...video.metrics,
        views: period.views,
        likes: period.likes,
        comments: period.comments,
        shares: period.shares,
        watchTimeMinutes: period.watchTimeMinutes,
        averageViewDurationSeconds: period.averageViewDurationSeconds,
        averagePercentageViewed: period.averagePercentageViewed,
        subscribersGained: period.subscribersGained,
        subscribersLost: period.subscribersLost,
      },
    };
  });
}

export async function fetchOwnedChannelDataset(accessToken: string): Promise<ChannelDataset> {
  const channel = await myChannel(accessToken);
  const uploads = channel.contentDetails?.relatedPlaylists?.uploads;
  if (!uploads) throw new OwnerDataError('내 채널의 업로드 목록을 찾지 못했습니다.', 'UPLOADS_NOT_AVAILABLE');

  const [uploadResult, range] = await Promise.all([
    allUploadIds(uploads, accessToken),
    Promise.resolve(analysisRange()),
  ]);
  const videos = await ownedVideoDetails(uploadResult.ids, accessToken);
  const [analytics, trafficSources] = await Promise.all([
    videoAnalytics(accessToken, range),
    trafficAnalytics(accessToken, range),
  ]);

  return {
    source: 'google-oauth',
    fetchedAt: new Date().toISOString(),
    dateRange: range,
    channel: mapChannel(channel),
    videos: mergeAnalytics(videos, analytics),
    trafficSources,
    benchmarks: [],
    truncated: uploadResult.truncated,
    warnings: [
      `영상 성과는 ${range.startDate}~${range.endDate} Analytics 기준이며 채널 누적 조회수와 기간이 다릅니다.`,
      'Analytics 최신 데이터는 처리 지연으로 최근 약 2~3일이 제외될 수 있습니다.',
      '노출수와 CTR이 필요하면 YouTube Studio CSV를 추가로 가져오세요.',
      '180초 이하 영상은 CSV의 콘텐츠 유형 증거가 없으면 쇼츠 후보로 표시됩니다.',
      ...(uploadResult.truncated ? [`최근 ${MAX_UPLOADS.toLocaleString('ko-KR')}개 업로드까지만 가져왔습니다.`] : []),
    ],
  };
}

export async function fetchAudienceRetention(
  accessToken: string,
  videoId: string,
  range = analysisRange(),
): Promise<RetentionPoint[]> {
  const response = await analyticsRequest({
    ids: 'channel==MINE',
    startDate: range.startDate,
    endDate: range.endDate,
    dimensions: 'elapsedVideoTimeRatio',
    metrics: 'audienceWatchRatio,relativeRetentionPerformance',
    filters: `video==${videoId}`,
  }, accessToken);
  return (response.rows ?? []).map((row) => {
    const value = rowObject(response, row);
    return {
      elapsedRatio: toNumber(value.elapsedVideoTimeRatio) ?? 0,
      audienceWatchRatio: toNumber(value.audienceWatchRatio) ?? 0,
      relativeRetentionPerformance: toNumber(value.relativeRetentionPerformance),
    };
  });
}
