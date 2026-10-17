// FINAL QA batch runner — sequentially drives tools/shot.mjs over a job list.
// Usage: node qa/batch.mjs <jobs.json> [--filter regex] [--portBase 9610]
// Writes tmp/qa/logs/<id>.log and tmp/qa/results.json (incremental).
// Never edits app code; QA artefacts only.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const argv = process.argv.slice(2);
const jobsFile = argv[0];
if (!jobsFile) { console.error('usage: node qa/batch.mjs <jobs.json> [--filter re] [--portBase N]'); process.exit(1); }
const filter = (() => { const i = argv.indexOf('--filter'); return i >= 0 ? new RegExp(argv[i + 1]) : null; })();
const pbi = argv.indexOf('--portBase');
const portBase = pbi >= 0 ? +argv[pbi + 1] : 9610;

const jobs = JSON.parse(fs.readFileSync(path.resolve(jobsFile), 'utf8'));

// Default probe: boot state + app/UI/controls summary, returned as JSON.
const DEFAULT_EVAL = `JSON.stringify({
  info: window.__INFO__ || null, err: window.__BOOT_ERROR__ || null,
  ready: !!window.__READY__,
  data: Object.assign({}, document.documentElement.dataset),
  state: (function(){var s=(window.HK&&HK.app&&HK.app.state)||{};return {mode:s.mode,time:s.timeHours,weather:s.weather,quality:s.quality,started:s.started,photo:!!s.photo,paused:!!s.paused,audio:!!s.audio,fps:s.fps,night:!!s.night,timeAuto:!!s.timeAuto,player:s.player||null,layerCount:s.layers?Object.keys(s.layers).filter(function(k){return s.layers[k]}).length:-1};})(),
  parts: {renderer:!!(HK.app&&HK.app.renderer),scene:!!(HK.app&&HK.app.scene),post:!!(HK.app&&HK.app.post),sky:!!(HK.app&&HK.app.sky),water:!!(HK.app&&HK.app.water),life:!!(HK.app&&HK.app.life),props:!!(HK.app&&HK.app.props),cityGroup:!!(HK.app&&HK.app.cityGroup),controls:!!(HK.app&&HK.app.controls),ui:!!window.HK.UI,audio:!!window.HK.Audio},
  camera: (function(){var c=HK.app&&HK.app.camera;return c?{x:+c.position.x.toFixed(1),y:+c.position.y.toFixed(1),z:+c.position.z.toFixed(1),fov:c.fov}:null;})(),
  canvas: (function(){var c=document.querySelector('#hk-stage canvas');return c?{w:c.width,h:c.height,cssW:c.clientWidth,cssH:c.clientHeight}:null;})(),
  cine: (function(){var c=HK.app&&HK.app.controls&&HK.app.controls.cine;return c?{index:c.index,total:(c.shots||[]).length,active:!!c.active,t:+(c.t||0).toFixed(2),fov:c.fov}:null;})(),
  overlays: (function(){var ids=['hk-pointerlock','hk-photo','hk-help','hk-cinema','hk-fpshud','hk-panel','hk-intro','hk-loader'];var o={};for(var i=0;i<ids.length;i++){var e=document.getElementById(ids[i]);if(!e){o[ids[i]]='missing';continue;}var s=getComputedStyle(e);o[ids[i]]={display:s.display,vis:s.visibility,op:s.opacity,cls:e.className};}return o;})(),
  text: {clock:(document.getElementById('hk-clock')||{}).textContent||null,weather:(document.getElementById('hk-weather-zh')||{}).textContent||null,quality:(document.getElementById('hk-quality-badge')||{}).textContent||null,phase:(document.getElementById('hk-phase-zh')||{}).textContent||null,district:(document.getElementById('hk-district-zh')||{}).textContent||null,alt:(document.getElementById('hk-alt')||{}).textContent||null,cineTitle:((document.getElementById('hk-cinema')||{}).textContent||'').replace(/\\s+/g,' ').trim().slice(0,160)||null},
  webgl2: !!(document.createElement('canvas').getContext('webgl2')),
  title: document.title
})`;
fs.mkdirSync('tmp/qa/logs', { recursive: true });
const resultsPath = path.resolve('tmp/qa/results.json');
const results = fs.existsSync(resultsPath) ? JSON.parse(fs.readFileSync(resultsPath, 'utf8')) : {};
if (!Array.isArray(results.runs)) results.runs = [];

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
let port = portBase;

