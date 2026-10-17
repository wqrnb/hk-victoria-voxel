// Generate qa/jobs-matrix.json — full final-QA job list.
import fs from 'node:fs';

const P = 1280, Q = 'quality=low';
const QA = 'index.html?qa=1';
const probe = `
  function(){
    var HK=window.HK;
    function vis(id){var e=document.getElementById(id);if(!e)return 'missing';var s=getComputedStyle(e);return {d:s.display,v:s.visibility,o:s.opacity,c:e.className};}
    var s=(HK&&HK.app&&HK.app.state)||{};
    var c=HK&&HK.app&&HK.app.controls&&HK.app.controls.cine;
    var cx=HK&&HK.app&&HK.app.camera;
    return {
      err: window.__BOOT_ERROR__||null,
      data: Object.assign({}, document.documentElement.dataset),
      state:{mode:s.mode,time:s.timeHours,weather:s.weather,quality:s.quality,started:s.started,photo:!!s.photo,paused:!!s.paused,audio:!!s.audio,fps:s.fps,night:!!s.night,timeAuto:!!s.timeAuto,timeSpeed:s.timeSpeed,player:s.player||null,layerCount:s.layers?Object.keys(s.layers).filter(function(k){return s.layers[k]}).length:-1},
      parts:{post:!!(HK&&HK.app&&HK.app.post),sky:!!(HK&&HK.app&&HK.app.sky),water:!!(HK&&HK.app&&HK.app.water),life:!!(HK&&HK.app&&HK.app.life),props:!!(HK&&HK.app&&HK.app.props),controls:!!(HK&&HK.app&&HK.app.controls),ui:!!window.HK.UI,audio:!!window.HK.Audio},
      camera: cx?{x:+cx.position.x.toFixed(1),y:+cx.position.y.toFixed(1),z:+cx.position.z.toFixed(1),fov:cx.fov}:null,
      canvas:(function(){var cc=document.querySelector('#hk-stage canvas');return cc?{w:cc.width,h:cc.height,cssW:cc.clientWidth,cssH:cc.clientHeight}:null;})(),
      cine: c?{index:c.index,total:(c.shots||[]).length,active:!!c.active,t:+(c.t||0).toFixed(2)}:null,
      overlays:{pointerlock:vis('hk-pointerlock'),photo:vis('hk-photo'),help:vis('hk-help'),cinema:vis('hk-cinema'),fpshud:vis('hk-fpshud'),panel:vis('hk-panel'),intro:vis('hk-intro'),loader:vis('hk-loader')},
      text:{clock:(document.getElementById('hk-clock')||{}).textContent||null,weather:(document.getElementById('hk-weather-zh')||{}).textContent||null,quality:(document.getElementById('hk-quality-badge')||{}).textContent||null,phase:(document.getElementById('hk-phase-zh')||{}).textContent||null,district:(document.getElementById('hk-district-zh')||{}).textContent||null,alt:(document.getElementById('hk-alt')||{}).textContent||null,cineTitle:((document.getElementById('hk-cinema')||{}).textContent||'').replace(/\\s+/g,' ').trim().slice(0,180)||null},
      webgl2: !!(document.createElement('canvas').getContext('webgl2')),
      info: window.__INFO__||null
    };
  }
`;
const E = (extra) => `(function(){var o=(${probe})();try{${extra || ''}}catch(e){o.stepError=String(e&&e.stack||e);}return JSON.stringify(o);})()`;

// Shared UI transition script: from the intro, exercise the app through UI actions.
const introClick = `var btns=document.querySelectorAll('#hk-intro button');o.buttons=Array.prototype.map.call(btns,function(b){return b.textContent.trim().slice(0,40)});o.introBefore={phase:o.data.phase,cls:(document.getElementById('hk-intro')||{}).className};btns[0].click();o.step1={phase:o.data.phase,started:HK.app.state.started,mode:o.data.mode};`;

const jobs = [];
const add = (j) => jobs.push(j);

