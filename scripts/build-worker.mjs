import { build } from 'esbuild';
import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises';
const types = { html: 'text/html; charset=utf-8', css: 'text/css; charset=utf-8', mjs: 'text/javascript; charset=utf-8' };
const assets = {};
for (const file of await readdir('web')) {
  const type = types[file.split('.').at(-1)];
  if (type) assets['/' + file] = { type, content: await readFile('web/' + file, 'utf8') };
}
await build({ entryPoints: ['worker/index.mjs'], outfile: 'dist/server/index.js', bundle: true, format: 'esm', platform: 'browser', target: 'es2022', plugins: [{ name: 'site-assets', setup(builder) {
  builder.onResolve({ filter: /^site-assets$/ }, () => ({ path: 'site-assets', namespace: 'embedded' }));
  builder.onLoad({ filter: /.*/, namespace: 'embedded' }, () => ({ contents: `export const assets = ${JSON.stringify(assets)};`, loader: 'js' }));
} }] });
// A hosting account manifest is optional and belongs to the deployer.
try {
  const manifest = JSON.parse(await readFile('.openai/hosting.json', 'utf8'));
  delete manifest.static;
  await mkdir('dist/.openai', { recursive: true });
  await writeFile('dist/.openai/hosting.json', JSON.stringify(manifest, null, 2) + '\n');
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
console.log('Worker bundle and embedded website prepared.');
