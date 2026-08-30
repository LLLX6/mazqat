import { cp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDirectory, '..');
const publicRoot = join(projectRoot, 'public');
const outputRoot = join(projectRoot, 'static-dist');

if (!outputRoot.startsWith(`${projectRoot}${sep}`) || outputRoot === projectRoot) {
  throw new Error('Refusing to clean an output path outside the project.');
}

const assets = [
  'app.css',
  'app.js',
  'auction-engine.js',
  'demo.html',
  'favicon.svg',
  'icon-192.png',
  'icon-512.png',
  'manifest.webmanifest',
  'og.png',
  'sw.js',
];

await rm(outputRoot, { recursive: true, force: true });
await mkdir(outputRoot, { recursive: true });

for (const asset of assets) {
  const source = join(publicRoot, asset);
  await stat(source);
  await cp(source, join(outputRoot, asset));
}

const document = await readFile(join(publicRoot, 'demo.html'), 'utf8');
await writeFile(join(outputRoot, 'index.html'), document, 'utf8');
await writeFile(
  join(outputRoot, '404.html'),
  document.replace('<title>', '<title>مزاد مسقط — '),
  'utf8',
);

console.log(`Static preview built at ${outputRoot}`);
