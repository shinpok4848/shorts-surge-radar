import type { ChannelDataset, ChannelVideo, RegionCode } from '../types';

export class PublicChannelApiError extends Error {
  constructor(message: string, public readonly code: string, public readonly status = 0) {
    super(message);
    this.name = 'PublicChannelApiError';
  }
}

function endpoint(baseUrl: string, path: string, params: Record<string, string>): string {
  const cleanBase = baseUrl.trim().replace(/\/$/, '');
  if (!cleanBase) {
    throw new PublicChannelApiError(
      '공개 채널 진단 서버가 아직 연결되지 않았습니다. 데모 또는 Studio CSV 진단을 먼저 사용할 수 있습니다.',
      'PUBLIC_API_NOT_CONFIGURED',
    );
  }
  const url = new URL(`${cleanBase}${path}`);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  return url.toString();
}

async function request<T>(url: string): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, { headers: { Accept: 'application/json' } });
  } catch {
    throw new PublicChannelApiError('채널 진단 서버에 연결할 수 없습니다.', 'NETWORK_ERROR');
  }

  const payload = await response.json().catch(() => null) as { error?: { message?: string; code?: string } } | null;
  if (!response.ok) {
    throw new PublicChannelApiError(
      payload?.error?.message ?? '공개 채널 데이터를 불러오지 못했습니다.',
      payload?.error?.code ?? 'PUBLIC_API_ERROR',
      response.status,
    );
  }
  return payload as T;
}

export function auditPublicChannel(baseUrl: string, channelUrl: string): Promise<ChannelDataset> {
  return request<ChannelDataset>(endpoint(baseUrl, '/api/channel', { url: channelUrl.trim() }));
}

export async function loadRelatedBenchmarks(
  baseUrl: string,
  query: string,
  channelId: string,
  region: RegionCode,
): Promise<ChannelVideo[]> {
  const result = await request<{ videos: ChannelVideo[] }>(endpoint(baseUrl, '/api/benchmarks', {
    query: query.trim(),
    channelId,
    region,
  }));
  return result.videos;
}

export async function loadMarketTrends(
  baseUrl: string,
  query: string,
  region: RegionCode,
  hours: number,
): Promise<ChannelVideo[]> {
  const result = await request<{ videos: ChannelVideo[] }>(endpoint(baseUrl, '/api/trends', {
    query: query.trim(),
    region,
    hours: String(hours),
  }));
  return result.videos;
}
