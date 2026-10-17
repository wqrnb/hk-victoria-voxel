// Headless Chrome screenshot / QA driver using raw CDP (no dependencies).
// Usage: node tools/shot.mjs --url <url> --out <png> [--w 1600 --h 900] [--wait 4000]
//        [--ready "window.__READY__"] [--eval "js"] [--evalOut file] [--port 9333]
// Prints console messages and page errors. Exits non-zero on page error.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const args = {};
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (a.startsWith('--')) { args[a.slice(2)] = (process.argv[i + 1] && !process.argv[i + 1].startsWith('--')) ? process.argv[++i] : true; }
}
const W = +(args.w || 1600), H = +(args.h || 900);
const out = path.resolve(args.out || 'tmp/shot.png');
fs.mkdirSync(path.dirname(out), { recursive: true });
const port = +(args.port || 9333);
const timeoutMs = +(args.timeout || 120000);
const readyExpr = args.ready || 'true';
const waitMs = +(args.wait || 0);

const CHROME = fs.existsSync('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe')
  ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
  : 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'hkqa-'));
const chrome = spawn(CHROME, [
  '--headless=new', '--no-sandbox', '--disable-dev-shm-usage', '--hide-scrollbars',
  '--mute-audio', '--enable-unsafe-swiftshader', '--use-angle=swiftshader',
  '--disable-gpu-sandbox', '--ignore-gpu-blocklist',
  `--window-size=${W},${H}`, '--force-device-scale-factor=1',
  `--user-data-dir=${profile}`, `--remote-debugging-port=${port}`,
  '--allow-file-access-from-files', '--disable-web-security',
  'about:blank',
], { stdio: 'ignore' });

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
let ws, msgId = 0;
const pending = new Map();
const events = [];
const consoleLines = [];
let pageError = null;
let sessionId = null;

function send(method, params = {}, useSession = true) {
  const id = ++msgId;
  const payload = { id, method, params };
  if (useSession && sessionId) payload.sessionId = sessionId;
  ws.send(JSON.stringify(payload));
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject, method }));
}

async function connect() {
  const deadline = Date.now() + 30000;
  let version;
  while (Date.now() < deadline) {
    try {
      version = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json();
      break;
    } catch { await sleep(250); }
  }
  if (!version) throw new Error('Chrome CDP not reachable');
  ws = new WebSocket(version.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const p = pending.get(msg.id); pending.delete(msg.id);
      if (msg.error) p.reject(new Error(`${p.method}: ${msg.error.message}`)); else p.resolve(msg.result);
      return;
    }
    if (msg.method === 'Runtime.consoleAPICalled') {
      const text = msg.params.args.map(a => a.value !== undefined ? String(a.value) : (a.description || a.type)).join(' ');
      consoleLines.push(`[${msg.params.type}] ${text}`);
    } else if (msg.method === 'Runtime.exceptionThrown') {
      const d = msg.params.exceptionDetails;
      pageError = d.exception?.description || d.text;
      consoleLines.push('[exception] ' + pageError);
    } else if (msg.method === 'Log.entryAdded') {
      consoleLines.push(`[log:${msg.params.entry.level}] ${msg.params.entry.text}`);
    }
    events.push(msg);
  };
}

const main = async () => {
  await connect();
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' }, false);
  const attach = await send('Target.attachToTarget', { targetId, flatten: true }, false);
  sessionId = attach.sessionId;
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Log.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false });
  const url = args.url.startsWith('file:') || args.url.startsWith('http') ? args.url : 'file:///' + path.resolve(args.url).replace(/\\/g, '/');
  await send('Page.navigate', { url });

  // wait for ready expression (polling via evaluate)
  const t0 = Date.now();
  let ready = false;
  while (Date.now() - t0 < timeoutMs) {
    try {
      const r = await send('Runtime.evaluate', { expression: `(()=>{try{return !!( ${readyExpr} )}catch(e){return false}})()`, returnByValue: true });
      if (r.result && r.result.value) { ready = true; break; }
    } catch {}
    await sleep(300);
  }
  if (!ready) consoleLines.push('[warn] ready expression never became true');
  if (waitMs) await sleep(waitMs);
  if (args.eval) {
    try {
      const r = await send('Runtime.evaluate', { expression: args.eval, returnByValue: true, awaitPromise: true });
      const v = r.result?.value;
      if (args.evalOut) { fs.writeFileSync(path.resolve(args.evalOut), typeof v === 'string' ? v : JSON.stringify(v, null, 2)); }
      console.log('EVAL RESULT:', typeof v === 'string' ? v : JSON.stringify(v, null, 2));
    } catch (e) { console.log('EVAL FAILED:', e.message); }
  }
  // give compositor a couple of animation frames
  await sleep(+(args.shotDelay || 800));
  const shot = await send('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: false });
  fs.writeFileSync(out, Buffer.from(shot.data, 'base64'));
  console.log('SCREENSHOT:', out, `${W}x${H}`, 'bytes=' + fs.statSync(out).size);
  console.log(consoleLines.join('\n'));
  if (pageError) { console.log('PAGE ERROR:', pageError); process.exitCode = 2; }
  await send('Browser.close', {}, false).catch(() => {});
  setTimeout(() => process.exit(process.exitCode || 0), 500);
};

main().catch(async (e) => {
  console.error('QA FAILED:', e.stack || e.message);
  console.log(consoleLines.join('\n'));
  try { chrome.kill(); } catch {}
  process.exit(1);
});
