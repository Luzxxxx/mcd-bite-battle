import { spawn } from 'node:child_process';
import { createServer } from 'node:net';

const port = Number(process.env.PORT || 4318);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  console.error('PORT 必须是 1–65535 的整数，请检查本机 .env。');
  process.exit(1);
}
const origin = 'http://127.0.0.1:' + port;
async function gameIsRunning() {
  try {
    const response = await fetch(origin + '/api/status', { signal: AbortSignal.timeout(800) });
    if (!response.ok) return false;
    const value = await response.json();
    if (value.liveEnabled !== true || value.byokEnabled !== true || typeof value.tokenConfigured !== 'boolean') return false;
    const page = await fetch(origin, { signal: AbortSignal.timeout(800) });
    return page.ok && (await page.text()).includes('<title>麦麦点餐擂台');
  } catch { return false; }
}
function openGame() {
  console.log('\n试玩地址：' + origin);
  console.log('游戏运行时请保留此窗口。停止服务按 Ctrl+C。');
  if (process.argv.includes('--no-open')) return;
  const command = process.platform === 'win32' ? (process.env.ComSpec || 'cmd.exe') : process.platform === 'darwin' ? 'open' : 'xdg-open';
  const args = process.platform === 'win32' ? ['/d', '/c', 'start', '""', origin] : [origin];
  const child = spawn(command, args, { stdio: 'ignore', windowsHide: true });
  child.on('error', () => console.log('请在浏览器手动打开上面的试玩地址。'));
  child.unref();
}
try {
  if (await gameIsRunning()) {
    console.log('试玩已在运行。');
    openGame();
  } else {
    await new Promise((resolve, reject) => {
      const probe = createServer();
      probe.once('error', error => reject(new Error(error.code === 'EADDRINUSE' ? '端口 ' + port + ' 正被其他程序使用，请在 .env 修改 PORT 后重试。' : error.message)));
      probe.listen(port, '127.0.0.1', () => probe.close(resolve));
    });
    await import('../server.mjs');
    let ready = false;
    for (let attempt = 0; attempt < 40; attempt++) {
      if (await gameIsRunning()) { ready = true; break; }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    if (!ready) throw new Error('服务尚未就绪，请查看上面的启动提示。');
    openGame();
  }
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
