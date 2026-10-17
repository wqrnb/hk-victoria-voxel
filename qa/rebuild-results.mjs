// Rebuild tmp/qa/results-final.json from per-job logs (batch races overwrite results.json).
import fs from 'node:fs';
import path from 'node:path';

const dir = 'tmp/qa/logs';
const runs = [];
for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.log'))) {
  const id = path.basename(f, '.log');
  const text = fs.readFileSync(path.join(dir, f), 'utf8');
  const evalM = text.match(/EVAL RESULT: ([\s\S]*?)\nSCREENSHOT:/);
  let ev = null;
  if (evalM) { try { ev = JSON.parse(evalM[1].trim()); } catch { ev = evalM[1].trim(); } }
  const shotM = text.match(/SCREENSHOT: (.+?) (\d+x\d+) bytes=(\d+)/);
  const consoleLines = [];
  for (const line of text.split('\n')) {
    if (/^\[(log|warn|error|exception|log:)/.test(line.trim())) consoleLines.push(line.trim());
    if (/^PAGE ERROR:/.test(line)) consoleLines.push('PAGE_ERROR ' + line.slice(11).trim());
    if (/^\[warn\] ready expression/.test(line)) consoleLines.push(line);
    if (/EVAL FAILED:/.test(line)) consoleLines.push('EVAL_FAILED ' + line.slice(13));
    if (/QA FAILED:/.test(line)) consoleLines.push('QA_FAILED ' + line.trim());
  }
  const errs = consoleLines.filter(l => /^\[error|^\[exception|PAGE_ERROR|EVAL_FAILED|QA_?FAILED/.test(l));
  runs.push({
    id, file: f,
    screenshot: shotM ? { path: shotM[1], size: shotM[2], bytes: +shotM[3] } : null,
    evalResult: ev,
    consoleErrors: errs,
    consoleWarns: consoleLines.filter(l => /^\[warn|^\[log:warning/.test(l)),
    consoleAll: consoleLines,
  });
}
runs.sort((a, b) => a.id.localeCompare(b.id));
fs.writeFileSync('tmp/qa/results-final.json', JSON.stringify({ runs, updated: new Date().toISOString() }, null, 2));
console.log('rebuilt', runs.length, 'runs -> tmp/qa/results-final.json');
