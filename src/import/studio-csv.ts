import type { ChannelDataset, ChannelVideo, ContentKind, VideoMetrics } from '../types';

interface CsvRecord {
  [normalizedHeader: string]: string;
}

interface ParsedCsv {
  records: CsvRecord[];
  originalHeaders: string[];
  dateValues: string[];
}

const HEADER_ALIASES = {
  videoId: ['videoid', '동영상id', '콘텐츠id', 'contentid'],
  title: ['video', 'videotitle', 'content', 'contenttitle', '동영상', '동영상제목', '콘텐츠', '콘텐츠제목'],
  publishedAt: ['videopublishtime', 'publishdate', 'publisheddate', '게시일', '동영상게시시간', '게시날짜'],
  contentType: ['contenttype', 'videotype', '콘텐츠유형', '동영상유형'],
  duration: ['duration', 'videoduration', '길이', '동영상길이'],
  views: ['views', '조회수'],
  impressions: ['impressions', '노출수'],
  ctr: ['impressionsclickthroughrate', 'impressionsclickthroughratepercent', '노출클릭률', '노출클릭률percent'],
  watchTimeHours: ['watchtimehours', 'watchtime', '시청시간단위시간', '시청시간시간', '시청시간'],
  averageViewDuration: ['averageviewduration', '평균시청지속시간'],
  averagePercentageViewed: ['averagepercentageviewed', 'averagepercentageviewedpercent', '평균조회율', '평균조회율percent'],
  subscribers: ['subscribers', '구독자'],
  subscribersGained: ['subscribersgained', '구독자증가', '구독자획득'],
  subscribersLost: ['subscriberslost', '구독자감소'],
  likes: ['likes', '좋아요'],
  comments: ['comments', '댓글'],
  shares: ['shares', '공유'],
  date: ['date', '날짜'],
} as const;

type Field = keyof typeof HEADER_ALIASES;

export class StudioCsvError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = 'StudioCsvError';
  }
}

function normalizeHeader(value: string): string {
  return value
    .replace(/^\uFEFF/, '')
    .toLocaleLowerCase()
    .replace(/%/g, 'percent')
    .replace(/[\s_()\[\]{}:./-]/g, '');
}

function parseRows(source: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];
    if (char === '"') {
      if (quoted && next === '"') {
        cell += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }
    if (char === ',' && !quoted) {
      row.push(cell.trim());
      cell = '';
      continue;
    }
    if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && next === '\n') index += 1;
      row.push(cell.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = '';
      continue;
    }
    cell += char;
  }
  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

function fieldHeader(field: Field, headers: string[]): string | undefined {
  const aliases = HEADER_ALIASES[field] as readonly string[];
  return headers.find((header) => aliases.includes(header));
}

function parseCsv(source: string): ParsedCsv {
  const rows = parseRows(source);
  if (rows.length < 2) return { records: [], originalHeaders: [], dateValues: [] };

  const knownAliases = new Set<string>(Object.values(HEADER_ALIASES).flat());
  const headerIndex = rows.findIndex((row) => row.map(normalizeHeader).some((header) => knownAliases.has(header)));
  if (headerIndex < 0) return { records: [], originalHeaders: [], dateValues: [] };

  const originalHeaders = rows[headerIndex];
  const headers = originalHeaders.map(normalizeHeader);
  const records = rows.slice(headerIndex + 1).map((values) => Object.fromEntries(
    headers.map((header, index) => [header, values[index] ?? '']),
  ));
  const dateHeader = fieldHeader('date', headers);
  const dateValues = dateHeader ? records.map((record) => record[dateHeader]).filter(Boolean) : [];
  return { records, originalHeaders, dateValues };
}

function value(record: CsvRecord, headers: string[], field: Field): string {
  const header = fieldHeader(field, headers);
  return header ? record[header] ?? '' : '';
}

function numberValue(raw: string): number | null {
  const clean = raw.replace(/[,%\s]/g, '').replace(/^--$/, '');
  if (!clean) return null;
  const parsed = Number(clean);
  return Number.isFinite(parsed) ? parsed : null;
}

function durationSeconds(raw: string): number | null {
  if (!raw) return null;
  if (/^\d+(?:\.\d+)?$/.test(raw.trim())) return numberValue(raw);
  const parts = raw.trim().split(':').map(Number);
  if (parts.some((part) => !Number.isFinite(part))) return null;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return null;
}

