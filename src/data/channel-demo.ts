import type { ChannelDataset, ChannelVideo, ContentKind, VideoMetrics } from '../types';

const DAY_MS = 86_400_000;

interface DemoVideoSeed {
  id: string;
  title: string;
  daysAgo: number;
  duration: number;
  kind: ContentKind;
  views: number;
  lifetime: number;
  likes: number;
  comments: number;
  shares: number;
  impressions: number;
  ctr: number;
  averagePercentage: number;
  subscribers: number;
  tags: string[];
  color: string;
}

function thumbnail(_title: string, color: string, label: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360"><defs><linearGradient id="g" x1="0" x2="1"><stop stop-color="#0d0f0e"/><stop offset="1" stop-color="#${color}"/></linearGradient></defs><rect width="640" height="360" fill="url(#g)"/><rect x="38" y="38" width="96" height="28" fill="#dfff00"/><text x="49" y="58" fill="#090a0a" font-family="Arial" font-size="13" font-weight="700">${label}</text><circle cx="510" cy="90" r="105" fill="none" stroke="#dfff00" stroke-width="3" opacity=".8"/><path d="M42 256h360" stroke="#f2f4ed" stroke-width="2"/><text x="42" y="236" fill="#fff" font-family="Arial" font-size="32" font-weight="700">CONTENT SIGNAL</text><text x="43" y="292" fill="#dfff00" font-family="Arial" font-size="17">CHANNEL PULSE</text></svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function metrics(seed: DemoVideoSeed): VideoMetrics {
  return {
    views: seed.views,
    lifetimeViews: seed.lifetime,
    likes: seed.likes,
    comments: seed.comments,
    shares: seed.shares,
    impressions: seed.impressions,
    impressionClickThroughRate: seed.ctr,
    watchTimeMinutes: Math.round(seed.views * seed.duration * seed.averagePercentage / 100 / 60),
    averageViewDurationSeconds: Math.round(seed.duration * seed.averagePercentage / 100),
    averagePercentageViewed: seed.averagePercentage,
    subscribersGained: Math.max(0, seed.subscribers),
    subscribersLost: Math.max(0, -seed.subscribers),
  };
}

function mapSeed(seed: DemoVideoSeed, index: number, now: number): ChannelVideo {
  return {
    videoId: seed.id,
    channelId: 'UCDEMOCHANNELPULSE00001',
    channelTitle: '오늘의 크리에이터랩',
    title: seed.title,
    description: `${seed.title} 주제를 직접 실험하고, 결과와 시행착오를 단계별로 설명한 콘텐츠입니다.`,
    publishedAt: new Date(now - seed.daysAgo * DAY_MS).toISOString(),
    thumbnailUrl: thumbnail(seed.title, seed.color, seed.kind === 'short' ? 'SHORTS' : `EP.${String(index + 1).padStart(2, '0')}`),
    durationSeconds: seed.duration,
    tags: seed.tags,
    categoryId: '27',
    contentKind: seed.kind,
    contentKindConfidence: 'verified',
    metrics: metrics(seed),
    source: 'demo',
  };
}

