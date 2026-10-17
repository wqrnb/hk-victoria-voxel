// Runtime robustness probe (own CDP driver): resize, runtime quality switch,
// pause/unpause, fast auto time cycle. Normal (no ?qa=1) load so HUD is visible.
// Usage: node qa/probe-runtime.mjs [--url index.html] [--port 9670] [--w 1280 --h 720]
// Writes tmp/qa/rt-*.png + tmp/qa/rt-summary.json + tmp/qa/logs/rt-runtime.log
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 ? argv[i + 1] : d; };
const url = arg('url', 'index.html');
const port = +arg('port', 9670);
const W = +arg('w', 1280), H = +arg('h', 720);
const CHROME = fs.existsSync('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe')
  ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
  : 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'hkrt-'));
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const chrome = spawn(CHROME, [
  '--headless=new', '--no-sandbox', '--disable-dev-shm-usage', '--hide-scrollbars',
  '--mute-audio', '--enable-unsafe-swiftshader', '--use-angle=swiftshader',
  '--disable-gpu-sandbox', '--ignore-gpu-blocklist',
  `--window-size=${W},${H}`, '--force-device-scale-factor=1',
  `--user-data-dir=${profile}`, `--remote-debugging-port=${port}`,
  '--allow-file-access-from-files', '--disable-web-security', 'about:blank',
], { stdio: 'ignore' });

