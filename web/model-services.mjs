export const MODEL_SERVICES = [
  { id: 'deepseek', name: 'DeepSeek', baseUrl: 'https://api.deepseek.com', model: 'deepseek-flash' },
  { id: 'qwen', name: '通义千问 / 百炼', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: '' },
  { id: 'siliconflow', name: '硅基流动', baseUrl: 'https://api.siliconflow.cn/v1', model: '' },
  { id: 'custom', name: '自定义兼容接口', baseUrl: '', model: '' }
];
export const DEFAULT_MODEL_HOSTS = ['api.deepseek.com', 'dashscope.aliyuncs.com', 'dashscope-intl.aliyuncs.com', 'dashscope-us.aliyuncs.com', 'api.siliconflow.cn', 'api.siliconflow.com'];

export function validateModelProfile(value, additionalHosts = []) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('请填写自己的模型服务与 API Key');
  const service = MODEL_SERVICES.find(s => s.id === value.service);
  if (!service) throw new Error('请选择受支持的模型服务');
  if (typeof value.model !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_./:@-]{0,159}$/.test(value.model.trim())) throw new Error('请填写服务商提供的模型 ID，不能包含空格或控制字符');
  if (typeof value.apiKey !== 'string' || value.apiKey.trim().length < 6 || value.apiKey.length > 4096 || /[\u0000-\u001f\u007f]/.test(value.apiKey)) throw new Error('请填写有效的 API Key，不能包含换行');
  const raw = typeof value.baseUrl === 'string' ? value.baseUrl.trim() : service.baseUrl;
  if (!raw || raw.length > 500) throw new Error('请填写模型服务的 Base URL');
  let url;
  try { url = new URL(raw); } catch { throw new Error('Base URL 格式无效'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || (url.port && url.port !== '443')) throw new Error('模型接口须使用标准 HTTPS 地址，不能包含账号、查询参数或片段');
  const allowed = new Set([...DEFAULT_MODEL_HOSTS, ...additionalHosts]);
  if (!allowed.has(url.hostname)) throw new Error('该接口域名尚未开放。请选择列表中的服务；其他兼容服务可由站点所有者加入域名许可列表。');
  if (service.id !== 'custom' && url.hostname !== new URL(service.baseUrl).hostname) throw new Error('接口地址与所选服务不一致，请改选自定义接口');
  const path = url.pathname.replace(/\/+$/, '');
  url.pathname = path.endsWith('/chat/completions') ? path : `${path}/chat/completions`;
  return { service: service.id, name: service.id === 'custom' ? '自带模型' : service.name, model: value.model.trim(), apiKey: value.apiKey.trim(), endpoint: url.href, disableThinking: url.hostname === 'api.deepseek.com' };
}
