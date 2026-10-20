/* War Train — configuration. Edit the defaults here or override with URL params (see README). */
window.WT = window.WT || {};
(function (WT) {
  'use strict';

  const defaults = {
    width: 1920,            // design resolution; the canvas scales to the browser source size
    height: 1080,
    railY: 948,             // top of the rail in design pixels

    // 'events' = train only runs when Twitch events arrive (production)
    // 'loop'   = replays the 15s show forever with demo/recent gifters (preview, prerender)
    mode: 'events',
    // 'auto' listens for StreamElements widget events and, if sseUrl is set, the local relay
    // 'mock' adds random mock events every few seconds, 'none' only accepts manual calls
    source: 'auto',
    sseUrl: '',             // e.g. http://localhost:8787/events (server/server.mjs)
    mockInterval: 9,        // seconds between random mock events when source=mock

    showDuration: 15,       // one train pass with one gifter wagon
    extraGifterSeconds: 2.2,// each additional gifter wagon in the same pass adds this much
    maxGiftersPerRun: 3,    // more gifters wait for the next pass (queued, never interrupted)
    aggregateWindowMs: 1800,// gifts from the same user inside this window merge into one wagon
    startDelayMs: 1200,     // wait a moment after the first event so bulk gifts can arrive
    triggerOn: { sub: true, resub: true, gift: true, hypetrain: true },

    quality: 'high',        // 'high' | 'low' (fewer particles for weak PCs)
    avatarLookup: 'none',   // 'none' | 'decapi' (public avatar lookup by username, no token)
    persist: true,          // remember recent gifters / totals in localStorage

    sound: {
      enabled: false,       // muted by default so OBS never plays surprise audio
      volume: 0.5,
      synth: true,          // procedural placeholder sounds when no file is configured
      files: {              // drop files in assets/sfx/ and list them here to replace the synth
        rumble: '', whistle: '', clank: '', cannon: '', reload: '', steam: '', sting: '',
      },
    },

    labels: {
      gifter: 'SUB GIFTER',
      hype: 'HYPE TRAIN',
      blackops: 'BLACK OPS',
      warzone: 'WARZONE',
      thanks: 'THANK YOU, SUB GIFTERS!',
      incoming: 'INCOMING // WAR TRAIN',
      total: 'TOTAL GIFTED',
    },

    colors: {
      accent: '#ff7a1a',
      hot: '#ff3b1f',
      gold: '#ffc840',
      text: '#f4efe6',
    },

    demo: {
      gifters: [
        { username: 'GhostRecon_77', giftCount: 5, tier: '1000' },
        { username: 'SgtKilljoy', giftCount: 20, tier: '1000' },
        { username: 'xX_Nightfall_Xx', giftCount: 1, tier: '2000' },
      ],
      recruits: [
        { username: 'PvtPixel', type: 'sub' },
        { username: 'MajorTom_NL', type: 'resub', months: 14 },
        { username: 'Vortex', type: 'resub', months: 3 },
        { username: 'LtLemon', type: 'sub' },
      ],
      hype: { level: 3, progress: 640, goal: 1000 },
    },
  };

  function deepMerge(a, b) {
    for (const k of Object.keys(b || {})) {
      if (b[k] && typeof b[k] === 'object' && !Array.isArray(b[k]) && a[k] && typeof a[k] === 'object') deepMerge(a[k], b[k]);
      else a[k] = b[k];
    }
    return a;
  }

  function fromUrl() {
    const o = {};
    let p;
    try { p = new URLSearchParams(location.search); } catch (e) { return o; }
    if (p.get('mode')) o.mode = p.get('mode');
    if (p.get('source')) o.source = p.get('source');
    if (p.get('sse')) o.sseUrl = p.get('sse');
    if (p.get('quality')) o.quality = p.get('quality');
    if (p.get('avatars')) o.avatarLookup = p.get('avatars');
    if (p.get('persist') === '0') o.persist = false;
    if (p.get('maxGifters')) o.maxGiftersPerRun = Math.max(1, +p.get('maxGifters') || 3);
    if (p.get('sound') === '1') o.sound = { enabled: true };
    if (p.get('volume')) (o.sound = o.sound || {}).volume = +p.get('volume');
    return o;
  }

  WT.makeConfig = function (overrides) {
    const cfg = deepMerge(JSON.parse(JSON.stringify(defaults)), window.WAR_TRAIN_CONFIG || {});
    deepMerge(cfg, fromUrl());
    return deepMerge(cfg, overrides || {});
  };
  WT.configDefaults = defaults;
})(window.WT);
