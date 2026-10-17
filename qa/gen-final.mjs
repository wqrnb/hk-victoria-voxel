// Generate final QA job lists: qa/jobs-final-dist.json (dist QA modes) and
// qa/jobs-final-ui.json (dist normal-load UI). Run after freeze + rebuild.
import fs from 'node:fs';

const DIST = 'dist/VictoriaHarbour.html';
const probe = `
  function(){
    var HK=window.HK;
    function vis(id){var e=document.getElementById(id);if(!e)return 'missing';var s=getComputedStyle(e);return {d:s.display,v:s.visibility,o:s.opacity,c:e.className};}
    var s=(HK&&HK.app&&HK.app.state)||{};
    var c=HK&&HK.app&&HK.app.controls&&HK.app.controls.cine;
    var cx=HK&&HK.app&&HK.app.camera;
    return {
      err: window.__BOOT_ERROR__||null, nan: window.__NAN_STACK__||null,
      protocol: location.protocol,
      resources:(function(){try{return performance.getEntriesByType('resource').map(function(e){return e.name}).slice(0,8);}catch(e){return null;}})(),
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

const jobs = [];
const add = (j) => jobs.push(j);
const qa = (params) => `${DIST}?qa=1&${params}`;
const LOW = 'quality=low';

// ============ dist QA-mode matrix ============
add({ id: 'f-hero-low-1600', url: qa(`${LOW}&time=18.55&weather=clear`), out: 'tmp/qa/f-hero-low-1600.png', w: 1600, h: 900, timeout: 420000 });
add({ id: 'f-hero-med-1600', url: qa(`quality=medium&time=18.55&weather=clear`), out: 'tmp/qa/f-hero-med-1600.png', w: 1600, h: 900, timeout: 600000 });
add({ id: 'f-hero-high-1600', url: qa(`quality=high&time=18.55&weather=clear`), out: 'tmp/qa/f-hero-high-1600.png', w: 1600, h: 900, timeout: 900000 });
add({ id: 'f-time-dawn', url: qa(`${LOW}&time=6.05&weather=clear`), out: 'tmp/qa/f-time-dawn.png', w: 1280, h: 720, timeout: 420000 });
add({ id: 'f-time-noon', url: qa(`${LOW}&time=12.5&weather=clear`), out: 'tmp/qa/f-time-noon.png', w: 1280, h: 720, timeout: 420000 });
add({ id: 'f-time-blue', url: qa(`${LOW}&time=19.35&weather=clear`), out: 'tmp/qa/f-time-blue.png', w: 1280, h: 720, timeout: 420000 });
add({ id: 'f-time-night', url: qa(`${LOW}&time=21.4&weather=clear`), out: 'tmp/qa/f-time-night.png', w: 1280, h: 720, timeout: 420000 });
add({ id: 'f-weather-mist', url: qa(`${LOW}&time=18.55&weather=mist`), out: 'tmp/qa/f-weather-mist.png', w: 1280, h: 720, timeout: 420000 });
add({ id: 'f-weather-rain', url: qa(`${LOW}&time=18.55&weather=rain`), out: 'tmp/qa/f-weather-rain.png', w: 1280, h: 720, timeout: 420000 });
add({ id: 'f-rain-night', url: qa(`${LOW}&time=21.0&weather=rain`), out: 'tmp/qa/f-rain-night.png', w: 1280, h: 720, timeout: 420000 });
add({ id: 'f-show-night', url: qa(`${LOW}&time=21.4&weather=clear&show=1`), out: 'tmp/qa/f-show-night.png', w: 1280, h: 720, timeout: 420000, wait: 3500, shotDelay: 1200 });
add({ id: 'f-poi-central', url: qa(`${LOW}&time=18.55&poi=central`), out: 'tmp/qa/f-poi-central.png', w: 1280, h: 720, timeout: 420000 });
add({ id: 'f-poi-tst', url: qa(`${LOW}&time=18.55&poi=tst`), out: 'tmp/qa/f-poi-tst.png', w: 1280, h: 720, timeout: 420000 });
add({ id: 'f-poi-peak', url: qa(`${LOW}&time=18.55&poi=peak`), out: 'tmp/qa/f-poi-peak.png', w: 1280, h: 720, timeout: 420000 });
add({ id: 'f-cam-shore', url: qa(`${LOW}&time=12.5&cam=-60,40,200&look=-150,5,335`), out: 'tmp/qa/f-cam-shore.png', w: 1280, h: 720, timeout: 420000 });
add({ id: 'f-cam-central-close', url: qa(`${LOW}&time=17.9&cam=-200,120,150&look=-118,70,400`), out: 'tmp/qa/f-cam-central-close.png', w: 1280, h: 720, timeout: 420000 });
add({ id: 'f-cam-icc-close', url: qa(`${LOW}&time=17.9&cam=-700,120,-250&look=-962,140,-424`), out: 'tmp/qa/f-cam-icc-close.png', w: 1280, h: 720, timeout: 420000 });
add({ id: 'f-cam-tst-close', url: qa(`${LOW}&time=17.9&cam=-190,25,-280&look=-160,18,-345`), out: 'tmp/qa/f-cam-tst-close.png', w: 1280, h: 720, timeout: 420000 });
add({ id: 'f-fps-avenue', url: qa(`${LOW}&mode=fps&poi=walk-avenue&time=18.55&weather=clear`), out: 'tmp/qa/f-fps-avenue.png', w: 1280, h: 720, timeout: 480000 });
add({ id: 'f-fps-central', url: qa(`${LOW}&mode=fps&poi=walk-central&time=12.5&weather=clear`), out: 'tmp/qa/f-fps-central.png', w: 1280, h: 720, timeout: 480000 });
add({ id: 'f-fps-peak', url: qa(`${LOW}&mode=fps&poi=walk-peak&time=12.5&weather=clear`), out: 'tmp/qa/f-fps-peak.png', w: 1280, h: 720, timeout: 480000 });
add({ id: 'f-cine-0', url: qa(`${LOW}&mode=cinematic&shot=0`), out: 'tmp/qa/f-cine-0.png', w: 1280, h: 720, timeout: 420000, wait: 1500 });
for (let s = 1; s <= 7; s++) add({ id: 'f-cine-' + s, url: qa(`${LOW}&mode=cinematic&shot=${s}`), out: `tmp/qa/f-cine-${s}.png`, w: 1280, h: 720, timeout: 420000, wait: 1200 });
add({ id: 'f-photo-deeplink', url: qa(`${LOW}&time=18.55&photo=1`), out: 'tmp/qa/f-photo-deeplink.png', w: 1280, h: 720, timeout: 420000 });
const NAN_EVAL = E('o.evalNow=Date.now();');
for (const rep of [1, 2, 3]) add({ id: 'f-nan-rep' + rep, url: qa(`${LOW}&time=18.55&weather=clear`), out: `tmp/qa/f-nan-rep${rep}.png`, w: 1280, h: 720, timeout: 420000, eval: NAN_EVAL });
add({ id: 'f-offline-check', url: qa(`${LOW}&time=18.55&weather=clear`), out: 'tmp/qa/f-offline-check.png', w: 1280, h: 720, timeout: 420000, eval: E("o.offline={protocol:location.protocol,origin:location.origin,scriptSrcs:Array.prototype.map.call(document.querySelectorAll('script[src]'),function(s){return s.src}),linkHrefs:Array.prototype.map.call(document.querySelectorAll('link[href]'),function(s){return s.href.slice(0,60)}),hasThree:typeof THREE!=='undefined',threeRev:(typeof THREE!=='undefined')?THREE.REVISION:null};") });

// ============ dist normal-load UI matrix ============
const introClick = `var btns=document.querySelectorAll('#hk-intro button');o.buttons=Array.prototype.map.call(btns,function(b){return b.textContent.trim().slice(0,40)});o.introBefore={phase:o.data.phase,cls:(document.getElementById('hk-intro')||{}).className};btns[0].click();o.step1={phase:o.data.phase,started:HK.app.state.started,mode:o.data.mode};`;
const ui = [];
const uadd = (j) => ui.push(j);
uadd({ id: 'f-ui-loader-1280', url: DIST, out: 'tmp/qa/f-ui-loader-1280.png', w: 1280, h: 720, timeout: 600000, ready: "document.documentElement.dataset.phase==='loading'", wait: 400, shotDelay: 900, eval: E('') });
uadd({ id: 'f-ui-sandbox-1600', url: DIST, out: 'tmp/qa/f-ui-sandbox-1600.png', w: 1600, h: 900, timeout: 600000, ready: "document.documentElement.dataset.phase==='intro'", wait: 800, shotDelay: 2400, eval: E(introClick) });
uadd({ id: 'f-ui-sandbox-1280', url: DIST, out: 'tmp/qa/f-ui-sandbox-1280.png', w: 1280, h: 720, timeout: 600000, ready: "document.documentElement.dataset.phase==='intro'", wait: 800, shotDelay: 2400, eval: E(introClick) });
uadd({ id: 'f-ui-fps-1280', url: DIST, out: 'tmp/qa/f-ui-fps-1280.png', w: 1280, h: 720, timeout: 600000, ready: "document.documentElement.dataset.phase==='intro'", wait: 800, shotDelay: 2600, eval: E(introClick + `btns[1].click();o.step2={phase:o.data.phase,mode:o.data.mode,pointerlock:getComputedStyle(document.getElementById('hk-pointerlock')).display,panel:o.data.panel,player:HK.app.state.player?{district:HK.app.state.player.districtZh,alt:HK.app.state.player.altitudeM}:null};`) });
uadd({ id: 'f-ui-cinema-1600', url: DIST, out: 'tmp/qa/f-ui-cinema-1600.png', w: 1600, h: 900, timeout: 600000, ready: "document.documentElement.dataset.phase==='intro'", wait: 800, shotDelay: 2000, eval: E(introClick + `HK.app.actions.setMode('cinematic');HK.UI.updateCinema({index:1,total:8,titleZh:'中環天際線',titleEn:'CENTRAL SKYLINE',caption:'中環天際線 · CENTRAL SKYLINE'});o.step2={mode:o.data.mode,cinema:getComputedStyle(document.getElementById('hk-cinema')).display,title:(document.getElementById('hk-cinema')||{}).textContent.replace(/\\s+/g,' ').trim().slice(0,140)};`) });
uadd({ id: 'f-ui-help-1600', url: DIST, out: 'tmp/qa/f-ui-help-1600.png', w: 1600, h: 900, timeout: 600000, ready: "document.documentElement.dataset.phase==='intro'", wait: 800, shotDelay: 1400, eval: E(introClick + `HK.UI.openHelp();o.step2={help:getComputedStyle(document.getElementById('hk-help')).display,overlayOpen:HK.UI.isOverlayOpen()};`) });
uadd({ id: 'f-ui-photo-1600', url: DIST, out: 'tmp/qa/f-ui-photo-1600.png', w: 1600, h: 900, timeout: 600000, ready: "document.documentElement.dataset.phase==='intro'", wait: 800, shotDelay: 1400, eval: E(introClick + `HK.app.actions.togglePhoto();o.step2={photo:o.data.photo,photoEl:getComputedStyle(document.getElementById('hk-photo')).display,overlayOpen:HK.UI.isOverlayOpen()};`) });
uadd({
  id: 'f-ui-flow-1280', url: DIST, out: 'tmp/qa/f-ui-flow-1280.png', w: 1280, h: 720, timeout: 600000,
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
    o.teleportMode=HK.app.state.mode;
    try{HK.app.actions.togglePhoto();}catch(e){o.errPhoto=String(e);} snap('t_photo',{photoEl:getComputedStyle(document.getElementById('hk-photo')).display,overlayOpen:HK.UI.isOverlayOpen()});
    try{HK.app.actions.togglePhoto();}catch(e){o.errPhoto2=String(e);}
    try{HK.UI.openHelp();}catch(e){o.errHelp=String(e);} o.helpOpen={display:getComputedStyle(document.getElementById('hk-help')).display,open:HK.UI.isOverlayOpen()};
    try{HK.UI.closeHelp();}catch(e){o.errHelp2=String(e);} o.helpClosed={display:getComputedStyle(document.getElementById('hk-help')).display,open:HK.UI.isOverlayOpen()};
    try{o.screenshotResult=HK.UI.screenshot();}catch(e){o.errShot=String(e);}
    try{HK.app.actions.setAudio(true);o.audioOn=HK.app.state.audio;HK.app.actions.setAudio(false);o.audioOff=HK.app.state.audio;}catch(e){o.errAudio=String(e);}
    try{HK.app.actions.togglePause();o.paused1=HK.app.state.paused;HK.app.actions.togglePause();o.paused2=HK.app.state.paused;}catch(e){o.errPause=String(e);}
    try{HK.UI.toast({zh:'QA 測試',en:'QA TOAST'});o.toastSent=true;}catch(e){o.errToast=String(e);}
    try{
      var wb=document.querySelector('#hk-weather button[data-value="rain"]'); if(wb){wb.click(); o.domWeather=HK.app.state.weather;}
      var qb=document.querySelector('#hk-quality button[data-value="medium"]'); if(qb){qb.click(); o.domQuality=HK.app.state.quality;}
      var lbl=document.querySelector('#hk-weather-zh'); o.weatherLabel=lbl?lbl.textContent:null;
      var qbadge=document.getElementById('hk-quality-badge'); o.qualityBadge=qbadge?qbadge.textContent:null;
      var poiBtn=document.querySelector('#hk-pois button[data-act="poi"]'); if(poiBtn){poiBtn.click(); o.domPoiMode=HK.app.state.mode; o.domPoi=HK.app.state.poi||null;}
      var preset=document.querySelector('#hk-presets button'); if(preset){preset.click(); o.domTime=+HK.app.state.timeHours.toFixed(2);}
    }catch(e){o.errDom=String(e);}
    try{HK.app.actions.setTimeAuto(true);HK.app.actions.setTimeSpeed(1.0);o.timeAutoOn=HK.app.state.timeAuto;o.timeBefore=+HK.app.state.timeHours.toFixed(2);}catch(e){o.errAuto=String(e);}
    try{HK.app.actions.resetCamera();}catch(e){o.errReset=String(e);}
    try{HK.app.events.emit('toast',{zh:'EVENT 測試',en:'EVENT TOAST'});o.eventToast=true;}catch(e){o.errEventToast=String(e);}
  `)
});

fs.writeFileSync('qa/jobs-final-dist.json', JSON.stringify(jobs, null, 2));
fs.writeFileSync('qa/jobs-final-ui.json', JSON.stringify(ui, null, 2));
console.log('dist jobs:', jobs.length, ' ui jobs:', ui.length);
