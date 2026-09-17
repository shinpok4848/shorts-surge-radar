import { mkdir, rm } from 'node:fs/promises';
import { basename, extname, resolve } from 'node:path';

const root = resolve(import.meta.dir, '..');
const outputDirectory = resolve(root, 'docs');
const assetsDirectory = resolve(outputDirectory, 'assets');

await rm(outputDirectory, { recursive: true, force: true });
await mkdir(assetsDirectory, { recursive: true });

const result = await Bun.build({
  entrypoints: [resolve(root, 'src/main.ts')],
  outdir: assetsDirectory,
  target: 'browser',
  format: 'esm',
  minify: true,
  sourcemap: 'external',
  naming: '[name]-[hash].[ext]',
});

if (!result.success) {
  for (const log of result.logs) console.error(log);
  process.exit(1);
}

const jsOutput = result.outputs.find((output) => extname(output.path) === '.js');
const cssOutput = result.outputs.find((output) => extname(output.path) === '.css');
if (!jsOutput || !cssOutput) throw new Error('Expected JavaScript and CSS build outputs.');

const html = `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="description" content="YouTube Shorts 조회수 급상승을 5분 단위로 추적하는 크리에이터용 레이더" />
    <meta name="theme-color" content="#090a0a" />
    <link rel="icon" href="./favicon.svg" type="image/svg+xml" />
    <link rel="stylesheet" href="./assets/${basename(cssOutput.path)}" />
    <title>SHORTS PULSE — 쇼츠 급상승 레이더</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="./assets/${basename(jsOutput.path)}"></script>
  </body>
</html>
`;

await Bun.write(resolve(outputDirectory, 'index.html'), html);
await Bun.write(resolve(outputDirectory, 'favicon.svg'), Bun.file(resolve(root, 'public/favicon.svg')));
await Bun.write(resolve(outputDirectory, '.nojekyll'), '');

console.log(`Built ${result.outputs.length} assets into docs/`);
