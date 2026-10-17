/* ============================================================================
 * HK VOXEL HARBOUR — PROCEDURAL AUDIO
 * Zero audio files. Everything synthesised with the WebAudio API:
 *   harbour waves + deep swell, city rumble, neon hum, rain/wind beds,
 *   distant ferry horns, gull calls, occasional traffic wash, thunder,
 *   tiny UI clicks.
 *
 * Starts only after a user gesture (browser policy). Master fade in/out,
 * context suspended while disabled or while the tab is hidden.
 *
 *   HK.Audio.setEnabled(bool)   master on/off (smooth fade)
 *   HK.Audio.userGesture()      call from a real click/keydown
 *   HK.Audio.update(state)      night / weather / mode / photo / paused
 *   HK.Audio.click()            UI tick
 * ==========================================================================*/
(function () {
  'use strict';

  var HK = window.HK = window.HK || {};
  var A = HK.Audio = HK.Audio || {};

  var ctx = null;
  var master = null;
  var limiter = null;
  var enabled = false;
  var layers = {};
  var timers = { gull: 0, horn: 0, traffic: 0, thunder: 0 };
  var noiseCache = {};
  var state = {
    audio: false,
    night: 0,
    weather: 'clear',
    timeHours: 18.6,
    mode: 'orbit',
    photo: false,
    paused: false,
    phase: 'loading'
  };
  var MASTER = 0.34;
  var started = false;

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function num(v, d) { return (typeof v === 'number' && isFinite(v)) ? v : d; }

  function ensureCtx() {
    if (ctx) return ctx;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try {
      ctx = new AC();
    } catch (e) {
      ctx = null;
      return null;
    }

    limiter = ctx.createDynamicsCompressor();
    try {
      limiter.threshold.value = -18;
      limiter.knee.value = 22;
      limiter.ratio.value = 4;
      limiter.attack.value = 0.02;
      limiter.release.value = 0.35;
    } catch (e) {}
    master = ctx.createGain();
    master.gain.value = 0;
    master.connect(limiter);
    limiter.connect(ctx.destination);

    buildLayers();
    started = true;
    return ctx;
  }

  function noiseBuffer(kind, seconds) {
    var key = kind + ':' + (seconds || 3);
    if (noiseCache[key]) return noiseCache[key];
    var len = Math.max(1, Math.floor(ctx.sampleRate * (seconds || 3)));
    var buf = ctx.createBuffer(1, len, ctx.sampleRate);
    var data = buf.getChannelData(0);
    var i;
    if (kind === 'brown') {
      var last = 0;
      for (i = 0; i < len; i++) {
        var w = Math.random() * 2 - 1;
        last = (last + 0.02 * w) / 1.02;
        data[i] = last * 3.0;
      }
    } else if (kind === 'pink') {
      var b0 = 0, b1 = 0, b2 = 0;
      for (i = 0; i < len; i++) {
        var ww = Math.random() * 2 - 1;
        b0 = 0.99765 * b0 + ww * 0.099046;
        b1 = 0.963 * b1 + ww * 0.2965164;
        b2 = 0.57 * b2 + ww * 1.0526913;
        data[i] = (b0 + b1 + b2 + ww * 0.1848) * 0.22;
      }
    } else {
      for (i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    }
    noiseCache[key] = buf;
    return buf;
  }

  function loopNoise(kind, filterType, freq, q, gainValue) {
    var src = ctx.createBufferSource();
    src.buffer = noiseBuffer(kind, 4);
    src.loop = true;
    var filter = ctx.createBiquadFilter();
    filter.type = filterType || 'lowpass';
    filter.frequency.value = freq || 800;
    filter.Q.value = q == null ? 0.6 : q;
    var gain = ctx.createGain();
    gain.gain.value = gainValue || 0.2;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start(0);
    return { src: src, filter: filter, gain: gain };
  }

  function lfo(freq, depth, targetParam, type) {
    var osc = ctx.createOscillator();
    osc.type = type || 'sine';
    osc.frequency.value = freq;
    var g = ctx.createGain();
    g.gain.value = depth;
    osc.connect(g);
    g.connect(targetParam);
    osc.start(0);
    return { osc: osc, gain: g };
  }

  function buildLayers() {
    /* harbour swell — filtered noise breathing slowly */
    layers.waves = loopNoise('white', 'lowpass', 620, 0.5, 0.40);
    lfo(0.062, 0.16, layers.waves.gain.gain, 'sine');
    lfo(0.017, 0.05, layers.waves.filter.frequency, 'sine');

    /* deep water pressure */
    layers.deep = loopNoise('brown', 'lowpass', 140, 0.4, 0.20);

    /* city rumble (Kowloon / Island both sides) */
    layers.rumble = loopNoise('brown', 'lowpass', 240, 0.5, 0.16);
    lfo(0.031, 0.035, layers.rumble.gain.gain, 'sine');

    /* wind / humid haze */
    layers.wind = loopNoise('pink', 'bandpass', 1350, 0.35, 0.03);
    lfo(0.047, 0.012, layers.wind.gain.gain, 'sine');

    /* rain bed (gain driven by weather) */
    layers.rain = loopNoise('pink', 'highpass', 900, 0.3, 0.0001);
    layers.rain2 = loopNoise('white', 'lowpass', 4200, 0.2, 0.0001);

    /* neon hum: 100Hz + slightly detuned fifth, tremolo */
    var humBus = ctx.createGain();
    humBus.gain.value = 0;
    var humFilter = ctx.createBiquadFilter();
    humFilter.type = 'lowpass';
    humFilter.frequency.value = 420;
    humBus.connect(humFilter);
    humFilter.connect(master);
    var o1 = ctx.createOscillator();
    o1.type = 'sine'; o1.frequency.value = 100;
    var o2 = ctx.createOscillator();
    o2.type = 'sine'; o2.frequency.value = 150.4;
    var o3 = ctx.createOscillator();
    o3.type = 'triangle'; o3.frequency.value = 50.1;
    var g1 = ctx.createGain(); g1.gain.value = 0.55;
    var g2 = ctx.createGain(); g2.gain.value = 0.28;
    var g3 = ctx.createGain(); g3.gain.value = 0.16;
    o1.connect(g1); g1.connect(humBus);
    o2.connect(g2); g2.connect(humBus);
    o3.connect(g3); g3.connect(humBus);
    o1.start(0); o2.start(0); o3.start(0);
    lfo(0.13, 0.06, humBus.gain, 'sine');
    layers.hum = { gain: humBus };

    /* gull / horn / traffic buses (LPF = distance) */
    layers.fx = ctx.createGain();
    layers.fx.gain.value = 0.9;
    var fxFilter = ctx.createBiquadFilter();
    fxFilter.type = 'lowpass';
    fxFilter.frequency.value = 2400;
    layers.fx.connect(fxFilter);
    fxFilter.connect(master);
  }

  /* ------------------------------------------------------------- one-shots */
  function gull() {
    if (!ctx) return;
    var t0 = ctx.currentTime;
    var f = 1080 + Math.random() * 420;
    var calls = 2 + Math.floor(Math.random() * 3);
    for (var i = 0; i < calls; i++) {
      var t = t0 + i * (0.17 + Math.random() * 0.1);
      var o = ctx.createOscillator();
      o.type = 'sine';
      var g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      o.frequency.setValueAtTime(f * (1 + i * 0.03), t);
      o.frequency.exponentialRampToValueAtTime(f * 0.66, t + 0.15);
      o.frequency.exponentialRampToValueAtTime(f * 0.92, t + 0.3);
      g.gain.linearRampToValueAtTime(0.05, t + 0.018);
      g.gain.exponentialRampToValueAtTime(0.0006, t + 0.34);
      o.connect(g);
      g.connect(layers.fx);
      o.start(t);
      o.stop(t + 0.4);
    }
  }

  function horn() {
    if (!ctx) return;
    var t = ctx.currentTime;
    var bus = ctx.createGain();
    var lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 520;
    bus.connect(lp);
    lp.connect(layers.fx);
    var defs = [
      { type: 'sawtooth', f: 98, g: 0.30 },
      { type: 'sine', f: 147, g: 0.34 },
      { type: 'sine', f: 294.6, g: 0.07 },
      { type: 'triangle', f: 73.4, g: 0.22 }
    ];
    for (var i = 0; i < defs.length; i++) {
      var o = ctx.createOscillator();
      o.type = defs[i].type;
      o.frequency.value = defs[i].f;
      o.detune.value = (Math.random() - 0.5) * 8;
      var g = ctx.createGain();
      g.gain.value = defs[i].g;
      o.connect(g);
      g.connect(bus);
      o.start(t);
      o.stop(t + 6.2);
    }
    bus.gain.setValueAtTime(0.0001, t);
    bus.gain.linearRampToValueAtTime(0.16, t + 0.22);
    bus.gain.setValueAtTime(0.16, t + 1.35);
    bus.gain.exponentialRampToValueAtTime(0.0008, t + 2.5);
    bus.gain.setValueAtTime(0.0001, t + 2.9);
    bus.gain.linearRampToValueAtTime(0.13, t + 3.05);
    bus.gain.setValueAtTime(0.13, t + 3.9);
    bus.gain.exponentialRampToValueAtTime(0.0007, t + 5.1);
  }

  function trafficWash() {
    if (!ctx) return;
    var t = ctx.currentTime;
    var src = ctx.createBufferSource();
    src.buffer = noiseBuffer('pink', 4);
    src.loop = true;
    var bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(420 + Math.random() * 260, t);
    bp.frequency.linearRampToValueAtTime(1150, t + 1.4);
    bp.frequency.linearRampToValueAtTime(520, t + 3.0);
    bp.Q.value = 0.9;
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.05, t + 1.1);
    g.gain.exponentialRampToValueAtTime(0.0005, t + 3.1);
    src.connect(bp); bp.connect(g); g.connect(layers.fx);
    src.start(t);
    src.stop(t + 3.3);
  }

  function thunder() {
    if (!ctx) return;
    var t = ctx.currentTime;
    var src = ctx.createBufferSource();
    src.buffer = noiseBuffer('brown', 5);
    var lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 96;
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.22, t + 0.35);
    g.gain.exponentialRampToValueAtTime(0.0005, t + 3.6);
    src.connect(lp); lp.connect(g); g.connect(master);
    src.start(t);
    src.stop(t + 3.8);
  }

  /* -------------------------------------------------------------- scheduling */
  function scheduleGull() {
    if (!enabled || !ctx) return;
    window.clearTimeout(timers.gull);
    timers.gull = window.setTimeout(function () {
      if (enabled && state.night < 0.65 && !state.paused && state.phase !== 'loading') gull();
      scheduleGull();
    }, 9000 + Math.random() * 17000);
  }
  function scheduleHorn() {
    if (!enabled || !ctx) return;
    window.clearTimeout(timers.horn);
    timers.horn = window.setTimeout(function () {
      if (enabled && state.phase !== 'loading') horn();
      scheduleHorn();
    }, 17000 + Math.random() * 26000);
  }
  function scheduleTraffic() {
    if (!enabled || !ctx) return;
    window.clearTimeout(timers.traffic);
    timers.traffic = window.setTimeout(function () {
      if (enabled && !state.paused && state.phase !== 'loading') trafficWash();
      scheduleTraffic();
    }, 8000 + Math.random() * 16000);
  }
  function scheduleThunder() {
    if (!enabled || !ctx) return;
    window.clearTimeout(timers.thunder);
    timers.thunder = window.setTimeout(function () {
      if (enabled && state.weather === 'rain' && state.night > 0.35 && !state.paused) thunder();
      scheduleThunder();
    }, 22000 + Math.random() * 38000);
  }
  function startScheduling() {
    scheduleGull();
    scheduleHorn();
    scheduleTraffic();
    scheduleThunder();
  }
  function stopScheduling() {
    window.clearTimeout(timers.gull);
    window.clearTimeout(timers.horn);
    window.clearTimeout(timers.traffic);
    window.clearTimeout(timers.thunder);
    timers.gull = timers.horn = timers.traffic = timers.thunder = 0;
  }

  /* ------------------------------------------------------------------ mixer */
  function glide(param, value, seconds) {
    if (!param) return;
    try {
      param.setTargetAtTime(value, ctx.currentTime, Math.max(0.05, seconds || 0.6));
    } catch (e) {
      try { param.value = value; } catch (e2) {}
    }
  }

  function applyMix() {
    if (!ctx || !layers.waves) return;
    var n = clamp(num(state.night, 0), 0, 1);
    var rain = state.weather === 'rain';
    var mist = state.weather === 'mist';
    var duck = state.paused ? 0.35 : 1;
    var photo = state.photo ? 0.55 : 1;
    var cine = state.mode === 'cinematic' ? 1.12 : 1;
    var base = duck * photo * cine;
    var surf = (0.40 + (rain ? 0.10 : 0) - n * 0.09) * base;
    glide(layers.waves.gain.gain, surf, 1.0);
    glide(layers.deep.gain.gain, (0.20 + n * 0.06) * base, 1.2);
    glide(layers.rumble.gain.gain, (0.16 + (rain ? 0.04 : 0)) * base, 1.4);
    glide(layers.wind.gain.gain, (mist ? 0.14 : (rain ? 0.07 : 0.03)) * base, 1.4);
    glide(layers.rain.gain.gain, rain ? 0.11 * base : 0.0001, 1.6);
    glide(layers.rain2.gain.gain, rain ? 0.045 * base : 0.0001, 1.6);
    glide(layers.hum.gain.gain, (n * n) * 0.085 * base, 1.8);
    glide(layers.fx.gain.gain, 0.9 * base, 1.2);
  }

  /* ------------------------------------------------------------------- API */
  A.userGesture = function () {
    if (!ctx) return false;
    if (ctx.state === 'suspended') {
      try { ctx.resume(); } catch (e) {}
    }
    return true;
  };

  A.setEnabled = function (on) {
    on = !!on;
    enabled = on;
    state.audio = on;
    if (on) {
      if (!ensureCtx()) return false;
      A.userGesture();
      try { master.gain.setTargetAtTime(MASTER, ctx.currentTime, 0.5); } catch (e) { master.gain.value = MASTER; }
      if (ctx.state === 'suspended') { try { ctx.resume(); } catch (e) {} }
      applyMix();
      startScheduling();
    } else {
      stopScheduling();
      if (ctx && master) {
        try { master.gain.setTargetAtTime(0, ctx.currentTime, 0.25); } catch (e) { master.gain.value = 0; }
        window.setTimeout(function () {
          if (!enabled && ctx && ctx.state === 'running') {
            try { ctx.suspend(); } catch (e) {}
          }
        }, 1200);
      }
    }
    return true;
  };

  A.isEnabled = function () { return enabled; };

  A.update = function (s) {
    if (!s) return;
    if (s.audio != null) state.audio = !!s.audio;
    if (s.night != null) state.night = clamp(num(s.night, 0), 0, 1);
    if (s.weather) state.weather = s.weather;
    if (s.mode) state.mode = s.mode;
    if (s.photo != null) state.photo = !!s.photo;
    if (s.paused != null) state.paused = !!s.paused;
    if (s.phase) state.phase = s.phase;
    if (s.timeHours != null) state.timeHours = num(s.timeHours, state.timeHours);
    if (ctx) applyMix();
  };

  A.click = function () {
    if (!enabled || !ctx || ctx.state !== 'running') return;
    var t = ctx.currentTime;
    var o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(1750, t);
    o.frequency.exponentialRampToValueAtTime(880, t + 0.055);
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.055, t);
    g.gain.exponentialRampToValueAtTime(0.0005, t + 0.07);
    o.connect(g);
    g.connect(master);
    o.start(t);
    o.stop(t + 0.09);
  };

  A.pauseForVisibility = function (hidden) {
    if (!ctx || !enabled) return;
    try {
      if (hidden) ctx.suspend();
      else ctx.resume();
    } catch (e) {}
  };

  document.addEventListener('visibilitychange', function () {
    A.pauseForVisibility(!!document.hidden);
  });
})();
