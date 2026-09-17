import type { CandidateCache, DashboardFilters, ShortsVideo, VideoSnapshot } from '../types';

const API_KEY_STORAGE = 'shorts-pulse:youtube-api-key';
const FILTERS_STORAGE = 'shorts-pulse:filters';
const SNAPSHOTS_STORAGE = 'shorts-pulse:snapshots:v1';
const CANDIDATES_STORAGE = 'shorts-pulse:candidates:v1';
const MAX_SNAPSHOTS_PER_VIDEO = 288;
const MAX_TRACKED_VIDEOS = 80;

interface SnapshotStore {
  [videoId: string]: VideoSnapshot[];
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : fallback;
  } catch {
    return fallback;
  }
}

export function getApiKey(): string {
  return localStorage.getItem(API_KEY_STORAGE) ?? '';
}

export function saveApiKey(apiKey: string): void {
  const clean = apiKey.trim();
  if (clean) localStorage.setItem(API_KEY_STORAGE, clean);
  else localStorage.removeItem(API_KEY_STORAGE);
}

export function loadFilters(fallback: DashboardFilters): DashboardFilters {
  return { ...fallback, ...readJson<Partial<DashboardFilters>>(FILTERS_STORAGE, {}) };
}

export function saveFilters(filters: DashboardFilters): void {
  localStorage.setItem(FILTERS_STORAGE, JSON.stringify(filters));
}

export function filtersKey(filters: DashboardFilters): string {
  return `${filters.region}:${filters.periodHours}:${filters.query.trim().toLocaleLowerCase()}`;
}

export function loadCandidateCache(): CandidateCache | null {
  return readJson<CandidateCache | null>(CANDIDATES_STORAGE, null);
}

export function saveCandidateCache(cache: CandidateCache): void {
  localStorage.setItem(CANDIDATES_STORAGE, JSON.stringify(cache));
}

export function previousSnapshots(videoIds: string[], capturedAt = Date.now()): Map<string, VideoSnapshot> {
  const store = readJson<SnapshotStore>(SNAPSHOTS_STORAGE, {});
  const result = new Map<string, VideoSnapshot>();

  for (const videoId of videoIds) {
    const snapshots = store[videoId] ?? [];
    const previous = [...snapshots].reverse().find((snapshot) => snapshot.capturedAt < capturedAt - 30_000);
    if (previous) result.set(videoId, previous);
  }

  return result;
}

export function recordSnapshots(videos: ShortsVideo[], capturedAt = Date.now()): void {
  const store = readJson<SnapshotStore>(SNAPSHOTS_STORAGE, {});

  for (const video of videos) {
    const history = store[video.videoId] ?? [];
    const last = history.at(-1);
    if (last && capturedAt - last.capturedAt < 30_000) continue;
    history.push({ videoId: video.videoId, capturedAt, views: video.views });
    store[video.videoId] = history.slice(-MAX_SNAPSHOTS_PER_VIDEO);
  }

  const tracked = Object.entries(store)
    .sort(([, a], [, b]) => (b.at(-1)?.capturedAt ?? 0) - (a.at(-1)?.capturedAt ?? 0))
    .slice(0, MAX_TRACKED_VIDEOS);

  localStorage.setItem(SNAPSHOTS_STORAGE, JSON.stringify(Object.fromEntries(tracked)));
}
