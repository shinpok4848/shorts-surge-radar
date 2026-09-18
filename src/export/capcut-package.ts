import type { AnalyzedVideo, ChannelVideo, ProductionDraft, RankedShort } from '../types';
import { createZip, type ZipTextFile } from './zip';

interface CaptionCue {
  index: number;
  start: number;
  end: number;
  text: string;
  shot: string;
}

type SourceVideo = ChannelVideo | AnalyzedVideo | RankedShort;

const DEFAULT_SHOTS = [
  '완성 결과 또는 가장 강한 대비 장면을 세로 풀프레임으로 시작',
  '문제가 생기는 실제 상황을 손·표정·대상 클로즈업으로 제시',
  '흔한 방법을 짧게 재현하고 화면에 핵심 단어 하나만 표시',
  '한 가지 변수만 바꾼 과정을 2~3개 빠른 컷으로 비교',
  '전후 결과를 같은 구도에서 보여주고 수치 또는 증거를 강조',
  '카메라를 보며 결론과 다음 실험 질문으로 마무리',
];

function cleanWords(title: string): string[] {
  const stop = new Set(['그리고', '하지만', '하는', '있는', '없는', '영상', '쇼츠', 'shorts', 'youtube', '유튜브', '정말', '진짜']);
  return title
    .replace(/[#|｜()[\]{}!?.,:;“”"']/g, ' ')
    .split(/\s+/)
    .map((word) => word.trim())
    .filter((word) => word.length >= 2 && !stop.has(word.toLocaleLowerCase()));
}

function sourceFields(video: SourceVideo): {
  videoId: string;
  title: string;
  channelTitle: string;
  description: string;
  tags: string[];
  thumbnailUrl: string;
} {
  if ('metrics' in video) {
    return {
      videoId: video.videoId,
      title: video.title,
      channelTitle: video.channelTitle ?? '내 채널',
      description: video.description,
      tags: video.tags,
      thumbnailUrl: video.thumbnailUrl,
    };
  }
  return {
    videoId: video.videoId,
    title: video.title,
    channelTitle: video.channelTitle,
    description: video.description,
    tags: video.tags,
    thumbnailUrl: video.thumbnailUrl,
  };
}

function uniqueTags(tags: string[]): string[] {
  const normalized = tags
    .map((tag) => tag.replace(/^#/, '').trim())
    .filter((tag) => tag.length >= 2 && tag.length <= 40);
  return [...new Set(normalized)].slice(0, 12);
}

export function createProductionDraft(video: SourceVideo, sourceType: ProductionDraft['sourceType']): ProductionDraft {
  const source = sourceFields(video);
  const words = cleanWords(source.title);
  const subject = words.slice(0, 2).join(' ') || '이번 주제';
  const scriptLines = [
    `${subject}, 결과가 갈리는 장면부터 보여드릴게요.`,
    '보통은 여러 요소를 한꺼번에 바꾸지만 그러면 진짜 원인을 알기 어렵습니다.',
    '먼저 가장 흔한 방법을 같은 조건에서 직접 확인했습니다.',
    '이번에는 한 가지 변수만 바꾸고 전후 과정을 나란히 비교해 봤습니다.',
    '결과를 보면 복잡한 비법보다 핵심 조건을 먼저 바꾸는 것이 중요했습니다.',
    '여러분이라면 다음에는 어떤 방법을 직접 시험해 보고 싶으신가요?',
  ];
  const tags = uniqueTags([...source.tags, ...words.slice(0, 5), 'shorts']);
  return {
    id: `pack-${source.videoId}-${Date.now()}`,
    sourceType,
    sourceVideoId: source.videoId,
    sourceTitle: source.title,
    sourceChannelTitle: source.channelTitle,
    sourceThumbnailUrl: source.thumbnailUrl,
    sourceUrl: `https://www.youtube.com/watch?v=${encodeURIComponent(source.videoId)}`,
    targetDurationSeconds: 60,
    title: `${subject}, 직접 바꿔보고 확인한 결과`,
    description: `${subject}를 직접 확인하고 한 가지 조건만 바꿔 전후 결과를 비교했습니다.\n\n직접 촬영·해설한 원본 콘텐츠입니다.`,
    tags,
    script: scriptLines.join('\n'),
    shotDirections: DEFAULT_SHOTS,
    createdAt: new Date().toISOString(),
  };
}

export function updateProductionDraft(
  draft: ProductionDraft,
  fields: { title: string; description: string; tags: string; script: string; targetDurationSeconds?: number },
): ProductionDraft {
  return {
    ...draft,
    title: fields.title.trim().slice(0, 100),
    description: fields.description.trim().slice(0, 5000),
    tags: uniqueTags(fields.tags.split(/[,\n]/)),
    script: fields.script.trim(),
    targetDurationSeconds: Math.min(60, Math.max(15, fields.targetDurationSeconds ?? draft.targetDurationSeconds)),
  };
}

function scriptLines(script: string): string[] {
  return script
    .split(/\n+/)
    .map((line) => line.replace(/^\s*(?:\d+[.)]|[-*])\s*/, '').trim())
    .filter(Boolean)
    .slice(0, 16);
}

function buildCues(draft: ProductionDraft): CaptionCue[] {
  const lines = scriptLines(draft.script);
  if (!lines.length) throw new Error('대본 문장을 한 줄 이상 입력해 주세요.');
  const duration = Math.min(60, Math.max(15, draft.targetDurationSeconds));
  const gap = .12;
  const available = duration - gap * Math.max(0, lines.length - 1);
  const weights = lines.map((line) => Math.max(8, [...line].length));
  const totalWeight = weights.reduce((sum, value) => sum + value, 0);
  let cursor = 0;
  return lines.map((line, index) => {
    const cueDuration = index === lines.length - 1
      ? duration - cursor
      : available * weights[index] / totalWeight;
    const start = cursor;
    const end = Math.min(duration, start + cueDuration);
    cursor = end + gap;
    return {
      index: index + 1,
      start,
      end,
      text: line,
      shot: draft.shotDirections[index] ?? '대본 의미를 직접 보여주는 원본 장면 또는 B-roll',
    };
  });
}

function srtTime(seconds: number): string {
  const milliseconds = Math.max(0, Math.round(seconds * 1000));
  const hours = Math.floor(milliseconds / 3_600_000);
  const minutes = Math.floor((milliseconds % 3_600_000) / 60_000);
  const secs = Math.floor((milliseconds % 60_000) / 1000);
  const millis = milliseconds % 1000;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')},${String(millis).padStart(3, '0')}`;
}

function wrapCaption(text: string): string {
  const characters = [...text];
  const lines: string[] = [];
  for (let index = 0; index < characters.length; index += 22) lines.push(characters.slice(index, index + 22).join(''));
  return lines.join('\n');
}

function csvCell(value: string | number): string {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function safeName(value: string): string {
  const clean = value.normalize('NFC').replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, '_').slice(0, 42);
  return clean || 'shorts_project';
}

export function buildCapCutFiles(draft: ProductionDraft): ZipTextFile[] {
  const cues = buildCues(draft);
  const srt = cues.map((cue) => `${cue.index}\n${srtTime(cue.start)} --> ${srtTime(cue.end)}\n${wrapCaption(cue.text)}\n`).join('\n');
  const shotCsv = [
    ['번호', '시작', '종료', '대본', '촬영/편집 지시'],
    ...cues.map((cue) => [cue.index, cue.start.toFixed(2), cue.end.toFixed(2), cue.text, cue.shot]),
  ].map((row) => row.map(csvCell).join(',')).join('\n');
  const tagsText = draft.tags.map((tag) => `#${tag}`).join(' ');
  const metadata = {
    title: draft.title,
    description: draft.description,
    tags: draft.tags,
    categoryId: '22',
    madeForKids: false,
    containsSyntheticMedia: false,
    targetDurationSeconds: draft.targetDurationSeconds,
    sourceReference: {
      title: draft.sourceTitle,
      channel: draft.sourceChannelTitle,
      url: draft.sourceUrl,
      use: 'structure-reference-only',
    },
    copyright: 'Use only footage, music, narration, and text you own or are licensed to use.',
  };
  const readme = [
    'CAPCUT 작업팩 사용법',
    '',
    '1. CapCut Desktop 또는 Web에서 새 9:16 프로젝트를 만듭니다.',
    '2. 직접 촬영했거나 사용 권한이 있는 영상·음원만 가져옵니다.',
    '3. 캡션 가져오기 메뉴에서 01_capcut_captions.srt를 UTF-8 자막으로 불러옵니다.',
    '4. 03_shot_list.csv를 보며 각 시간대에 직접 촬영한 장면을 배치합니다.',
    '5. 04_youtube_metadata.txt의 제목·설명·태그를 검토해 최종 업로드에 사용합니다.',
    '',
    '중요: 참고 영상의 대본·화면·음원을 복사한 파일이 아닙니다. 이 팩은 공개 메타데이터에서 주제와 구조만 참고해 새로 작성된 원본 초안입니다.',
    '본인이 권리를 가진 대본으로 textarea를 교체했다면 그 대본이 그대로 SRT와 TXT에 반영됩니다.',
    '',
    'CapCut 모바일 앱은 외부 SRT 직접 가져오기가 제한될 수 있으므로 Desktop 또는 Web 사용을 권장합니다.',
  ].join('\n');
  return [
    { name: '01_capcut_captions.srt', content: `\uFEFF${srt}` },
    { name: '02_voiceover_script.txt', content: `\uFEFF${cues.map((cue) => cue.text).join('\n')}` },
    { name: '03_shot_list.csv', content: `\uFEFF${shotCsv}` },
    { name: '04_youtube_metadata.txt', content: `\uFEFF제목\n${draft.title}\n\n설명\n${draft.description}\n\n태그\n${tagsText}\n` },
    { name: '05_youtube_metadata.json', content: JSON.stringify(metadata, null, 2) },
    { name: '06_reference_study.txt', content: `\uFEFF참고 영상 학습 노트\n\n제목: ${draft.sourceTitle}\n채널: ${draft.sourceChannelTitle}\n주소: ${draft.sourceUrl}\n\n[학습 방법]\n1. 위 주소를 브라우저에서 직접 열어 시청합니다.\n2. 첫 3초에서 무엇을 먼저 보여주는지, 어떤 훅을 쓰는지 메모합니다.\n3. 정보가 바뀌는 지점(컷 전환)의 리듬을 관찰합니다.\n4. 그 구조를 참고해 내 사례·화면·해설로 새로 촬영합니다.\n\n[금지]\n- 원본 영상 파일 다운로드 및 재업로드\n- 원본 화면·음원·대본을 그대로 사용\n- 미세 변형 후 재업로드\n\n이 도구는 원본을 복제하지 않습니다. 주제와 구조를 학습해 직접 만든 새 원본만 사용하세요. (YouTube 서비스 약관 및 저작권 준수)\n` },
    { name: 'README_KO.txt', content: `\uFEFF${readme}` },
  ];
}

export function createCapCutPackage(draft: ProductionDraft): { blob: Blob; filename: string; files: ZipTextFile[] } {
  const files = buildCapCutFiles(draft);
  return {
    blob: createZip(files, new Date(draft.createdAt)),
    filename: `${safeName(draft.title)}_capcut_pack.zip`,
    files,
  };
}

export function downloadCapCutPackage(draft: ProductionDraft): string {
  const pack = createCapCutPackage(draft);
  const url = URL.createObjectURL(pack.blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = pack.filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return pack.filename;
}
