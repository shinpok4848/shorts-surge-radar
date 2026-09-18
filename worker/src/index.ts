import type {
  ChannelDataset,
  ChannelProfile,
  ChannelVideo,
  ContentKind,
  RegionCode,
  VideoMetrics,
} from '../../src/types';

interface Env {
  YOUTUBE_API_KEY: string;
  ALLOWED_ORIGINS?: string;
  MAX_UPLOADS?: string;
}

interface WorkerContext {
  waitUntil(promise: Promise<unknown>): void;
}

interface YouTubeErrorPayload {
  error?: { message?: string; errors?: Array<{ reason?: string }> };
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
    title: string;
    channelId?: string;
    channelTitle?: string;
    description?: string;
    publishedAt: string;
    tags?: string[];
    categoryId?: string;
    thumbnails?: Record<string, { url: string }>;
  };
  contentDetails?: { duration?: string };
  statistics?: { viewCount?: string; likeCount?: string; commentCount?: string };
}

interface Locator {
  type: 'id' | 'handle' | 'username' | 'search';
  value: string;
}

const YOUTUBE_ROOT = 'https://www.googleapis.com/youtube/v3';
const DEFAULT_ALLOWED_ORIGINS = [
  'https://shinpok4848.github.io',
  'http://localhost:4173',
  'http://127.0.0.1:4173',
];
const CACHE_SECONDS = 900;

function json(data: unknown, status = 200, headers: HeadersInit = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': status < 400 ? `public, max-age=300, s-maxage=${CACHE_SECONDS}` : 'no-store',
      'X-Content-Type-Options': 'nosniff',
      ...headers,
    },
  });
}

function errorResponse(status: number, code: string, message: string): Response {
  return json({ error: { code, message } }, status);
}

function allowedOrigin(request: Request, env: Env): string | null {
  const origin = request.headers.get('Origin');
  if (!origin) return '*';
  const configured = env.ALLOWED_ORIGINS?.split(',').map((item) => item.trim()).filter(Boolean) ?? [];
  const allowed = configured.length ? configured : DEFAULT_ALLOWED_ORIGINS;
  return allowed.includes(origin) ? origin : null;
}

function withCors(response: Response, origin: string): Response {
  const headers = new Headers(response.headers);
  headers.set('Access-Control-Allow-Origin', origin);
  headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Accept, Content-Type');
  headers.set('Vary', 'Origin');
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

function parseNumber(value?: string): number | null {
  if (value === undefined) return null;
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

function bestThumbnail(thumbnails?: Record<string, { url: string }>): string {
  if (!thumbnails) return '';
  return thumbnails.maxres?.url
    ?? thumbnails.standard?.url
    ?? thumbnails.high?.url
    ?? thumbnails.medium?.url
    ?? thumbnails.default?.url
    ?? '';
}

function emptyPrivateMetrics(): Omit<VideoMetrics, 'views' | 'likes' | 'comments'> {
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
      views: parseNumber(item.statistics?.viewCount),
      lifetimeViews: parseNumber(item.statistics?.viewCount),
      likes: parseNumber(item.statistics?.likeCount),
      comments: parseNumber(item.statistics?.commentCount),
      ...emptyPrivateMetrics(),
    },
    source: 'public-api',
  };
}

async function youtube<T extends YouTubeErrorPayload>(path: string, params: Record<string, string>, env: Env): Promise<T> {
  if (!env.YOUTUBE_API_KEY) throw new Error('SERVER_NOT_CONFIGURED');
  const query = new URLSearchParams({ ...params, key: env.YOUTUBE_API_KEY });
  const response = await fetch(`${YOUTUBE_ROOT}/${path}?${query.toString()}`);
  const payload = await response.json() as T;
  if (!response.ok || payload.error) {
    const reason = payload.error?.errors?.[0]?.reason ?? 'YOUTUBE_API_ERROR';
    const detail = payload.error?.message ?? 'YouTube API request failed.';
    throw new Error(`${reason}:${detail}`);
  }
  return payload;
}