function parseLog(text) {
  const evalM = text.match(/EVAL RESULT: ([\s\S]*?)\nSCREENSHOT:/);
  let ev = null;
  if (evalM) {
    const raw = evalM[1].trim();
    try { ev = JSON.parse(raw); } catch { ev = raw; }
  }
  const shotM = text.match(/SCREENSHOT: (.+?) (\d+x\d+) bytes=(\d+)/);
  const consoleLines = [];
  for (const line of text.split('\n')) {
    if (/^\[(log|warn|error|exception|log:)/.test(line.trim())) consoleLines.push(line.trim());
    if (/^PAGE ERROR:/.test(line)) consoleLines.push('PAGE_ERROR ' + line.slice(11).trim());
    if (/^\[warn\] ready expression/.test(line)) consoleLines.push(line);
    if (/EVAL FAILED:/.test(line)) consoleLines.push('EVAL_FAILED ' + line.slice(13));
    if (/QA FAILED:/.test(line)) consoleLines.push(line);
  }
  return { evalResult: ev, screenshot: shotM ? { path: shotM[1], size: shotM[2], bytes: +shotM[3] } : null, consoleLines };
}

async function runJob(job, idx) {
  const out = path.resolve(job.out);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const p = port; port = port + 1;
  const args = ['tools/shot.mjs',
    '--url', job.url, '--out', out, '--w', String(job.w || 1280), '--h', String(job.h || 720),
    '--ready', job.ready || 'window.__READY__', '--port', String(p),
    '--timeout', String(job.timeout || 300000), '--shotDelay', String(job.shotDelay || 800),
  ];
  args.push('--eval', job.eval || DEFAULT_EVAL);
  if (job.wait) args.push('--wait', String(job.wait));
  const t0 = Date.now();
  const child = spawn(process.execPath, args, { stdio: ['ignore', 'pipe', 'pipe'] });
  let stdout = '', stderr = '';
  child.stdout.on('data', d => { stdout += d; });
  child.stderr.on('data', d => { stderr += d; });
  const code = await new Promise(res => child.on('exit', c => res(c)));
  const dur = ((Date.now() - t0) / 1000).toFixed(1);
  fs.writeFileSync(path.resolve('tmp/qa/logs', job.id + '.log'), stdout + '\n=== STDERR ===\n' + stderr);
  const parsed = parseLog(stdout);
  const rec = {
    id: job.id, url: job.url, out: job.out, w: job.w || 1280, h: job.h || 720,
    exitCode: code, durationSec: +dur, when: new Date().toISOString(),
    screenshot: parsed.screenshot, evalResult: parsed.evalResult,
    consoleErrors: parsed.consoleLines.filter(l => /^\[error|^\[exception|PAGE_ERROR|EVAL_FAILED|QA FAILED/.test(l)),
    consoleWarns: parsed.consoleLines.filter(l => /^\[warn|^\[log:warn/.test(l)),
    consoleAll: parsed.consoleLines,
  };
  const i = results.runs.findIndex(r => r.id === job.id);
  if (i >= 0) results.runs[i] = rec; else results.runs.push(rec);
  results.updated = new Date().toISOString();
  fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));
  const info = parsed.evalResult && parsed.evalResult.info ? ` calls=${parsed.evalResult.info.drawCalls} tris=${parsed.evalResult.info.triangles} mode=${parsed.evalResult.info.mode}` : '';
  console.log(`[${new Date().toLocaleTimeString()}] ${code === 0 ? 'OK ' : 'EXIT' + code} ${job.id} ${dur}s${info} errs=${rec.consoleErrors.length} -> ${job.out}`);
  for (const e of rec.consoleErrors) console.log('   ! ' + e.slice(0, 200));
  await sleep(500);
}

const list = jobs.filter(j => !filter || filter.test(j.id));
console.log(`running ${list.length}/${jobs.length} jobs (port base ${portBase})`);
for (let i = 0; i < list.length; i++) {
  try { await runJob(list[i], i); } catch (e) { console.error('runner failure', list[i].id, e.message); }
}
console.log('DONE');
