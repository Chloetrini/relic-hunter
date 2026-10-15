// Bundles the game into ONE self-contained index.html at the repo root (three.js + code + css inlined).
// That single file is what gets uploaded to the start.ng bucket.
import { build } from 'esbuild';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const html = readFileSync('app.html', 'utf8');
const m = html.match(/<script type="module" src="([^"]+)"><\/script>/);
if (!m) throw new Error('app.html has no module script');
const out = await build({
  entryPoints: [resolve(m[1])],
  bundle: true, minify: true, format: 'iife', write: false, outdir: 'out', loader: { '.css': 'css' },
  define: { 'import.meta.env': JSON.stringify({ VITE_START_API_URL: process.env.VITE_START_API_URL || '' }) },
  legalComments: 'none', target: 'es2020',
});
const js = out.outputFiles.find((f) => f.path.endsWith('.js')).text.replace(/<\/script/gi, '<\\/script');
const css = out.outputFiles.find((f) => f.path.endsWith('.css'))?.text || '';
const page = html
  .replace(m[0], () => '')
  .replace('</head>', () => `<style>${css}</style></head>`)
  .replace('</body>', () => `<script>${js}</script></body>`);
writeFileSync('index.html', page);
console.log('index.html', (page.length / 1024).toFixed(0) + ' KB');