function parseChannelLocator(input: string): Locator {
  const clean = input.trim();
  if (/^UC[\w-]{22}$/.test(clean)) return { type: 'id', value: clean };
  if (/^@[\w.-]{3,30}$/.test(clean)) return { type: 'handle', value: clean };

  let parsed: URL;
  try {
    parsed = new URL(/^https?:\/\//i.test(clean) ? clean : `https://${clean}`);
  } catch {
    throw new Error('INVALID_CHANNEL_URL');
  }
  if (!/(^|\.)youtube\.com$/i.test(parsed.hostname)) throw new Error('INVALID_CHANNEL_URL');
  const parts = parsed.pathname.split('/').filter(Boolean);
  if (!parts.length) throw new Error('INVALID_CHANNEL_URL');
  if (parts[0] === 'channel' && /^UC[\w-]{22}$/.test(parts[1] ?? '')) return { type: 'id', value: parts[1] };
  if (parts[0].startsWith('@')) return { type: 'handle', value: parts[0] };
  if (parts[0] === 'user' && parts[1]) return { type: 'username', value: parts[1] };
  if (parts[0] === 'c' && parts[1]) return { type: 'search', value: parts[1] };
  throw new Error('INVALID_CHANNEL_URL');
}

async function resolveChannel(locator: Locator, env: Env): Promise<ChannelItem> {
  let id: string | undefined;
  if (locator.type === 'search') {
    const search = await youtube<YouTubeErrorPayload & { items?: Array<{ id?: { channelId?: string } }> }>('search', {
      part: 'snippet', type: 'channel', maxResults: '5', q: locator.value,
    }, env);
    id = search.items?.[0]?.id?.channelId;
    if (!id) throw new Error('CHANNEL_NOT_FOUND');
  }

  const filter = locator.type === 'id' || id
    ? { id: id ?? locator.value }
    : locator.type === 'handle'
      ? { forHandle: locator.value }
      : { forUsername: locator.value };
  const response = await youtube<YouTubeErrorPayload & { items?: ChannelItem[] }>('channels', {
    part: 'snippet,statistics,contentDetails,brandingSettings',
    ...filter,
  }, env);
  const channel = response.items?.[0];
  if (!channel) throw new Error('CHANNEL_NOT_FOUND');
  return channel;
}

function mapChannel(item: ChannelItem): ChannelProfile {
  return {
    channelId: item.id,
    title: item.snippet.title,
    description: item.snippet.description ?? '',
    customUrl: item.snippet.customUrl,
    avatarUrl: bestThumbnail(item.snippet.thumbnails),
    bannerUrl: item.brandingSettings?.image?.bannerExternalUrl,
    subscribers: item.statistics?.hiddenSubscriberCount ? null : parseNumber(item.statistics?.subscriberCount),
    totalViews: parseNumber(item.statistics?.viewCount),
    videoCount: parseNumber(item.statistics?.videoCount),
    publishedAt: item.snippet.publishedAt,
  };
}

async function uploadIds(playlistId: string, limit: number, env: Env): Promise<{ ids: string[]; truncated: boolean }> {
  const ids: string[] = [];
  let pageToken: string | undefined;
  do {
    const response = await youtube<YouTubeErrorPayload & {
      nextPageToken?: string;
      items?: Array<{ contentDetails?: { videoId?: string } }>;
    }>('playlistItems', {
      part: 'contentDetails', playlistId, maxResults: '50', ...(pageToken ? { pageToken } : {}),
    }, env);
    for (const item of response.items ?? []) {
      const id = item.contentDetails?.videoId;
      if (id) ids.push(id);
      if (ids.length >= limit) break;
    }
    pageToken = response.nextPageToken;
  } while (pageToken && ids.length < limit);
  return { ids, truncated: Boolean(pageToken) };
}

async function videoDetails(ids: string[], env: Env): Promise<ChannelVideo[]> {
  const videos: ChannelVideo[] = [];
  for (let index = 0; index < ids.length; index += 50) {
    const response = await youtube<YouTubeErrorPayload & { items?: VideoItem[] }>('videos', {
      part: 'snippet,contentDetails,statistics',
      id: ids.slice(index, index + 50).join(','),
      maxResults: '50',
    }, env);
    videos.push(...(response.items ?? []).map(mapVideo));
  }
  return videos;
}

async function channelAudit(channelUrl: string, env: Env): Promise<ChannelDataset> {
  const channel = await resolveChannel(parseChannelLocator(channelUrl), env);
  const uploads = channel.contentDetails?.relatedPlaylists?.uploads;
  if (!uploads) throw new Error('UPLOADS_NOT_AVAILABLE');
  const limit = Math.min(2000, Math.max(50, Number(env.MAX_UPLOADS ?? 1000) || 1000));
  const uploadResult = await uploadIds(uploads, limit, env);
  const videos = await videoDetails(uploadResult.ids, env);
  return {
    source: 'public-api',
    fetchedAt: new Date().toISOString(),
    channel: mapChannel(channel),
    videos,
    trafficSources: [],
    benchmarks: [],
    truncated: uploadResult.truncated,
    warnings: [
      '공개 데이터에는 실제 노출수, 클릭률, 유지율, 유입경로가 포함되지 않습니다.',
      '180초 이하 영상은 화면비 정보가 없어 쇼츠 후보로 분류됩니다.',
      ...(uploadResult.truncated ? [`최근 ${limit}개 업로드까지만 분석했습니다.`] : []),
    ],
  };
}

function cleanSearchQuery(value: string): string {
  return value.replace(/[#|<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
}

async function searchVideos(
  query: string,
  region: RegionCode,
  env: Env,
  options: { publishedAfter?: string; maxResults?: number } = {},
): Promise<ChannelVideo[]> {
  const response = await youtube<YouTubeErrorPayload & { items?: Array<{ id?: { videoId?: string } }> }>('search', {
    part: 'snippet',
    type: 'video',
    order: 'viewCount',
    maxResults: String(options.maxResults ?? 20),
    regionCode: region,
    q: cleanSearchQuery(query),
    ...(options.publishedAfter ? { publishedAfter: options.publishedAfter } : {}),
  }, env);
  const ids = (response.items ?? []).map((item) => item.id?.videoId).filter((id): id is string => Boolean(id));
  return videoDetails(ids, env);
}

function cacheApi(): Cache | null {
  const cloudflareCaches = (globalThis as typeof globalThis & { caches?: CacheStorage & { default?: Cache } }).caches;
  return cloudflareCaches?.default ?? null;
}

function publicCacheKey(request: Request): Request {
  const url = new URL(request.url);
  url.searchParams.sort();
  return new Request(url.toString(), { method: 'GET' });
}

function mapError(error: unknown): Response {
  const message = error instanceof Error ? error.message : 'UNKNOWN_ERROR';
  if (message === 'INVALID_CHANNEL_URL') {
    return errorResponse(400, message, '유효한 YouTube 채널 URL, @핸들 또는 채널 ID를 입력해 주세요.');
  }
  if (message === 'CHANNEL_NOT_FOUND') return errorResponse(404, message, 'YouTube 채널을 찾지 못했습니다.');
  if (message === 'UPLOADS_NOT_AVAILABLE') return errorResponse(422, message, '이 채널의 공개 업로드 목록을 불러올 수 없습니다.');
  if (message === 'SERVER_NOT_CONFIGURED') return errorResponse(503, message, '공개 진단 서버의 YouTube API 설정이 완료되지 않았습니다.');
  if (message.startsWith('quotaExceeded') || message.startsWith('dailyLimitExceeded')) {
    return errorResponse(429, 'YOUTUBE_QUOTA_EXCEEDED', 'YouTube API 일일 할당량을 모두 사용했습니다. 잠시 후 다시 시도해 주세요.');
  }
  if (message.startsWith('keyInvalid')) return errorResponse(503, 'YOUTUBE_KEY_INVALID', '서버의 YouTube API 설정을 확인해 주세요.');
  return errorResponse(502, 'YOUTUBE_API_ERROR', 'YouTube 데이터를 불러오는 중 오류가 발생했습니다.');
}

async function handle(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  if (url.pathname === '/health') return json({ ok: true, configured: Boolean(env.YOUTUBE_API_KEY) });
  if (!env.YOUTUBE_API_KEY) throw new Error('SERVER_NOT_CONFIGURED');

  if (url.pathname === '/api/channel') {
    const channelUrl = url.searchParams.get('url') ?? '';
    return json(await channelAudit(channelUrl, env));
  }
  if (url.pathname === '/api/benchmarks') {
    const query = cleanSearchQuery(url.searchParams.get('query') ?? '');
    if (!query) return errorResponse(400, 'QUERY_REQUIRED', '비교할 영상 주제를 입력해 주세요.');
    const channelId = url.searchParams.get('channelId') ?? '';
    const region = (url.searchParams.get('region') ?? 'KR') as RegionCode;
    const videos = (await searchVideos(query, region, env, { maxResults: 20 }))
      .filter((video) => !channelId || video.channelId !== channelId)
      .slice(0, 12);
    return json({ videos, fetchedAt: new Date().toISOString() });
  }
  if (url.pathname === '/api/trends') {
    const query = cleanSearchQuery(url.searchParams.get('query') ?? '#shorts') || '#shorts';
    const region = (url.searchParams.get('region') ?? 'KR') as RegionCode;
    const hours = Math.min(720, Math.max(24, Number(url.searchParams.get('hours') ?? 168) || 168));
    const publishedAfter = new Date(Date.now() - hours * 3_600_000).toISOString();
    const videos = await searchVideos(query, region, env, { maxResults: 50, publishedAfter });
    return json({ videos, fetchedAt: new Date().toISOString() });
  }
  return errorResponse(404, 'NOT_FOUND', '요청한 API 경로가 없습니다.');
}

export default {
  async fetch(request: Request, env: Env, context: WorkerContext): Promise<Response> {
    const origin = allowedOrigin(request, env);
    if (!origin) return errorResponse(403, 'ORIGIN_NOT_ALLOWED', '허용되지 않은 사이트 요청입니다.');
    if (request.method === 'OPTIONS') return withCors(new Response(null, { status: 204 }), origin);
    if (request.method !== 'GET') return withCors(errorResponse(405, 'METHOD_NOT_ALLOWED', 'GET 요청만 지원합니다.'), origin);

    const cache = cacheApi();
    const cacheKey = publicCacheKey(request);
    if (cache) {
      const cached = await cache.match(cacheKey);
      if (cached) return withCors(cached, origin);
    }

    try {
      const response = await handle(request, env);
      if (cache && response.ok) context.waitUntil(cache.put(cacheKey, response.clone()));
      return withCors(response, origin);
    } catch (error) {
      return withCors(mapError(error), origin);
    }
  },
};
