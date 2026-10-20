/* War Train — event sources. Each adapter turns provider-specific payloads into normalised events
   and hands them to controller.handle(). No secrets or tokens ever live in this file. */
window.WT = window.WT || {};
(function (WT) {
  'use strict';

  // ---- StreamElements custom widget --------------------------------------------------------
  // Inside a StreamElements custom widget, SE dispatches `onEventReceived` on window.
  // Sub events (listener "subscriber-latest") carry: name, amount, tier, gifted, sender,
  // bulkGifted (community gift by `sender`), isCommunityGift (one recipient of a bulk gift).
  WT.fromStreamElements = function (detail) {
    if (!detail || !detail.event) return null;
    const L = detail.listener, e = detail.event;
    const id = e._id || e.activityId || undefined;
    if (L === 'subscriber-latest') {
      if (e.isCommunityGift) return null; // recipients of a community gift — the bulk event counts it
      if (e.bulkGifted) return { type: 'gift', id, username: e.sender || e.name, count: e.amount, tier: e.tier };
      if (e.gifted) return { type: 'gift', id, username: e.sender || 'Anonymous', count: 1, tier: e.tier };
      if ((+e.amount || 1) > 1) return { type: 'resub', id, username: e.name, months: e.amount, tier: e.tier };
      return { type: 'sub', id, username: e.name, tier: e.tier };
    }
    // Hype train listeners differ per SE account/version; this mapping is best-effort.
    if (/hypetrain/i.test(L || '')) {
      if (/end|complete/i.test(L)) return { type: 'hypetrain_end', id, level: e.level || e.amount };
      if (/level/i.test(L)) return { type: 'hypetrain_levelup', id, level: e.level || e.amount, progress: e.progress, goal: e.goal };
      return { type: 'hypetrain_progress', id, level: e.level, progress: e.progress, goal: e.goal };
    }
    return null;
  };

  WT.connectStreamElements = function (ctrl) {
    window.addEventListener('onEventReceived', (obj) => {
      const ev = WT.fromStreamElements(obj && obj.detail);
      if (ev) ctrl.handle(ev);
    });
  };

  // ---- Local relay (server/server.mjs) via Server-Sent Events ------------------------------
  // The relay holds the Twitch credentials server-side and pushes already-normalised JSON.
  WT.connectSSE = function (ctrl, url) {
    if (!url || !window.EventSource) return null;
    let es, retry = 1000;
    const open = () => {
      es = new EventSource(url);
      es.onopen = () => { retry = 1000; ctrl.emit('source', { sse: 'connected' }); };
      es.onmessage = (m) => { try { ctrl.handle(JSON.parse(m.data)); } catch (e) { /* ignore bad frame */ } };
      es.onerror = () => {
        ctrl.emit('source', { sse: 'reconnecting' });
        es.close();
        setTimeout(open, retry);
        retry = Math.min(retry * 2, 15000);
      };
    };
    open();
    return { close: () => es && es.close() };
  };

  // ---- Mock events for local testing -------------------------------------------------------
  const NAMES = ['Reaper_Six', 'DeadEye_Dutch', 'OverlordNL', 'Kilo141', 'SnipeQueen', 'TacticalTaco', 'Bravo_Two', 'Havoc_X',
    'IronSights', 'NoScopeNora', 'Gh0stLyfe', 'ChopperDown', 'Warlord_Wim', 'Stealth_Sanne', 'CaptainCrunchtime'];
  let n = 0;
  const pick = () => NAMES[Math.floor(Math.random() * NAMES.length)];
  WT.mock = {
    names: NAMES,
    sub: (name) => ({ type: 'sub', id: 'mock-' + ++n, username: name || pick(), tier: '1000' }),
    resub: (name, months) => ({ type: 'resub', id: 'mock-' + ++n, username: name || pick(), months: months || 2 + Math.floor(Math.random() * 30) }),
    gift: (count, name, tier) => ({ type: 'gift', id: 'mock-' + ++n, username: name || pick(), count: count || 1, tier: tier || '1000' }),
    hypeLevel: (level) => ({ type: 'hypetrain_levelup', id: 'mock-' + ++n, level: level || 2, progress: 300 + Math.floor(Math.random() * 600), goal: 1000 }),
    hypeEnd: (level) => ({ type: 'hypetrain_end', id: 'mock-' + ++n, level: level || 5 }),
    random: () => {
      const r = Math.random();
      if (r < 0.45) return WT.mock.gift([1, 1, 5, 10, 20][Math.floor(Math.random() * 5)]);
      if (r < 0.7) return WT.mock.sub();
      if (r < 0.9) return WT.mock.resub();
      return WT.mock.hypeLevel(2 + Math.floor(Math.random() * 4));
    },
    start: (ctrl, seconds) => setInterval(() => ctrl.handle(WT.mock.random()), (seconds || 9) * 1000),
  };
})(window.WT);
