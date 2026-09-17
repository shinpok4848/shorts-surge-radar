import type { DashboardFilters, ShortsVideo } from '../types';

const API_ROOT = 'https://www.googleapis.com/youtube/v3';
const MAX_SHORT_SECONDS = 180;

interface SearchResponse {
  items?: Array<{ id: { videoId?: string } }>;
  error?: { message?: string; errors?: Array<{ reason?: string }> };
}

interface VideosResponse {
  items?: YouTubeVideoItem[];
  error?: { message?: string; errors?: Array<{ reason?: string }> };
}

interface YouTubeVideoItem {
  id: string;
  snippet: {
    title: string;
    channelTitle: string;
    publishedAt: string;
    description?: string;
    tags?: string[];
    thumbnails?: Record<string, { url: string }>;
  };
  contentDetails: {
    duration: string;
    caption?: string;
  };
  statistics?: {
    viewCount?: string;
    likeCount?: string;
    commentCount?: string;
  };
}

export class YouTubeApiError extends Error {
  constructor(message: string, public readonly reason?: string) {
    super(message);
    this.name = 'YouTubeApiError';
  }
}

function languageForRegion(region: DashboardFilters['region']): string {
  return { KR: 'ko', US: 'en', JP: 'ja', GB: 'en' }[region];
}

function toNumber(value?: string): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseDuration(duration: string): number {
  const match = duration.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!match) return 0;
  return Number(match[1] ?? 0) * 3600 + Number(match[2] ?? 0) * 60 + Number(match[3] ?? 0);
}

function mapVideo(item: YouTubeVideoItem): ShortsVideo {
  const thumbnails = item.snippet.thumbnails ?? {};
  const thumbnailUrl = thumbnails.maxres?.url
    ?? thumbnails.standard?.url
    ?? thumbnails.high?.url
    ?? thumbnails.medium?.url
    ?? thumbnails.default?.url
    ?? '';

  return {
    videoId: item.id,
    title: item.snippet.title,
    channelTitle: item.snippet.channelTitle,
    publishedAt: item.snippet.publishedAt,
    description: item.snippet.description ?? '',
    thumbnailUrl,
    durationSeconds: parseDuration(item.contentDetails.duration),
    views: toNumber(item.statistics?.viewCount),
    likes: toNumber(item.statistics?.likeCount),
    comments: toNumber(item.statistics?.commentCount),
    tags: item.snippet.tags ?? [],
    hasCaptions: item.contentDetails.caption === 'true',
  };
}

async function request<T extends SearchResponse | VideosResponse>(path: string, params: URLSearchParams): Promise<T> {
  const response = await fetch(`${API_ROOT}/${path}?${params.toString()}`);
  const payload = await response.json() as T;

  if (!response.ok || payload.error) {
    const reason = payload.error?.errors?.[0]?.reason;
    const fallback = response.status === 403
      ? 'API 키 권한 또는 YouTube Data API 할당량을 확인해 주세요.'
      : 'YouTube 데이터를 불러오지 못했습니다.';
    throw new YouTubeApiError(payload.error?.message ?? fallback, reason);
  }

  return payload;
}

export async function fetchVideoDetails(apiKey: string, ids: string[]): Promise<ShortsVideo[]> {
  if (ids.length === 0) return [];

  const chunks: string[][] = [];
  for (let index = 0; index < ids.length; index += 50) chunks.push(ids.slice(index, index + 50));

  const results = await Promise.all(chunks.map(async (chunk) => {
    const params = new URLSearchParams({
      key: apiKey,
      part: 'snippet,contentDetails,statistics',
      id: chunk.join(','),
      maxResults: '50',
    });
    const response = await request<VideosResponse>('videos', params);
    return (response.items ?? []).map(mapVideo);
  }));

  return results.flat().filter((video) => video.durationSeconds > 0 && video.durationSeconds <= MAX_SHORT_SECONDS);
}

export async function searchShorts(apiKey: string, filters: DashboardFilters): Promise<ShortsVideo[]> {
  const publishedAfter = new Date(Date.now() - filters.periodHours * 60 * 60 * 1000).toISOString();
  const topic = filters.query.trim();
  const query = topic ? `${topic} #shorts` : '#shorts';
  const params = new URLSearchParams({
    key: apiKey,
    part: 'snippet',
    type: 'video',
    videoDuration: 'short',
    order: 'viewCount',
    maxResults: '50',
    regionCode: filters.region,
    relevanceLanguage: languageForRegion(filters.region),
    publishedAfter,
    q: query,
  });

  const response = await request<SearchResponse>('search', params);
  const ids = (response.items ?? [])
    .map((item) => item.id.videoId)
    .filter((id): id is string => Boolean(id));

  return fetchVideoDetails(apiKey, ids);
}
