import type { ShortsVideo } from '../types';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

export function createDemoVideos(now = Date.now()): ShortsVideo[] {
  const bucket = Math.floor(now / (5 * MINUTE)) % 1000;
  const items = [
    {
      id: 'demo-01', title: '5초 만에 시선을 붙잡는 오프닝 공식 3가지', channel: '크리에이터 랩', age: 4, base: 1_842_000, step: 18_400,
      tags: ['shorts', '유튜브성장', '콘텐츠기획'], color: 'ff5c35', description: '첫 문장, 화면 전환, 결과 선공개로 이탈률을 낮추는 오프닝 구조를 분석합니다.',
    },
    {
      id: 'demo-02', title: '평범한 책상이 영화 세트로 바뀌는 순간', channel: '메이크 씬', age: 9, base: 934_200, step: 12_900,
      tags: ['shorts', 'beforeafter', '촬영팁'], color: '8b5cf6', description: '조명 하나와 카메라 무빙만으로 공간 분위기를 바꾸는 비포·애프터 영상입니다.',
    },
    {
      id: 'demo-03', title: 'AI에게 하루를 맡겼더니 생긴 일', channel: '오늘의 실험실', age: 18, base: 2_305_000, step: 9_700,
      tags: ['shorts', 'AI', 'experiment'], color: '20c997', description: '아침부터 저녁까지 AI의 선택만 따라가며 예상 밖의 결과를 기록한 실험형 콘텐츠입니다.',
    },
    {
      id: 'demo-04', title: '다들 반대로 알고 있는 스마트폰 촬영법', channel: '포켓 디렉터', age: 3, base: 442_800, step: 8_300,
      tags: ['shorts', '스마트폰촬영', '반전'], color: '0ea5e9', description: '디지털 줌과 피사체 거리의 흔한 오해를 한 장면 비교로 설명합니다.',
    },
    {
      id: 'demo-05', title: '60초 안에 끝내는 편집 리듬 체크리스트', channel: '컷앤비트', age: 30, base: 1_128_000, step: 4_100,
      tags: ['shorts', '영상편집', 'retention'], color: 'f59e0b', description: '컷 길이, 효과음, 자막 밀도를 순서대로 점검하는 편집 체크리스트입니다.',
    },
    {
      id: 'demo-06', title: '댓글이 폭발하는 마지막 한 문장', channel: '스토리 메이커', age: 12, base: 672_400, step: 6_200,
      tags: ['shorts', '댓글', '스토리텔링'], color: 'ec4899', description: '정답을 강요하지 않고 시청자의 경험을 끌어내는 엔딩 질문을 비교합니다.',
    },
  ];

  return items.map((item, index) => ({
    videoId: item.id,
    title: item.title,
    channelTitle: item.channel,
    publishedAt: new Date(now - item.age * HOUR).toISOString(),
    description: item.description,
    thumbnailUrl: `https://placehold.co/720x1280/${item.color}/09090b?text=${encodeURIComponent(`DEMO ${index + 1}`)}`,
    durationSeconds: 34 + index * 4,
    views: item.base + bucket * item.step,
    likes: Math.floor((item.base + bucket * item.step) * (0.038 + index * 0.003)),
    comments: Math.floor((item.base + bucket * item.step) * (0.0016 + index * 0.0002)),
    tags: item.tags,
    hasCaptions: index !== 1,
    isDemo: true,
  }));
}
