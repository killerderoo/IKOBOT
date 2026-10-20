/* War Train — preview control panel (preview.html only). */
(function () {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const params = new URLSearchParams(location.search);
  const config = {};
  if (!params.get('mode')) config.mode = 'loop';
  if (!params.get('persist')) config.persist = false;

  WT.boot({ config }).then((api) => {
    const ctrl = api.controller, M = WT.mock;
    const log = (msg) => {
      const el = $('#log');
      el.textContent = `${new Date().toLocaleTimeString()}  ${msg}\n` + el.textContent.slice(0, 3000);
    };
    const send = (ev) => { ctrl.handle(ev); };

    const actions = {
      gift1: () => send(M.gift(1)),
      gift5: () => send(M.gift(5)),
      gift10: () => send(M.gift(10)),
      gift25: () => send(M.gift(25)),
      gift50: () => send(M.gift(50, 'SupremeCommander_With_A_Long_Name'.slice(0, 25))),
      multi: () => { send(M.gift(1)); send(M.gift(5)); send(M.gift(10)); },
      burst: () => { const n = 'TripleTap'; send(M.gift(1, n)); setTimeout(() => send(M.gift(1, n)), 300); setTimeout(() => send(M.gift(3, n)), 700); },
      sub: () => send(M.sub()),
      resub: () => send(M.resub()),
      hype: () => send(M.hypeLevel(2 + Math.floor(Math.random() * 4))),
      hypeEnd: () => send(M.hypeEnd(5)),
    };
    document.querySelectorAll('[data-ev]').forEach((b) => b.addEventListener('click', () => actions[b.dataset.ev]()));
    $('#custom').addEventListener('click', () => {
      send({ type: 'gift', id: 'custom-' + Date.now(), username: $('#name').value || 'CustomGifter', count: +$('#count').value || 1, avatarUrl: $('#avatar').value.trim() });
    });

    $('#loop').checked = api.config.mode === 'loop';
    $('#loop').addEventListener('change', (e) => { api.config.mode = e.target.checked ? 'loop' : 'events'; });
    $('#sound').addEventListener('change', (e) => api.setSound(e.target.checked));
    $('#bg').addEventListener('change', (e) => { document.body.className = 'bg-' + e.target.value; });
    $('#replay').addEventListener('click', () => api.replayDemo());
    $('#reset').addEventListener('click', () => ctrl.resetStats());
    $('#collapse').addEventListener('click', () => $('#panel').classList.toggle('collapsed'));

    ctrl.on((kind, data) => {
      if (kind === 'event') log(`${data.type.toUpperCase()}  ${data.username}${data.type === 'gift' ? ' ×' + data.count : ''}${data.type === 'resub' ? ' ' + data.months + 'mo' : ''}${/hype/.test(data.type) ? ' lvl ' + data.level : ''}`);
      if (kind === 'run') log(`TRAIN DEPARTS  ${data.p.demo ? '(demo)' : data.p.gifters.map((g) => g.username + ' ×' + g.giftCount).join(', ') || '(subs / hype only)'}  ${data.D.toFixed(1)}s`);
    });

    setInterval(() => {
      $('#fps').textContent = api.fps + ' fps';
      const r = ctrl.run;
      $('#status').textContent =
        `train:    ${r ? `running ${ctrl.runT.toFixed(1)} / ${r.D.toFixed(1)}s  scene ${scene(ctrl.runT, r.G)}` : 'idle'}\n` +
        `queued:   ${ctrl.pendingGifters.length} gifter(s), ${ctrl.pendingRecruits.length} sub(s)${ctrl.pendingHype ? ', hype ' + ctrl.pendingHype.event : ''}\n` +
        `total:    ${ctrl.totalGifts} gifted   particles ${api.fx.p.length}`;
    }, 200);

    function scene(t, G) {
      const b = [2, 4, 7 + G, 10 + G, 13 + G];
      let s = 1;
      for (const x of b) if (t >= x) s++;
      return s;
    }
  });
})();
