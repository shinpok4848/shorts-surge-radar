import type {
  CalendarEntry,
  HookTemplate,
  LaunchInputs,
  LaunchKit,
  MarketLaunchInsights,
  NicheBlueprint,
  RankedShort,
  RegionCode,
  RetentionCheck,
  SeriesConcept,
  TrendSignal,
  TrendStructureCandidate,
  TrendTopicCandidate,
} from '../types';
import { blueprintById } from './niches';
import { titleMatchesRegion } from './region-language';

const DAY_MS = 86_400_000;

const REGION_LABELS: Record<string, string> = { KR: '대한민국', US: '미국', JP: '일본', GB: '영국' };

const STOP_WORDS = new Set([
  'shorts', '쇼츠', 'short', 'youtube', '유튜브', 'ytshorts', 'viral', 'funny', 'comedy',
  'the', 'and', 'for', 'you', 'your', 'a', 'an', 'to', 'of', 'in', 'on', 'is', 'it', 'my',
  'when', 'what', 'why', 'how', 'part', 'dont', "don't", 'this', 'that', 'with', 'i',
  '이거', '그리고', '하는', '있는', '없는', '진짜', '정말', '오늘', '이것', '저것', '웃긴영상',
  '바이럴', '한국바이럴', '개그', '꿀잼', '재미', '웃음', '수정', '숶천',
]);

const HANGUL = /[\uac00-\ud7a3]/;