let ws, msgId = 0, sessionId = null;
const pending = new Map();
const consoleLines = [];
const summary = { url, w: W, h: H, steps: [], console: consoleLines };

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
    try { version = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json(); break; }
    catch { await sleep(250); }
  }
  if (!version) throw new Error('CDP not reachable');
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
      consoleLines.push('[exception] ' + (d.exception?.description || d.text));
    } else if (msg.method === 'Log.entryAdded') {
      consoleLines.push(`[log:${msg.params.entry.level}] ${msg.params.entry.text}`);
    }
  };
}
async function evalJS(expression) {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error('eval exception: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text));
  return r.result?.value;
}
async function shot(name) {
  const s = await send('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: false });
  fs.mkdirSync('tmp/qa', { recursive: true });
  fs.writeFileSync(path.resolve('tmp/qa', name), Buffer.from(s.data, 'base64'));
  return name;
}
const METRICS = `JSON.stringify({
  inner:[window.innerWidth,window.innerHeight], dpr:window.devicePixelRatio,
  canvas:(function(){var c=document.querySelector('#hk-stage canvas');return c?{w:c.width,h:c.height,cssW:c.clientWidth,cssH:c.clientHeight}:null;})(),
  camera:(function(){var c=HK.app.camera;return {aspect:+c.aspect.toFixed(3),fov:c.fov,x:+c.position.x.toFixed(1),y:+c.position.y.toFixed(1),z:+c.position.z.toFixed(1)};})(),
  renderer:{pr:+HK.app.renderer.getPixelRatio().toFixed(3),size:(function(){var v=new THREE.Vector2();HK.app.renderer.getSize(v);return {w:v.x,h:v.y};})(),shadows:HK.app.renderer.shadowMap.enabled},
  post:{size:(function(){try{var p=HK.app.post;var u=p.uniforms&&p.uniforms.uResolution;if(u&&u.value)return {w:u.value.x,h:u.value.y};}catch(e){}return null;})()},
  calls:HK.app._drawCalls, tris:HK.app._triangles,
  mode:HK.app.state.mode, quality:HK.app.state.quality, photo:!!HK.app.state.photo, paused:!!HK.app.state.paused,
  data:{mode:document.documentElement.dataset.mode,quality:document.documentElement.dataset.quality},
  phase:document.documentElement.dataset.phase,
  panel:document.documentElement.dataset.panel, pointerlock:document.documentElement.dataset.pointerlock,
  clock:(document.getElementById('hk-clock')||{}).textContent,
  time:+HK.app.state.timeHours.toFixed(3), timeAuto:!!HK.app.state.timeAuto, timeSpeed:HK.app.state.timeSpeed
})`;

async function step(name, fn) {
  const t0 = Date.now();
  let value, error = null;
  try { value = await fn(); } catch (e) { error = String(e && e.message || e); }
  const rec = { name, sec: +((Date.now() - t0) / 1000).toFixed(1), value, error };
  summary.steps.push(rec);
  console.log(`STEP ${name} ${rec.sec}s${error ? ' ERROR ' + error : ''} ${JSON.stringify(value).slice(0, 500)}`);
  return rec;
}

const main = async () => {
  await connect();
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' }, false);
  const attach = await send('Target.attachToTarget', { targetId, flatten: true }, false);
  sessionId = attach.sessionId;
  await send('Page.enable'); await send('Runtime.enable'); await send('Log.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false });
  const full = url.startsWith('file:') || url.startsWith('http') ? url : 'file:///' + path.resolve(url).replace(/\\/g, '/');
  await send('Page.navigate', { url: full });
  // wait intro phase
  const t0 = Date.now();
  let ok = false;
  while (Date.now() - t0 < 420000) {
    try { if (await evalJS("document.documentElement.dataset.phase==='intro'")) { ok = true; break; } } catch { }
    await sleep(300);
  }
  console.log('intro reached:', ok);
  await sleep(600);
  await evalJS("document.querySelectorAll('#hk-intro button')[0].click(); 1");
  await sleep(1200);
  await step('baseline', async () => { await sleep(400); await shot('rt-0-baseline-1280.png'); return evalJS(METRICS); });

  await step('quality-high', async () => { await evalJS("HK.app.actions.setQuality('high')"); await sleep(1400); await shot('rt-1-quality-high.png'); return evalJS(METRICS); });
  await step('quality-medium', async () => { await evalJS("HK.app.actions.setQuality('medium')"); await sleep(1400); await shot('rt-2-quality-medium.png'); return evalJS(METRICS); });
  await step('quality-low', async () => { await evalJS("HK.app.actions.setQuality('low')"); await sleep(1400); await shot('rt-3-quality-low.png'); return evalJS(METRICS); });

  await step('resize-1600x900', async () => {
    await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 900, deviceScaleFactor: 1, mobile: false });
    await sleep(1800); await shot('rt-4-resize-1600x900.png'); return evalJS(METRICS);
  });
  await step('resize-1024x768', async () => {
    await send('Emulation.setDeviceMetricsOverride', { width: 1024, height: 768, deviceScaleFactor: 1, mobile: false });
    await sleep(1500); await shot('rt-5-resize-1024x768.png'); return evalJS(METRICS);
  });
  await step('resize-back-1280x720', async () => {
    await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false });
    await sleep(1500); await shot('rt-6-resize-back-1280.png'); return evalJS(METRICS);
  });

  await step('pause', async () => { await evalJS("HK.app.actions.togglePause()"); await sleep(400); return evalJS(METRICS); });
  await step('unpause', async () => { await evalJS("HK.app.actions.togglePause()"); await sleep(400); return evalJS(METRICS); });
  await step('timeauto-fast', async () => {
    await evalJS("HK.app.actions.setTimeAuto(true);HK.app.actions.setTimeSpeed(1.0);1");
    const a = await evalJS('+HK.app.state.timeHours.toFixed(3)');
    await sleep(2800);
    const b = await evalJS('+HK.app.state.timeHours.toFixed(3)');
    await evalJS("HK.app.actions.setTimeAuto(false);1");
    return { timeStart: a, timeEnd: b, deltaHours: +(((b - a + 24) % 24)).toFixed(3) };
  });
  await step('modes-switch', async () => {
    const out = {};
    await evalJS("HK.app.actions.setMode('fps')"); await sleep(600);
    out.fps = await evalJS(METRICS);
    await evalJS("HK.app.actions.setMode('cinematic')"); await sleep(900);
    out.cinematic = await evalJS(METRICS);
    await evalJS("HK.app.actions.setMode('orbit')"); await sleep(600);
    out.orbit = await evalJS(METRICS);
    return out;
  });
  await step('final-shot', async () => { await sleep(500); return await shot('rt-7-final.png'); });
  summary.done = true;
  fs.mkdirSync('tmp/qa/logs', { recursive: true });
  fs.writeFileSync('tmp/qa/rt-summary.json', JSON.stringify(summary, null, 2));
  fs.writeFileSync('tmp/qa/logs/rt-runtime.log', consoleLines.join('\n'));
  const errs = consoleLines.filter(l => /^\[(error|exception)|^\[log:error/.test(l));
  console.log('CONSOLE ERRORS:', errs.length);
  errs.forEach(e => console.log(' ! ' + e));
  await send('Browser.close', {}, false).catch(() => {});
  setTimeout(() => process.exit(errs.length ? 2 : 0), 400);
};
main().catch(async (e) => {
  console.error('PROBE FAILED:', e.stack || e.message);
  console.log(consoleLines.join('\n'));
  fs.writeFileSync('tmp/qa/logs/rt-runtime.log', consoleLines.join('\n'));
  try { chrome.kill(); } catch { }
  process.exit(1);
});