// ---------- time presets (low, default orbit) ----------
for (const [id, t] of [['dawn', 6.05], ['noon', 12.5], ['golden', 18.55], ['blue', 19.35], ['night', 21.4]]) {
  add({ id: 'm-time-' + id, url: `${QA}&${Q}&time=${t}&weather=clear`, out: `tmp/qa/m-time-${id}.png`, w: P, h: 720, timeout: 300000 });
}
// ---------- weather ----------
add({ id: 'm-weather-mist', url: `${QA}&${Q}&time=18.55&weather=mist`, out: 'tmp/qa/m-weather-mist.png', w: P, h: 720, timeout: 300000 });
add({ id: 'm-weather-rain', url: `${QA}&${Q}&time=18.55&weather=rain`, out: 'tmp/qa/m-weather-rain.png', w: P, h: 720, timeout: 300000 });
add({ id: 'm-rain-night', url: `${QA}&${Q}&time=21.0&weather=rain`, out: 'tmp/qa/m-rain-night.png', w: P, h: 720, timeout: 300000 });
// ---------- night light show ----------
add({ id: 'm-show-night', url: `${QA}&${Q}&time=21.4&weather=clear&show=1`, out: 'tmp/qa/m-show-night.png', w: P, h: 720, timeout: 300000, wait: 3500, shotDelay: 1200 });
// ---------- orbit POIs ----------
for (const poi of ['central', 'tst', 'peak', 'westk']) {
  add({ id: 'm-poi-' + poi, url: `${QA}&${Q}&time=18.55&poi=${poi}`, out: `tmp/qa/m-poi-${poi}.png`, w: P, h: 720, timeout: 300000 });
}
// ---------- explicit cameras ----------
add({ id: 'm-cam-reset', url: `${QA}&${Q}&time=18.55&cam=40,140,-120&look=-150,55,338`, out: 'tmp/qa/m-cam-reset.png', w: P, h: 720, timeout: 300000 });
add({ id: 'm-cam-shore', url: `${QA}&${Q}&time=12.5&cam=-60,40,200&look=-150,5,335`, out: 'tmp/qa/m-cam-shore.png', w: P, h: 720, timeout: 300000 });
add({ id: 'm-cam-central-close', url: `${QA}&${Q}&time=17.9&cam=-200,120,150&look=-118,70,400`, out: 'tmp/qa/m-cam-central-close.png', w: P, h: 720, timeout: 300000 });
add({ id: 'm-cam-icc-close', url: `${QA}&${Q}&time=17.9&cam=-700,120,-250&look=-962,140,-424`, out: 'tmp/qa/m-cam-icc-close.png', w: P, h: 720, timeout: 300000 });
add({ id: 'm-cam-tst-close', url: `${QA}&${Q}&time=17.9&cam=-190,25,-280&look=-160,18,-345`, out: 'tmp/qa/m-cam-tst-close.png', w: P, h: 720, timeout: 300000 });
add({ id: 'm-cam-peak-tower', url: `${QA}&${Q}&time=16.5&cam=-200,300,480&look=-282,210,688`, out: 'tmp/qa/m-cam-peak-tower.png', w: P, h: 720, timeout: 300000 });
// ---------- FPS ----------
add({ id: 'm-fps-central', url: `${QA}&${Q}&mode=fps&poi=walk-central&time=12.5&weather=clear`, out: 'tmp/qa/m-fps-central.png', w: P, h: 720, timeout: 300000 });
add({ id: 'm-fps-peak', url: `${QA}&${Q}&mode=fps&poi=walk-peak&time=12.5&weather=clear`, out: 'tmp/qa/m-fps-peak.png', w: P, h: 720, timeout: 300000 });
// ---------- cinematic shots 1..7 (shot 0 covered by triage) ----------
for (let s = 1; s <= 7; s++) {
  add({ id: 'm-cine-' + s, url: `${QA}&${Q}&mode=cinematic&shot=${s}`, out: `tmp/qa/m-cine-${s}.png`, w: P, h: 720, timeout: 300000, wait: 1200 });
}
// ---------- photo deep link ----------
add({ id: 'm-photo-deeplink', url: `${QA}&${Q}&time=18.55&photo=1`, out: 'tmp/qa/m-photo-deeplink.png', w: P, h: 720, timeout: 300000 });
// ---------- boot repeats (intermittent NaN check) ----------
add({ id: 'm-boot-rep1', url: `${QA}&${Q}&time=18.55`, out: 'tmp/qa/m-boot-rep1.png', w: P, h: 720, timeout: 300000 });
add({ id: 'm-boot-rep2', url: `${QA}&${Q}&time=18.55`, out: 'tmp/qa/m-boot-rep2.png', w: P, h: 720, timeout: 300000 });
// ---------- stale single-file build boot (re-check after rebuild) ----------
add({ id: 'm-dist-stale', url: `dist/VictoriaHarbour.html?qa=1&${Q}&time=18.55&weather=clear`, out: 'tmp/qa/m-dist-stale.png', w: P, h: 720, timeout: 300000 });
// ---------- UI (normal load, no qa) ----------
add({ id: 'u-loader-1600', url: 'index.html', out: 'tmp/qa/u-loader-1600.png', w: 1600, h: 900, timeout: 420000, shotDelay: 300, eval: E('') });
add({ id: 'u-sandbox-1600', url: 'index.html', out: 'tmp/qa/u-sandbox-1600.png', w: 1600, h: 900, timeout: 480000, ready: "document.documentElement.dataset.phase==='intro'", wait: 800, shotDelay: 2200, eval: E(introClick) });
add({ id: 'u-sandbox-1280', url: 'index.html', out: 'tmp/qa/u-sandbox-1280.png', w: P, h: 720, timeout: 480000, ready: "document.documentElement.dataset.phase==='intro'", wait: 800, shotDelay: 2200, eval: E(introClick) });
add({ id: 'u-fps-1280', url: 'index.html', out: 'tmp/qa/u-fps-1280.png', w: P, h: 720, timeout: 480000, ready: "document.documentElement.dataset.phase==='intro'", wait: 800, shotDelay: 2400, eval: E(introClick + `btns[1].click();o.step2={phase:o.data.phase,mode:o.data.mode,pointerlock:getComputedStyle(document.getElementById('hk-pointerlock')).display,panel:o.data.panel};`) });
add({ id: 'u-cinema-1600', url: 'index.html', out: 'tmp/qa/u-cinema-1600.png', w: 1600, h: 900, timeout: 480000, ready: "document.documentElement.dataset.phase==='intro'", wait: 800, shotDelay: 1800, eval: E(introClick + `HK.app.actions.setMode('cinematic');HK.UI.updateCinema({index:1,total:8,titleZh:'中環天際線',titleEn:'CENTRAL SKYLINE',caption:'中環天際線 · CENTRAL SKYLINE'});o.step2={mode:o.data.mode,cinema:getComputedStyle(document.getElementById('hk-cinema')).display,title:(document.getElementById('hk-cinema')||{}).textContent.replace(/\\s+/g,' ').trim().slice(0,120)};`) });
add({ id: 'u-help-1600', url: 'index.html', out: 'tmp/qa/u-help-1600.png', w: 1600, h: 900, timeout: 480000, ready: "document.documentElement.dataset.phase==='intro'", wait: 800, shotDelay: 1200, eval: E(introClick + `HK.UI.openHelp();o.step2={help:getComputedStyle(document.getElementById('hk-help')).display,overlayOpen:HK.UI.isOverlayOpen()};`) });
add({ id: 'u-photo-1600', url: 'index.html', out: 'tmp/qa/u-photo-1600.png', w: 1600, h: 900, timeout: 480000, ready: "document.documentElement.dataset.phase==='intro'", wait: 800, shotDelay: 1200, eval: E(introClick + `HK.app.actions.togglePhoto();o.step2={photo:o.data.photo,photoEl:getComputedStyle(document.getElementById('hk-photo')).display};`) });
add({
  id: 'u-flow-1280', url: 'index.html', out: 'tmp/qa/u-flow-1280.png', w: P, h: 720, timeout: 480000,
  ready: "document.documentElement.dataset.phase==='intro'", wait: 800, shotDelay: 3200,
  eval: E(introClick + `
    function snap(k,extra){o[k]=Object.assign({phase:o.data.phase,mode:o.data.mode,panel:o.data.panel,photo:o.data.photo,quality:o.data.quality,weather:o.data.weather,night:o.data.night,stateMode:HK.app.state.mode,started:HK.app.state.started,player:HK.app.state.player?{x:+HK.app.state.player.x.toFixed(1),y:+HK.app.state.player.y.toFixed(1),z:+HK.app.state.player.z.toFixed(1),district:HK.app.state.player.districtZh}:null},extra||{});}
    try{HK.app.actions.setMode('fps');}catch(e){o.errFps=String(e);} snap('t_fps',{pointerlock:getComputedStyle(document.getElementById('hk-pointerlock')).display,fpshud:getComputedStyle(document.getElementById('hk-fpshud')).display});
    try{HK.app.actions.setMode('cinematic');}catch(e){o.errCine=String(e);} snap('t_cinema',{cinema:getComputedStyle(document.getElementById('hk-cinema')).display});
    try{HK.app.actions.nextCinematic();HK.app.actions.prevCinematic();}catch(e){o.errCineNav=String(e);}
    try{HK.app.actions.setMode('orbit');}catch(e){o.errOrbit=String(e);} snap('t_orbit');
    try{HK.app.actions.setTime(21.4);}catch(e){o.errTime=String(e);} snap('t_time',{clock:(document.getElementById('hk-clock')||{}).textContent});
    try{HK.app.actions.setWeather('rain');}catch(e){o.errWeather=String(e);} snap('t_weather');
    try{HK.app.actions.setQuality('medium');}catch(e){o.errQuality=String(e);} snap('t_quality',{canvas:(function(){var c=document.querySelector('#hk-stage canvas');return c?{w:c.width,h:c.height}:null})()});
    try{HK.app.actions.setLayer('traffic',false);o.layerOff=HK.app.state.layers.traffic;HK.app.actions.setLayer('traffic',true);o.layerOn=HK.app.state.layers.traffic;}catch(e){o.errLayer=String(e);}
    try{HK.app.actions.teleport('walk-central');}catch(e){o.errTeleport=String(e);} snap('t_teleport');
    try{HK.app.actions.togglePhoto();}catch(e){o.errPhoto=String(e);} snap('t_photo',{photoEl:getComputedStyle(document.getElementById('hk-photo')).display,overlayOpen:HK.UI.isOverlayOpen()});
    try{HK.app.actions.togglePhoto();}catch(e){o.errPhoto2=String(e);}
    try{HK.UI.openHelp();}catch(e){o.errHelp=String(e);} o.helpOpen={display:getComputedStyle(document.getElementById('hk-help')).display,open:HK.UI.isOverlayOpen()};
    try{HK.UI.closeHelp();}catch(e){o.errHelp2=String(e);} o.helpClosed={display:getComputedStyle(document.getElementById('hk-help')).display,open:HK.UI.isOverlayOpen()};
    try{o.screenshotResult=HK.UI.screenshot();}catch(e){o.errShot=String(e);}
    try{HK.app.actions.setAudio(true);o.audioOn=HK.app.state.audio;HK.app.actions.setAudio(false);o.audioOff=HK.app.state.audio;}catch(e){o.errAudio=String(e);}
    try{HK.app.actions.togglePause();o.paused1=HK.app.state.paused;HK.app.actions.togglePause();o.paused2=HK.app.state.paused;}catch(e){o.errPause=String(e);}
    try{HK.UI.toast({zh:'QA 測試',en:'QA TOAST'});o.toastSent=true;}catch(e){o.errToast=String(e);}
    try{HK.app.actions.setTimeAuto(true);HK.app.actions.setTimeSpeed(1.0);o.timeAutoOn=HK.app.state.timeAuto;o.timeBefore=HK.app.state.timeHours;}catch(e){o.errAuto=String(e);}
    try{HK.app.actions.resetCamera();}catch(e){o.errReset=String(e);}
  `)
});

fs.writeFileSync('qa/jobs-matrix.json', JSON.stringify(jobs, null, 2));
console.log('wrote qa/jobs-matrix.json  jobs:', jobs.length);
