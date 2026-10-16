import assert from 'node:assert/strict';
import { readdir, readFile, access, lstat } from 'node:fs/promises';
import { join, dirname, resolve, relative } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const root = resolve('.');
const excluded = new Set(['.git', 'node_modules', 'work', '__pycache__', 'dist', '.openai']);
const secrets = ['MCD_MCP_TOKEN', 'DEEPSEEK_API_KEY', 'ARENA_TICKET_KEY'].map(name => process.env[name]).filter(Boolean);
const paths = [];
async function scan(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (excluded.has(entry.name) || (entry.name.startsWith('.env') && entry.name !== '.env.example')) continue;
    const path = join(directory, entry.name);
    assert.equal(entry.isSymbolicLink(), false, 'Release must contain real files, not symbolic links');
    if (entry.isDirectory()) await scan(path);
    else if (entry.isFile()) {
      const bytes = await readFile(path);
      assert.equal(secrets.some(secret => bytes.includes(Buffer.from(secret))), false, 'Sensitive value found in a release file');
      paths.push(path);
    }
  }
}
for (const name of ['README.md', 'CONTEST_DECLARATION.md', 'MCP_INTEGRATION.md', 'mcp-config.example.json', '.env.example', '.gitignore', 'server.mjs', 'package.json', 'pnpm-lock.yaml', 'skills/mcd-bite-battle/SKILL.md']) await access(name);
await scan(root);
const declaration = await readFile('CONTEST_DECLARATION.md');
assert.equal(createHash('sha256').update(declaration).digest('hex'), 'cd28101bcb29cc8fb24b372fe91ce6b42c4a1487a54e01f7ade0c8c6a84241b7', 'Official declaration differs from the version verified on 2026-10-16');
const config = JSON.parse(await readFile('mcp-config.example.json', 'utf8'));
assert.equal(config.mcpServers['mcd-mcp'].url, 'https://mcp.mcd.cn');
assert.equal(config.mcpServers['mcd-mcp'].headers.Authorization, 'Bearer ${MCD_MCP_TOKEN}');
const launcher = await readFile('启动试玩.cmd', 'utf8');
assert.equal(/(?<!\r)\n/.test(launcher), false, 'Windows launcher must use CRLF line endings');

let links = 0, imports = 0;
for (const path of paths) {
  if (!/\.(?:md|mjs|html)$/.test(path)) continue;
  let content = await readFile(path, 'utf8');
  let refs = [];
  if (path.endsWith('.md')) {
    content = content.replace(/```[\s\S]*?```/g, '');
    refs = [...content.matchAll(/!?\[[^\]\n]*\]\(([^)\n]+)\)/g)].map(match => match[1].replace(/^<|>$/g, '').split(' "')[0]);
  } else if (path.endsWith('.mjs')) {
    refs = [...content.matchAll(/(?:from\s*|import\s*\()(['"])(\.\.?\/[^'"]+)\1/g)].map(match => match[2]);
    imports += refs.length;
  } else {
    refs = [...content.matchAll(/(?:src|href)=["']([^"']+)["']/g)].map(match => match[1]);
  }
  for (const ref of refs) {
    if (/^(?:[a-z][a-z\d+.-]*:|#|\/\/)/i.test(ref)) continue;
    const target = resolve(dirname(path), decodeURIComponent(ref.split(/[?#]/)[0]));
    assert.ok(target.startsWith(root + '/') || target.startsWith(root + '\\'), 'Local reference escapes project root: ' + relative(root, path));
    await access(target).catch(() => { throw new Error('Missing local reference in ' + relative(root, path) + ': ' + ref); });
    links++;
  }
}
let history = 'not present (folder release)';
try {
  await lstat('.git');
  const result = spawnSync('git', ['log', '--all', '-p', '--no-ext-diff'], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  if (result.status === 0) {
    assert.equal(secrets.some(secret => result.stdout.includes(secret)), false, 'Sensitive value found in Git history');
    history = 'checked';
  } else if (/does not have any commits|unknown revision|bad default revision/i.test(result.stderr || '')) history = 'empty repository';
  else throw new Error('Cannot check this repository history');
} catch (error) { if (error.code !== 'ENOENT') throw error; }
console.log(JSON.stringify({ files: paths.length, localReferences: links, moduleImports: imports, requiredFiles: 'passed', declaration: 'official bytes unchanged', configuredSensitiveValuesAbsent: secrets.length, gitHistory: history }, null, 2));
