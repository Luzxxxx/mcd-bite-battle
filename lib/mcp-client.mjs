const ENDPOINT = 'https://mcp.mcd.cn';
export const READ_ONLY_TOOLS = new Set(['query-nearby-stores', 'query-meals', 'query-meal-detail', 'calculate-price', 'query-store-coupons', 'now-time-info', 'list-nutrition-foods']);

export function redact(value) {
  let text = String(value);
  for (const token of [process.env.MCD_MCP_TOKEN, process.env.DEEPSEEK_API_KEY]) if (token) text = text.split(token).join('[REDACTED]');
  return text.replace(/Bearer\s+[^\s"<>]+/gi, 'Bearer [REDACTED]');
}
export function parseMcpResponse(body) {
  const trimmed = body.trim();
  if (!trimmed) return null;
  try { return JSON.parse(trimmed); } catch {}
  const messages = [];
  for (const event of body.replace(/\r\n/g, '\n').split('\n\n')) {
    const data = event.split('\n').filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n');
    if (!data || data === '[DONE]') continue;
    try { messages.push(JSON.parse(data)); } catch {}
  }
  return messages.reverse().find(message => message.id !== undefined || message.error || message.result) ?? null;
}
export class McpClient {
  #token; #session; #protocol = '2024-11-05'; #id = 0; #ready = false;
  constructor(token = process.env.MCD_MCP_TOKEN) {
    if (!token?.trim()) throw new Error('未配置 MCD_MCP_TOKEN，请在本机 .env 中填写');
    this.#token = token.trim();
  }
  async #request(method, params, notification = false) {
    const headers = { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', Authorization: `Bearer ${this.#token}` };
    if (this.#session) headers['Mcp-Session-Id'] = this.#session;
    if (this.#ready) headers['MCP-Protocol-Version'] = this.#protocol;
    const payload = { jsonrpc: '2.0', method, ...(params !== undefined ? { params } : {}), ...(!notification ? { id: ++this.#id } : {}) };
    const response = await fetch(ENDPOINT, { method: 'POST', headers, body: JSON.stringify(payload), signal: AbortSignal.timeout(25000) });
    if (!response.ok) throw new Error(`麦当劳 MCP HTTP ${response.status}${response.status === 401 ? '：Token 无效、过期或未被接受，请重新检查本机配置' : ''}`);
    const session = response.headers.get('mcp-session-id');
    if (session) this.#session = session;
    const message = parseMcpResponse(await response.text());
    if (notification) return null;
    if (!message) throw new Error('MCP 返回格式无法识别');
    if (message.error) throw new Error(redact(`MCP ${message.error.code}: ${message.error.message}`));
    if (!Object.hasOwn(message, 'result')) throw new Error('MCP 响应缺少 result');
    return message.result;
  }
  async initialize() {
    if (this.#ready) return;
    const result = await this.#request('initialize', { protocolVersion: this.#protocol, capabilities: {}, clientInfo: { name: 'mcd-bite-battle', version: '0.1.0' } });
    this.#protocol = result.protocolVersion ?? this.#protocol;
    this.#ready = true;
    await this.#request('notifications/initialized', undefined, true);
  }
  async listTools() {
    await this.initialize();
    const all = []; let cursor;
    do {
      const page = await this.#request('tools/list', cursor ? { cursor } : {});
      all.push(...(page.tools ?? [])); cursor = page.nextCursor;
      if (all.length > 300) throw new Error('工具列表分页数量异常');
    } while (cursor);
    return all;
  }
  async call(name, args) {
    if (!READ_ONLY_TOOLS.has(name)) throw new Error('此客户端仅允许项目所需的只读查询与计价工具');
    if (!args || typeof args !== 'object' || Array.isArray(args)) throw new Error('工具参数须为对象');
    await this.initialize();
    const result = await this.#request('tools/call', { name, arguments: args });
    if (result.isError) throw new Error(redact('工具返回执行失败；请检查参数和工具 schema'));
    return result;
  }
}
