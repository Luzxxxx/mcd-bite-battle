import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { McpClient, READ_ONLY_TOOLS, redact } from '../lib/mcp-client.mjs';

try {
  const client = new McpClient();
  const tools = await client.listTools();
  const directory = resolve('work/live');
  await mkdir(directory, { recursive: true });
  await writeFile(resolve(directory, 'tools-schema.json'), JSON.stringify(tools, null, 2));
  const args = process.argv.slice(2), callAt = args.indexOf('--call');
  if (callAt >= 0) {
    const name = args[callAt + 1], fileAt = args.indexOf('--args-file'), outputAt = args.indexOf('--output');
    if (!READ_ONLY_TOOLS.has(name)) throw new Error('未允许的工具');
    if (fileAt < 0 || !args[fileAt + 1]) throw new Error('请使用 --args-file 指定工具参数 JSON 文件');
    const parameters = JSON.parse(await readFile(resolve(args[fileAt + 1]), 'utf8'));
    const result = await client.call(name, parameters);
    const output = outputAt >= 0 ? resolve(args[outputAt + 1]) : resolve(directory, `${name}.json`);
    if (!output.startsWith(`${directory}\\`) && !output.startsWith(`${directory}/`)) throw new Error('原始响应只能保存到已忽略的 work/live 目录');
    await writeFile(output, redact(JSON.stringify(result, null, 2)));
    console.log(JSON.stringify({ connected: true, tool: name, resultFile: output, contentTypes: result.content?.map(c => c.type), structuredKeys: result.structuredContent ? Object.keys(result.structuredContent) : [] }));
  } else {
    const selected = tools.filter(tool => READ_ONLY_TOOLS.has(tool.name));
    console.log(JSON.stringify({ connected: true, toolCount: tools.length, schemaFile: resolve(directory, 'tools-schema.json'), selected: selected.map(t => ({ name: t.name, required: t.inputSchema?.required ?? [], inputFields: Object.keys(t.inputSchema?.properties ?? {}) })) }, null, 2));
  }
} catch (error) {
  console.error(redact(error.message)); process.exitCode = 1;
}