function candidateTokens(title: string): string[] {
  return title
    .replace(/[()[\]{}!?.,:;“”"'|｜]/g, ' ')
    .split(/\s+/)
    .map((token) => token.replace(/^#/, '').trim())
    .filter(Boolean);
}

// Prefer a meaningful Korean keyword when present, then a longer Latin token,
// skipping generic filler/hashtag noise so trend tie-ins stay on-topic.
function keywordFromTitle(title: string, preferHangul: boolean): string {
  const tokens = candidateTokens(title);
  const usable = tokens.filter((token) => token.length >= 2 && !STOP_WORDS.has(token.toLocaleLowerCase()));
  if (preferHangul) {
    const hangul = usable.find((token) => HANGUL.test(token) && token.length >= 2);
    if (hangul) return hangul;
  }
  const meaningful = usable.find((token) => token.length >= 3) ?? usable[0];
  return meaningful ?? title.slice(0, 12).trim();
}

interface TopicAccumulator {
  score: number;
  videos: Set<string>;
  channels: Set<string>;
  evidence: string[];
}

interface StructureDefinition {
  id: TrendStructureCandidate['id'];
  label: string;
  test: (title: string) => boolean;
}

const STRUCTURE_DEFINITIONS: StructureDefinition[] = [
  { id: 'numbered', label: '숫자·목록형', test: (title) => /\d+|[세네다섯여러]\s*가지|단계|개/.test(title) },
  { id: 'mistake-fix', label: '실수→해결형', test: (title) => /실수|문제|해결|고치|방법|팁|꿀팁|주의/.test(title) },
  { id: 'before-after', label: '전후·변화형', test: (title) => /전후|비포|애프터|바뀌|변화|달라|전\s*vs\s*후/i.test(title) },
  { id: 'explainer', label: '질문·이유형', test: (title) => /왜|이유|어떻게|무엇|\?|알아야/.test(title) },
  { id: 'contrast-reaction', label: '반전·대조형', test: (title) => /반전|충격|의외|결국|vs|대결|비교|결말/i.test(title) },
];

function normalizedTopicToken(value: string, region: RegionCode): string | null {
  const token = value
    .replace(/^#+/, '')
    .replace(/[^\p{L}\p{N}]/gu, '')
    .normalize('NFC')
    .toLocaleLowerCase();
  if (token.length < 2 || token.length > 18 || STOP_WORDS.has(token)) return null;
  if (region === 'KR' && !HANGUL.test(token)) return null;
  return token;
}

function inferenceTokens(video: RankedShort, region: RegionCode): string[] {
  const titleTokens = candidateTokens(video.title)
    .map((token) => normalizedTopicToken(token, region))
    .filter((token): token is string => Boolean(token));
  const tagTokens = video.tags
    .map((tag) => normalizedTopicToken(tag, region))
    .filter((token): token is string => Boolean(token));
  const singles = [...new Set([...tagTokens, ...titleTokens])];
  const bigrams = titleTokens.slice(0, 6)
    .slice(0, -1)
    .map((token, index) => `${token} ${titleTokens[index + 1]}`)
    .filter((phrase) => phrase.length <= 22);
  return [...singles, ...bigrams];
}

function trendWeight(video: RankedShort): number {
  const scoreWeight = .8 + video.score / 100;
  const velocityWeight = Math.min(1.2, Math.log10(video.velocity + 1) / 5);
  const engagementWeight = Math.min(.6, video.engagementRate * 6);
  const rankWeight = Math.max(.15, 1 - (video.rank - 1) / 200);
  return scoreWeight + velocityWeight + engagementWeight + rankWeight;
}

function topicConfidence(supportCount: number, distinctChannels: number): TrendTopicCandidate['confidence'] {
  if (supportCount >= 4 && distinctChannels >= 3) return 'high';
  if (supportCount >= 2 && distinctChannels >= 2) return 'medium';
  return 'exploratory';
}

function recommendedNiche(structures: TrendStructureCandidate[]): string {
  const strongest = structures[0]?.id;
  if (strongest === 'before-after') return 'satisfying-process';
  if (strongest === 'explainer' || strongest === 'numbered') return 'micro-education';
  if (strongest === 'contrast-reaction') return 'reaction-opinion';
  if (strongest === 'mistake-fix') return 'how-to-fix';
  return 'daily-life-hack';
}

export function inferMarketLaunchInsights(
  videos: RankedShort[],
  region: RegionCode = 'KR',
  explicitQuery = '',
): MarketLaunchInsights {
  const matching = videos.filter((video) => titleMatchesRegion(video.title, region)).slice(0, 120);
  const topicMap = new Map<string, TopicAccumulator>();
  const structureMap = new Map<TrendStructureCandidate['id'], {
    definition: StructureDefinition;
    score: number;
    videos: Set<string>;
    evidence: string[];
  }>();

  for (const video of matching) {
    const weight = trendWeight(video);
    const channel = video.channelTitle || video.videoId;
    for (const topic of new Set(inferenceTokens(video, region))) {
      const current = topicMap.get(topic) ?? {
        score: 0,
        videos: new Set<string>(),
        channels: new Set<string>(),
        evidence: [],
      };
      // Cap repeated contribution per video and reward evidence from distinct channels.
      current.score += weight * (topic.includes(' ') ? 1.18 : 1);
      current.videos.add(video.videoId);
      current.channels.add(channel);
      if (current.evidence.length < 3) current.evidence.push(video.title);
      topicMap.set(topic, current);
    }

    for (const definition of STRUCTURE_DEFINITIONS) {
      if (!definition.test(video.title)) continue;
      const current = structureMap.get(definition.id) ?? {
        definition,
        score: 0,
        videos: new Set<string>(),
        evidence: [],
      };
      current.score += weight;
      current.videos.add(video.videoId);
      if (current.evidence.length < 3) current.evidence.push(video.title);
      structureMap.set(definition.id, current);
    }
  }

  const topics = [...topicMap.entries()]
    .map(([topic, data]) => ({
      topic,
      score: Math.round((data.score + data.channels.size * 1.5 + data.videos.size) * 10) / 10,
      confidence: topicConfidence(data.videos.size, data.channels.size),
      supportCount: data.videos.size,
      distinctChannels: data.channels.size,
      evidenceTitles: data.evidence,
    } satisfies TrendTopicCandidate))
    .sort((a, b) => b.score - a.score || b.distinctChannels - a.distinctChannels)
    .filter((topic, index, all) => !all.slice(0, index).some((earlier) => earlier.topic.includes(topic.topic)))
    .slice(0, 8);

  const structures = [...structureMap.values()]
    .map((data) => ({
      id: data.definition.id,
      label: data.definition.label,
      score: Math.round(data.score * 10) / 10,
      supportCount: data.videos.size,
      evidenceTitles: data.evidence,
    } satisfies TrendStructureCandidate))
    .sort((a, b) => b.score - a.score || b.supportCount - a.supportCount)
    .slice(0, 4);

  const cleanQuery = explicitQuery.trim();
  const queryIsGeneric = !cleanQuery || /^(쇼츠|shorts?|ショート)$/i.test(cleanQuery);
  const primary = queryIsGeneric ? topics[0]?.topic : cleanQuery;
  const confidence = topics[0]?.confidence ?? 'exploratory';
  return {
    primaryTopic: primary || (region === 'KR' ? '생활 꿀팁' : 'daily tips'),
    confidence,
    recommendedNicheId: recommendedNiche(structures),
    topics,
    structures,
    analyzedVideos: matching.length,
    distinctChannels: new Set(matching.map((video) => video.channelTitle || video.videoId)).size,
    generatedAt: new Date().toISOString(),
  };
}

export function toTrendSignals(videos: RankedShort[], region: RegionCode = 'KR'): TrendSignal[] {
  const preferHangul = region === 'KR';
  return videos
    .filter((video) => titleMatchesRegion(video.title, region))
    .slice(0, 8)
    .map((video) => ({
      title: video.title,
      channelTitle: video.channelTitle,
      keyword: keywordFromTitle(video.title, preferHangul),
      velocityPerHour: video.velocity,
      views: video.views,
      videoId: video.videoId,
    }));
}

// Hook library grounded in short-form retention behavior: the first 1-2 seconds
// decide whether the viewer stays, so every pattern front-loads tension or payoff.
const HOOK_LIBRARY: HookTemplate[] = [
  { category: '결과 선공개', pattern: '완성/최종 결과를 첫 프레임에 노출', example: '“이게 최종 결과입니다. 어떻게 했을까요?”', why: '보상을 먼저 보여줘 이탈을 막고 과정을 궁금하게 만듭니다.' },
  { category: '통념 반박', pattern: '흔한 믿음을 즉시 부정', example: '“대부분 이걸 반대로 알고 있습니다.”', why: '기존 지식과 충돌시켜 확인 욕구를 자극합니다.' },
  { category: '손실 회피', pattern: '모르면 손해라는 위험 제시', example: '“이거 모르면 계속 손해 봅니다.”', why: '이득보다 손실 회피가 클릭을 강하게 유발합니다.' },
  { category: '즉시성', pattern: '지금·1초·오늘 같은 즉각 보상', example: '“1초 만에 확인하는 법.”', why: '노력 대비 즉각 보상을 약속해 진입 장벽을 낮춥니다.' },
  { category: '호기심 격차', pattern: '핵심 정보를 살짝 감추기', example: '“마지막 한 가지가 진짜입니다.”', why: '정보 공백을 만들어 끝까지 보게 합니다.' },
  { category: '동일시', pattern: '시청자의 상황을 지목', example: '“아직도 이렇게 하세요?”', why: '자신의 이야기라고 느끼면 이탈하지 않습니다.' },
  { category: '반전 예고', pattern: '결말이 뒤집힌다고 암시', example: '“끝까지 보면 완전히 달라집니다.”', why: '엔딩까지의 시청 지속을 끌어올립니다.' },
];

function topicWords(topic: string, fallback: string[]): string[] {
  const words = topic
    .replace(/[#()[\]{}!?.,:;“”"']/g, ' ')
    .split(/\s+/)
    .map((word) => word.trim())
    .filter((word) => word.length >= 2);
  return words.length ? words.slice(0, 5) : fallback;
}

function buildSeries(
  niche: NicheBlueprint,
  subject: string,
  insights: MarketLaunchInsights,
): SeriesConcept[] {
  const inferredFormats = insights.structures.map((structure) => structure.label);
  const formats = [...new Set([...inferredFormats, ...niche.formats])].slice(0, 3);
  return formats.map((format, index) => {
    const names = [`${subject} 바로잡기`, `${subject} 3초 정리`, `${subject} 실전편`];
    return {
      name: names[index] ?? `${subject} 시리즈 ${index + 1}`,
      premise: `${niche.promise} — ${format} 포맷으로 매 회 하나의 문제만 다룹니다.`,
      episodePattern: `EP.## | ${format} | 고정 인트로 로고 없이 훅부터 시작`,
      visualRule: index === 0
        ? '좌상단 시리즈 배지, 하단 자막 2줄 고정, 밝은 대비 색 1개'
        : index === 1
          ? '숫자 카운터(1/3, 2/3, 3/3)로 진행 표시'
          : '전/후 화면을 동일 구도로 분할 비교',
      sampleEpisodes: [
        `${subject}에서 가장 흔한 실수`,
        `${subject}, 이 순서만 바꿔도 달라집니다`,
        `${subject} 초보가 놓치는 한 가지`,
      ],
    };
  });
}

function focusForDay(index: number): CalendarEntry['focus'] {
  // Rotate emphasis so the channel trains every growth lever, not just reach.
  const cycle: CalendarEntry['focus'][] = ['reach', 'retention', 'engagement', 'reach', 'conversion'];
  return cycle[index % cycle.length];
}

function ctaForFocus(focus: CalendarEntry['focus']): string {
  return {
    reach: '저장하고 싶으면 저장 버튼, 주변에 공유해 주세요',
    retention: '끝에 반전이 있으니 끝까지 보세요',
    engagement: '여러분 방식은 어떤지 댓글로 알려주세요',
    conversion: '이런 실전 팁이 매일 올라옵니다. 구독하면 놓치지 않아요',
  }[focus];
}

function isoDate(value: string): Date {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed) : new Date();
}

function buildCalendar(
  series: SeriesConcept[],
  subject: string,
  inputs: LaunchInputs,
  trends: TrendSignal[],
  structures: TrendStructureCandidate[],
): CalendarEntry[] {
  const start = isoDate(inputs.startDateLocal);
  const perWeek = inputs.cadencePerWeek;
  // Spread posts evenly across each week based on the chosen cadence.
  const weekdayGaps = perWeek >= 7
    ? [0, 1, 2, 3, 4, 5, 6]
    : perWeek === 5
      ? [0, 1, 2, 3, 4]
      : [0, 2, 4];
  const formatter = new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' });
  const entries: CalendarEntry[] = [];
  let dayCounter = 0;
  for (let week = 0; entries.length < 30; week += 1) {
    for (const gap of weekdayGaps) {
      if (entries.length >= 30) break;
      const date = new Date(start.getTime() + (week * 7 + gap) * DAY_MS);
      const seriesConcept = series[entries.length % series.length];
      const hook = HOOK_LIBRARY[entries.length % HOOK_LIBRARY.length];
      const focus = focusForDay(entries.length);
      // Every third slot chases a live trending keyword so the channel rides current demand
      // while the other slots build the durable evergreen series.
      const trend = trends.length && entries.length % 3 === 2
        ? trends[Math.floor(entries.length / 3) % trends.length]
        : null;
      const structure = structures[entries.length % Math.max(1, structures.length)];
      const workingTitle = trend
        ? `${subject} × ${trend.keyword} · ${structure?.label ?? '트렌드 재해석'}`
        : `${subject} · ${seriesConcept.sampleEpisodes[entries.length % seriesConcept.sampleEpisodes.length]}`;
      entries.push({
        day: entries.length + 1,
        dateLabel: formatter.format(date),
        seriesName: trend ? '트렌드 추종' : seriesConcept.name,
        workingTitle,
        hook: hook.example,
        focus: trend ? 'reach' : focus,
        cta: ctaForFocus(trend ? 'reach' : focus),
        ...(trend ? {
          trendTie: `${trend.keyword} (${trend.channelTitle})`,
          inferredStructure: structure?.label ?? '트렌드 재해석',
        } : {}),
      });
      dayCounter += 1;
    }
    if (dayCounter > 400) break; // Safety guard against infinite loops.
  }
  return entries;
}

function retentionChecklist(): RetentionCheck[] {
  return [
    { label: '0–2초 훅', target: '이탈 최소화', detail: '로고·인사 없이 결과나 갈등을 먼저 보여줍니다.' },
    { label: '자막 가독성', target: '무음 시청 대응', detail: '핵심 단어를 큰 자막으로, 한 화면 2줄 이내로 유지합니다.' },
    { label: '한 컷 한 정보', target: '지루함 방지', detail: '1.5~2.5초마다 화면·정보·소리 중 하나를 바꿉니다.' },
    { label: '루프 설계', target: '평균 조회율 100% 초과', detail: '마지막 프레임이 첫 프레임과 자연스럽게 이어지게 만듭니다.' },
    { label: '단일 메시지', target: '완주율 상승', detail: '영상 하나에 주제 하나. 곁가지는 다음 편으로 미룹니다.' },
    { label: '엔딩 CTA', target: '구독·댓글 전환', detail: '다음 영상 예고 또는 시청자 경험을 묻는 질문으로 마칩니다.' },
  ];
}

export function generateLaunchKit(
  inputs: LaunchInputs,
  region: RegionCode = 'KR',
  trendSignals: TrendSignal[] = [],
  marketInsights?: MarketLaunchInsights,
): LaunchKit {
  const fallbackInsights: MarketLaunchInsights = {
    primaryTopic: inputs.topic.trim() || (region === 'KR' ? '생활 꿀팁' : 'daily tips'),
    confidence: 'exploratory',
    recommendedNicheId: inputs.nicheId,
    topics: [],
    structures: [],
    analyzedVideos: 0,
    distinctChannels: 0,
    generatedAt: new Date().toISOString(),
  };
  const insights = marketInsights ?? fallbackInsights;
  const niche = blueprintById(inputs.nicheId);
  const fallback = niche.keywords.slice(0, 3);
  const words = topicWords(inputs.topic || insights.primaryTopic, fallback);
  const subject = words.slice(0, 2).join(' ') || niche.label;
  const series = buildSeries(niche, subject, insights);
  const calendar = buildCalendar(series, subject, inputs, trendSignals, insights.structures);
  const regionLabel = REGION_LABELS[region] ?? region;

  return {
    niche,
    channelPromise: `${subject}에 대해 ${niche.promise}`,
    regionLabel,
    marketInsights: insights,
    trendSignals,
    trendPlaybook: trendSignals.length
      ? [
        `${regionLabel} 상위 ${insights.analyzedVideos}개 영상·${insights.distinctChannels}개 채널을 분석해 “${insights.primaryTopic}”을 ${insights.confidence} 신뢰도 주제로 선정했습니다.`,
        `성과가 반복된 제목 구조(${insights.structures.map((item) => item.label).join(', ') || '데이터 탐색 중'})를 시리즈와 트렌드 슬롯에 반영했습니다.`,
        '뜨는 주제는 24시간 안에 내 니치 관점으로 재해석해 발행 속도를 우선합니다.',
        '트렌드 영상을 복제하지 말고, 같은 주제를 내 포맷·사례로 다시 만드세요.',
        '반응이 좋은 트렌드 접목 편은 즉시 3부작 시리즈로 확장합니다.',
      ]
      : [
        `${regionLabel} 시장 레이더를 먼저 실행하면, 지금 뜨는 주제가 캘린더에 자동 접목됩니다.`,
        '트렌드 신호 없이도 에버그린 시리즈로 채널 정체성을 먼저 쌓을 수 있습니다.',
        '시장 레이더 → 채널 런치 순서로 열면 트렌드 추종형 캘린더가 만들어집니다.',
      ],
    visualIdentity: [
      '채널명·프로필·배너에 한 문장 약속을 그대로 노출',
      '모든 썸네일에 동일한 색 1개와 폰트 1개만 사용',
      '시리즈별 좌상단 배지로 채널을 3초 안에 각인',
      '9:16 세로 고정, 안전 영역 밖에 UI 겹치지 않기',
    ],
    series,
    hooks: HOOK_LIBRARY,
    calendar,
    retentionChecklist: retentionChecklist(),
    weeklyReview: [
      '조회수보다 평균 조회율과 시청 유지 그래프를 먼저 봅니다.',
      '가장 잘된 영상의 첫 3초를 그대로 다음 영상에 재사용합니다.',
      '이탈이 급감하는 지점을 찾아 그 구간을 짧게 다시 편집합니다.',
      '한 주에 한 가지 변수(훅/길이/자막)만 바꿔 실험합니다.',
      '상위 영상 주제를 다음 주 시리즈로 3편 더 확장합니다.',
    ],
    firstWeekActions: [
      `채널명과 소개에 “${subject} ${niche.promise}”를 한 문장으로 고정`,
      `시리즈 1개(${series[0].name})로 첫 5편을 배치 촬영`,
      `${inputs.cadencePerWeek >= 7 ? '매일' : `주 ${inputs.cadencePerWeek}회`} 같은 시간대에 발행 예약`,
      '첫 3초 훅 3안을 만들어 CapCut 작업팩으로 대본화',
      '발행 48시간 뒤 평균 조회율만 기록해 기준선 확보',
    ],
    createdAt: new Date().toISOString(),
  };
}
