import { spawnSync } from 'node:child_process';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
const roots = ['web', 'worker', 'lib', 'scripts', 'tests'];
const entry = spawnSync(process.execPath, ['--check', 'server.mjs'], { encoding: 'utf8' });
if (entry.status !== 0) { process.stderr.write(entry.stderr); process.exit(1); }
for (const root of roots) for (const file of await readdir(root)) {
  if (!file.endsWith('.mjs')) continue;
  const result = spawnSync(process.execPath, ['--check', join(root, file)], { encoding: 'utf8' });
  if (result.status !== 0) { process.stderr.write(result.stderr); process.exit(1); }
}
const html = await readFile('web/index.html', 'utf8');
for (const file of ['styles.css', 'app.mjs', 'data.mjs', 'engine.mjs']) await readFile(`web/${file}`);
if (!html.includes('演示训练场')) throw new Error('缺少数据来源标记');
console.log('JavaScript syntax and entry assets verified.');