export function createDemoChannelDataset(now = Date.now()): ChannelDataset {
  const seeds: DemoVideoSeed[] = [
    { id: 'demo-channel-01', title: '조회수가 멈춘 영상, 제목보다 먼저 볼 것', daysAgo: 8, duration: 642, kind: 'video', views: 184200, lifetime: 215800, likes: 7900, comments: 612, shares: 1450, impressions: 2_710_000, ctr: 5.8, averagePercentage: 48.4, subscribers: 1240, tags: ['유튜브성장', '시청지속시간', '콘텐츠전략'], color: '3B4E3F' },
    { id: 'demo-channel-02', title: '첫 3초를 이렇게 바꿨더니', daysAgo: 13, duration: 43, kind: 'short', views: 812000, lifetime: 936000, likes: 42600, comments: 1820, shares: 6900, impressions: 1_120_000, ctr: 8.1, averagePercentage: 92.0, subscribers: 2320, tags: ['shorts', '유튜브팁', 'hook'], color: '7255B5' },
    { id: 'demo-channel-03', title: '초보 유튜버 장비 추천 총정리 | 카메라 조명 마이크 편집 프로그램 입문 가이드', daysAgo: 22, duration: 905, kind: 'video', views: 29400, lifetime: 31800, likes: 880, comments: 93, shares: 102, impressions: 1_350_000, ctr: 1.7, averagePercentage: 25.8, subscribers: 86, tags: ['카메라', '조명', '마이크', '유튜브장비', '초보유튜버', '편집', '장비추천', '촬영장비', '입문', '가이드', '렌즈', '삼각대', '무선마이크', '조명추천', '카메라추천', '편집프로그램'], color: '574437' },
    { id: 'demo-channel-04', title: '자막을 절반으로 줄여야 하는 이유', daysAgo: 29, duration: 51, kind: 'short', views: 356000, lifetime: 402000, likes: 18400, comments: 740, shares: 2850, impressions: 710000, ctr: 6.6, averagePercentage: 78.3, subscribers: 610, tags: ['shorts', '자막', '영상편집'], color: '315C66' },
    { id: 'demo-channel-05', title: '#대박 #충격 알고리즘 무조건 타는 비법 공개합니다', daysAgo: 36, duration: 388, kind: 'video', views: 18100, lifetime: 20100, likes: 410, comments: 52, shares: 34, impressions: 610000, ctr: 2.2, averagePercentage: 21.0, subscribers: 22, tags: ['알고리즘', '조회수', '비법'], color: '6A2C36' },
    { id: 'demo-channel-06', title: '썸네일 A/B 테스트 실제 결과', daysAgo: 44, duration: 714, kind: 'video', views: 121000, lifetime: 166000, likes: 5200, comments: 438, shares: 802, impressions: 2_040_000, ctr: 5.2, averagePercentage: 52.1, subscribers: 940, tags: ['썸네일', 'AB테스트', '유튜브스튜디오'], color: '435B3A' },
    { id: 'demo-channel-07', title: '조회수 10배 차이를 만든 한 문장', daysAgo: 51, duration: 37, kind: 'short', views: 1270000, lifetime: 1640000, likes: 73100, comments: 2630, shares: 11200, impressions: 1_580_000, ctr: 8.8, averagePercentage: 106.2, subscribers: 3810, tags: ['shorts', '오프닝', '스토리텔링'], color: '9B572D' },
    { id: 'demo-channel-08', title: '꾸준히 올리는데 채널이 크지 않는 5가지 이유', daysAgo: 64, duration: 821, kind: 'video', views: 78500, lifetime: 143000, likes: 3300, comments: 510, shares: 620, impressions: 1_890_000, ctr: 3.4, averagePercentage: 39.5, subscribers: 470, tags: ['채널성장', '유튜브분석', '크리에이터'], color: '2C5364' },
    { id: 'demo-channel-09', title: '편집이 느린 사람의 공통점', daysAgo: 78, duration: 48, kind: 'short', views: 94000, lifetime: 171000, likes: 4100, comments: 182, shares: 390, impressions: 455000, ctr: 4.1, averagePercentage: 59.2, subscribers: 94, tags: ['shorts', '영상편집', '생산성'], color: '514C83' },
    { id: 'demo-channel-10', title: '구독을 부르는 콘텐츠 시리즈 설계법', daysAgo: 96, duration: 1024, kind: 'video', views: 42100, lifetime: 120000, likes: 1980, comments: 260, shares: 334, impressions: 980000, ctr: 3.6, averagePercentage: 43.8, subscribers: 680, tags: ['콘텐츠기획', '시리즈', '구독자'], color: '3E624C' },
    { id: 'demo-channel-11', title: '댓글이 달리는 마지막 질문', daysAgo: 112, duration: 41, kind: 'short', views: 218000, lifetime: 670000, likes: 10900, comments: 1540, shares: 730, impressions: 510000, ctr: 5.9, averagePercentage: 71.4, subscribers: 280, tags: ['shorts', '댓글', 'CTA'], color: '7A3D61' },
    { id: 'demo-channel-12', title: '90일 채널 성장 실험에서 배운 것', daysAgo: 137, duration: 1188, kind: 'video', views: 61700, lifetime: 311000, likes: 2880, comments: 402, shares: 480, impressions: 1_240_000, ctr: 4.0, averagePercentage: 46.7, subscribers: 520, tags: ['채널성장', '90일실험', '데이터분석'], color: '4E493A' },
  ];

  const benchmarkSource: DemoVideoSeed[] = [
    { id: 'benchmark-01', title: '유튜브 첫 30초, 시청자가 나가는 진짜 이유', daysAgo: 6, duration: 588, kind: 'video', views: 742000, lifetime: 810000, likes: 29100, comments: 1810, shares: 4220, impressions: 7_800_000, ctr: 6.9, averagePercentage: 55.2, subscribers: 0, tags: ['유튜브성장', '시청지속시간'], color: '1F6B64' },
    { id: 'benchmark-02', title: '조회수보다 먼저 봐야 할 숫자 3개', daysAgo: 11, duration: 54, kind: 'short', views: 2180000, lifetime: 2310000, likes: 122000, comments: 3380, shares: 16500, impressions: 2_900_000, ctr: 9.1, averagePercentage: 102.0, subscribers: 0, tags: ['shorts', '유튜브분석'], color: '7454A3' },
    { id: 'benchmark-03', title: '썸네일을 바꾸고 7일 동안 생긴 일', daysAgo: 17, duration: 702, kind: 'video', views: 518000, lifetime: 650000, likes: 21300, comments: 1250, shares: 2900, impressions: 6_400_000, ctr: 7.2, averagePercentage: 50.1, subscribers: 0, tags: ['썸네일', '실험'], color: '92632E' },
    { id: 'benchmark-04', title: '쇼츠 첫 장면은 이렇게 찍으세요', daysAgo: 4, duration: 38, kind: 'short', views: 1640000, lifetime: 1710000, likes: 98500, comments: 2410, shares: 12100, impressions: 2_100_000, ctr: 8.5, averagePercentage: 108.4, subscribers: 0, tags: ['shorts', '촬영팁'], color: '2D6F8A' },
  ];
  const benchmarkSeeds: ChannelVideo[] = benchmarkSource.map((seed, index) => ({
    ...mapSeed(seed, index, now),
    channelId: `UCDEMOPEER${String(index).padStart(12, '0')}`,
    channelTitle: ['성장노트', '1분 크리에이터', '데이터튜브', '포켓 디렉터'][index],
  }));

  const end = new Date(now - 3 * DAY_MS);
  const start = new Date(end.getTime() - 364 * DAY_MS);
  return {
    source: 'demo',
    fetchedAt: new Date(now).toISOString(),
    dateRange: { startDate: start.toISOString().slice(0, 10), endDate: end.toISOString().slice(0, 10) },
    channel: {
      channelId: 'UCDEMOCHANNELPULSE00001',
      title: '오늘의 크리에이터랩',
      description: '데이터로 더 좋은 콘텐츠를 만드는 성장형 크리에이터 채널',
      customUrl: '@creator-lab-demo',
      avatarUrl: thumbnail('C', 'DFFF00', 'DEMO'),
      subscribers: 128400,
      totalViews: 18_420_000,
      videoCount: 86,
      publishedAt: new Date(now - 920 * DAY_MS).toISOString(),
    },
    videos: seeds.map((seed, index) => mapSeed(seed, index, now)),
    trafficSources: [
      { source: 'SHORTS', views: 2_520_000, watchTimeMinutes: 1_880_000 },
      { source: 'SUGGESTED', views: 438_000, watchTimeMinutes: 2_120_000 },
      { source: 'BROWSE', views: 326_000, watchTimeMinutes: 1_870_000 },
      { source: 'YT_SEARCH', views: 172_000, watchTimeMinutes: 804_000 },
      { source: 'EXTERNAL', views: 94_000, watchTimeMinutes: 310_000 },
    ],
    benchmarks: benchmarkSeeds,
    truncated: false,
    warnings: ['현재 화면은 기능 확인을 위한 샘플 채널입니다. 숫자와 채널명은 실제 데이터가 아닙니다.'],
  };
}
