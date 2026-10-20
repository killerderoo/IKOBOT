/* War Train — bootstrap: canvas sizing, render loop, event sources and the public window.WarTrain API. */
window.WT = window.WT || {};
(function (WT) {
  'use strict';

  function waitFonts(ms) {
    if (!document.fonts || !document.fonts.load) return Promise.resolve();
    const loads = ['40px "Black Ops One"', '700 40px Oswald', '500 20px Oswald'].map((f) => document.fonts.load(f).catch(() => {}));
    return Promise.race([Promise.all(loads), new Promise((r) => setTimeout(r, ms))]);
  }

  WT.boot = async function (opts) {
    opts = opts || {};
    const cfg = (WT.cfg = WT.makeConfig(opts.config));
    const canvas = opts.canvas || document.getElementById('wt-canvas');
    const ctx = canvas.getContext('2d', { alpha: true });
    const params = new URLSearchParams(location.search);
    const exportMode = params.get('export') === '1';

    await waitFonts(3000);

    const fx = new WT.FX(cfg.quality);
    WT.sprites = fx.sprites;
    const sound = new WT.Sound(cfg.sound);
    const ctrl = new WT.TrainController(cfg, fx, sound);

    // Resolution: always render the 1920×1080 design space, scaled to the actual canvas size.
    let scale = 1;
    function resize() {
      if (exportMode) { canvas.width = cfg.width; canvas.height = cfg.height; scale = 1; return; }
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.max(320, Math.round(rect.width * dpr)), h = Math.round((w * cfg.height) / cfg.width);
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
      scale = w / cfg.width;
    }
    resize();
    window.addEventListener('resize', resize);

    function render() {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height); // true alpha: nothing painted = transparent
      const sh = fx.shakeOffset(ctrl.clock);
      ctx.setTransform(scale, 0, 0, scale, sh[0] * scale, sh[1] * scale);
      ctrl.draw(ctx);
    }

    // Sources
    if (cfg.source === 'auto' || cfg.source === 'streamelements') WT.connectStreamElements(ctrl);
    if (cfg.sseUrl && cfg.source !== 'none') WT.connectSSE(ctrl, cfg.sseUrl);
    if (cfg.source === 'mock') WT.mock.start(ctrl, cfg.mockInterval);

    // Loop (fixed-step simulation keeps particles stable at any refresh rate)
    const STEP = 1 / 60;
    let last = performance.now(), accT = 0, frames = 0, fpsT = 0;
    const api = (window.WarTrain = {
      config: cfg, controller: ctrl, sound, fx, fps: 0,
      handle: (ev) => ctrl.handle(ev),
      mock: WT.mock,
      setSound: (on) => sound.setEnabled(on),
      replayDemo: () => { if (!ctrl.run) ctrl.startRun(true); },
      // Export helpers (used by tools/render-webm.mjs): step exactly one 60fps frame and return a PNG.
      exportFrame: () => { ctrl.tick(STEP); render(); return canvas.toDataURL('image/png'); },
      step: (n) => { for (let i = 0; i < n; i++) ctrl.tick(STEP); render(); },
      runDuration: () => (ctrl.run ? ctrl.run.D : 0),
    });

    if (!exportMode) {
      const frame = (now) => {
        let dt = (now - last) / 1000;
        last = now;
        if (dt > 0.25) dt = 0.25; // tab was hidden: don't fast-forward through a whole scene
        accT += dt;
        while (accT >= STEP) { ctrl.tick(STEP); accT -= STEP; }
        render();
        frames++; fpsT += dt;
        if (fpsT >= 0.5) { api.fps = Math.round(frames / fpsT); frames = 0; fpsT = 0; }
        requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
    }
    if (opts.onReady) opts.onReady(api);
    return api;
  };
})(window.WT);