function videoIdFrom(record: CsvRecord, headers: string[]): string {
  const direct = value(record, headers, 'videoId').trim();
  const match = direct.match(/(?:v=|shorts\/|youtu\.be\/)?([\w-]{11})(?:\b|$)/);
  return match?.[1] ?? direct;
}

function contentKind(raw: string, duration: number | null): { kind: ContentKind; verified: boolean } {
  const normalized = raw.toLocaleLowerCase();
  if (normalized.includes('short') || normalized.includes('쇼츠')) return { kind: 'short', verified: true };
  if (normalized.includes('video') || normalized.includes('동영상')) return { kind: 'video', verified: true };
  return { kind: duration !== null && duration <= 180 ? 'short' : 'video', verified: false };
}

function svgThumbnail(_title: string, index: number): string {
  const colors = ['DFFF00', '9D7BFF', 'FF7048', '4CC9F0', 'FF4D8D'];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360"><rect width="640" height="360" fill="#111311"/><circle cx="530" cy="70" r="170" fill="#${colors[index % colors.length]}" opacity=".82"/><path d="M42 250h360" stroke="#f6f6f1" stroke-width="2"/><text x="42" y="226" fill="#f6f6f1" font-family="Arial" font-size="34" font-weight="700">CSV METRIC</text><text x="44" y="292" fill="#9b9d96" font-family="Arial" font-size="17">LOCAL STUDIO DATA</text></svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function emptyMetrics(): VideoMetrics {
  return {
    views: null,
    lifetimeViews: null,
    likes: null,
    comments: null,
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

function parseRecord(record: CsvRecord, headers: string[], index: number): ChannelVideo | null {
  const title = value(record, headers, 'title').trim();
  const id = videoIdFrom(record, headers);
  if (!title || /^(total|합계)$/i.test(title)) return null;

  const duration = durationSeconds(value(record, headers, 'duration'));
  const format = contentKind(value(record, headers, 'contentType'), duration);
  const subscribers = numberValue(value(record, headers, 'subscribers'));
  const gained = numberValue(value(record, headers, 'subscribersGained'));
  const lost = numberValue(value(record, headers, 'subscribersLost'));
  const watchHours = numberValue(value(record, headers, 'watchTimeHours'));

  return {
    videoId: id || `csv-${index}-${normalizeHeader(title).slice(0, 24)}`,
    title,
    description: '',
    publishedAt: value(record, headers, 'publishedAt'),
    thumbnailUrl: svgThumbnail(title, index),
    durationSeconds: duration,
    tags: [],
    contentKind: format.kind,
    contentKindConfidence: format.verified ? 'verified' : 'candidate',
    metrics: {
      ...emptyMetrics(),
      views: numberValue(value(record, headers, 'views')),
      likes: numberValue(value(record, headers, 'likes')),
      comments: numberValue(value(record, headers, 'comments')),
      shares: numberValue(value(record, headers, 'shares')),
      impressions: numberValue(value(record, headers, 'impressions')),
      impressionClickThroughRate: numberValue(value(record, headers, 'ctr')),
      watchTimeMinutes: watchHours === null ? null : watchHours * 60,
      averageViewDurationSeconds: durationSeconds(value(record, headers, 'averageViewDuration')),
      averagePercentageViewed: numberValue(value(record, headers, 'averagePercentageViewed')),
      subscribersGained: gained ?? (subscribers !== null && subscribers >= 0 ? subscribers : null),
      subscribersLost: lost ?? (subscribers !== null && subscribers < 0 ? Math.abs(subscribers) : null),
    },
    source: 'studio-csv',
  };
}

function normalizedTitle(title: string): string {
  return title.toLocaleLowerCase().replace(/\s+/g, '').replace(/[^\p{L}\p{N}]/gu, '');
}

function mergeMetrics(base: VideoMetrics, imported: VideoMetrics): VideoMetrics {
  return Object.fromEntries(Object.keys(base).map((key) => {
    const metric = key as keyof VideoMetrics;
    return [metric, imported[metric] ?? base[metric]];
  })) as unknown as VideoMetrics;
}

function mergeVideo(base: ChannelVideo, imported: ChannelVideo): ChannelVideo {
  return {
    ...base,
    publishedAt: imported.publishedAt || base.publishedAt,
    durationSeconds: imported.durationSeconds ?? base.durationSeconds,
    contentKind: imported.contentKindConfidence === 'verified' ? imported.contentKind : base.contentKind,
    contentKindConfidence: imported.contentKindConfidence === 'verified' ? 'verified' : base.contentKindConfidence,
    metrics: mergeMetrics(base.metrics, imported.metrics),
    source: 'studio-csv',
  };
}

function validIsoDate(raw: string): string | null {
  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString().slice(0, 10) : null;
}

export async function importStudioCsvFiles(
  files: File[],
  existing: ChannelDataset | null = null,
): Promise<ChannelDataset> {
  const csvFiles = files.filter((file) => file.name.toLocaleLowerCase().endsWith('.csv') || file.type.includes('csv'));
  if (!csvFiles.length) throw new StudioCsvError('CSV 파일을 선택해 주세요. ZIP 파일은 먼저 압축을 풀어야 합니다.', 'CSV_REQUIRED');

  const parsedFiles = await Promise.all(csvFiles.map(async (file) => ({ file, parsed: parseCsv(await file.text()) })));
  const imported: ChannelVideo[] = [];
  const dates: string[] = [];
  const recognizedHeaders = new Set<string>();

  for (const { parsed } of parsedFiles) {
    const headers = parsed.originalHeaders.map(normalizeHeader);
    headers.forEach((header) => recognizedHeaders.add(header));
    dates.push(...parsed.dateValues);
    parsed.records.forEach((record, index) => {
      const video = parseRecord(record, headers, imported.length + index);
      if (video) imported.push(video);
    });
  }

  if (!imported.length) {
    throw new StudioCsvError(
      '영상 제목(Content/Video) 열이 있는 YouTube Studio 표 CSV를 찾지 못했습니다.',
      'CSV_COLUMNS_NOT_RECOGNIZED',
    );
  }

  const deduped = new Map<string, ChannelVideo>();
  for (const video of imported) {
    const key = video.videoId.startsWith('csv-') ? `title:${normalizedTitle(video.title)}` : `id:${video.videoId}`;
    const previous = deduped.get(key);
    deduped.set(key, previous ? mergeVideo(previous, video) : video);
  }

  const existingById = new Map(existing?.videos.map((video) => [video.videoId, video]) ?? []);
  const existingByTitle = new Map(existing?.videos.map((video) => [normalizedTitle(video.title), video]) ?? []);
  const mergedIds = new Set<string>();
  const mergedImports = [...deduped.values()].map((video) => {
    const base = existingById.get(video.videoId) ?? existingByTitle.get(normalizedTitle(video.title));
    if (!base) return video;
    mergedIds.add(base.videoId);
    return mergeVideo(base, video);
  });
  const untouched = existing?.videos.filter((video) => !mergedIds.has(video.videoId)) ?? [];

  const validDates = dates.map(validIsoDate).filter((date): date is string => Boolean(date)).sort();
  const dateRange = validDates.length
    ? { startDate: validDates[0], endDate: validDates.at(-1) ?? validDates[0] }
    : existing?.dateRange;
  const hasCtr = Boolean(fieldHeader('ctr', [...recognizedHeaders]));
  const hasRetention = Boolean(
    fieldHeader('averagePercentageViewed', [...recognizedHeaders])
    || fieldHeader('averageViewDuration', [...recognizedHeaders]),
  );

  return {
    source: 'studio-csv',
    fetchedAt: new Date().toISOString(),
    dateRange,
    channel: existing?.channel ?? {
      channelId: 'studio-csv',
      title: 'YouTube Studio 채널',
      description: '브라우저에서 로컬 분석한 YouTube Studio CSV 데이터',
      avatarUrl: svgThumbnail('MY CHANNEL', 0),
      subscribers: null,
      totalViews: null,
      videoCount: deduped.size,
    },
    videos: [...mergedImports, ...untouched],
    trafficSources: existing?.trafficSources ?? [],
    benchmarks: existing?.benchmarks ?? [],
    truncated: existing?.truncated ?? false,
    warnings: [
      `CSV ${csvFiles.length}개에서 영상 ${deduped.size.toLocaleString('ko-KR')}개를 로컬로 분석했습니다. 파일은 서버에 업로드되지 않았습니다.`,
      ...(!hasCtr ? ['노출 클릭률 열이 없습니다. YouTube Studio 고급 모드에서 노출수·CTR 열을 포함해 내보내면 포장 진단이 정밀해집니다.'] : []),
      ...(!hasRetention ? ['평균 조회율 또는 평균 시청 지속 시간 열이 없어 유지율 진단은 제한됩니다.'] : []),
      ...(!existing ? ['CSV만 사용하면 썸네일·설명·태그·정확한 게시일이 없을 수 있습니다. Google 연결 또는 URL 진단 후 CSV를 추가하면 합쳐집니다.'] : []),
    ],
  };
}
