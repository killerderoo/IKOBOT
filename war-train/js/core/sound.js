/* War Train — sound hooks. Muted by default. Uses audio files when configured, otherwise a
   procedural WebAudio placeholder so every hook is audible during testing. */
window.WT = window.WT || {};
(function (WT) {
  'use strict';

  class Sound {
    constructor(cfg) {
      this.cfg = cfg;
      this.ctx = null;
      this.cache = {};
    }
    get enabled() { return !!this.cfg.enabled; }
    setEnabled(on) {
      this.cfg.enabled = on;
      if (on) this._ensure();
    }
    _ensure() {
      if (this.ctx) return this.ctx;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.cfg.volume;
      this.master.connect(this.ctx.destination);
      return this.ctx;
    }

    // Hook names: rumble, whistle, clank, cannon, reload, steam, sting
    play(name, opts) {
      if (!this.enabled) return;
      if (opts && opts.delay) { const o = Object.assign({}, opts, { delay: 0 }); setTimeout(() => this.play(name, o), opts.delay * 1000); return; }
      const file = this.cfg.files && this.cfg.files[name];
      if (file) return this._playFile(file, opts);
      if (this.cfg.synth) this._synth(name, opts || {});
    }

    _playFile(src, opts) {
      try {
        const a = new Audio(src);
        a.volume = Math.min(1, this.cfg.volume * ((opts && opts.gain) || 1));
        a.play().catch(() => {});
      } catch (e) { /* ignore */ }
    }

    _noise(dur) {
      const ac = this.ctx, len = Math.max(1, Math.floor(ac.sampleRate * dur));
      const key = 'n' + len;
      if (!this.cache[key]) {
        const b = ac.createBuffer(1, len, ac.sampleRate), d = b.getChannelData(0);
        let last = 0;
        for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = w * 0.5 + last * 3; }
        this.cache[key] = b;
      }
      const s = ac.createBufferSource();
      s.buffer = this.cache[key];
      return s;
    }

    _env(g, t0, a, peak, dec) {
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(peak, t0 + a);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + a + dec);
    }

    _synth(name, o) {
      const ac = this._ensure();
      if (!ac) return;
      if (ac.state === 'suspended') ac.resume();
      const t = ac.currentTime, gain = o.gain || 1, out = this.master;
      const filt = (type, f) => { const n = ac.createBiquadFilter(); n.type = type; n.frequency.value = f; return n; };

      if (name === 'cannon') {
        const n = this._noise(1.2), lp = filt('lowpass', 900), g = ac.createGain();
        n.connect(lp).connect(g).connect(out);
        this._env(g, t, 0.005, 0.9 * gain, 0.9);
        n.start(t);
        const o1 = ac.createOscillator(), g2 = ac.createGain();
        o1.frequency.setValueAtTime(120, t);
        o1.frequency.exponentialRampToValueAtTime(35, t + 0.5);
        o1.connect(g2).connect(out);
        this._env(g2, t, 0.005, 0.8 * gain, 0.6);
        o1.start(t); o1.stop(t + 0.8);
      } else if (name === 'whistle') {
        [440, 554, 659].forEach((f) => {
          const osc = ac.createOscillator(), g = ac.createGain(), lfo = ac.createOscillator(), lg = ac.createGain();
          osc.type = 'triangle'; osc.frequency.value = f;
          lfo.frequency.value = 6; lg.gain.value = 4; lfo.connect(lg).connect(osc.frequency);
          osc.connect(g).connect(out);
          g.gain.setValueAtTime(0.0001, t);
          g.gain.exponentialRampToValueAtTime(0.12 * gain, t + 0.08);
          g.gain.setValueAtTime(0.12 * gain, t + 1.0);
          g.gain.exponentialRampToValueAtTime(0.0001, t + 1.4);
          osc.start(t); lfo.start(t); osc.stop(t + 1.5); lfo.stop(t + 1.5);
        });
      } else if (name === 'rumble') {
        const d = o.duration || 3, n = this._noise(d), lp = filt('lowpass', 140), g = ac.createGain();
        n.connect(lp).connect(g).connect(out);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.5 * gain, t + 0.6);
        g.gain.setValueAtTime(0.5 * gain, t + d - 0.8);
        g.gain.exponentialRampToValueAtTime(0.0001, t + d);
        n.start(t); n.stop(t + d);
      } else if (name === 'clank' || name === 'reload') {
        const hits = name === 'reload' ? [0, 0.18] : [0];
        hits.forEach((dt) => {
          const osc = ac.createOscillator(), g = ac.createGain(), hp = filt('bandpass', 2400);
          osc.type = 'square'; osc.frequency.value = name === 'reload' ? 1800 : 900 + Math.random() * 400;
          osc.connect(hp).connect(g).connect(out);
          this._env(g, t + dt, 0.002, 0.25 * gain, 0.12);
          osc.start(t + dt); osc.stop(t + dt + 0.2);
        });
      } else if (name === 'steam') {
        const n = this._noise(1), hp = filt('highpass', 2500), g = ac.createGain();
        n.connect(hp).connect(g).connect(out);
        this._env(g, t, 0.03, 0.25 * gain, 0.8);
        n.start(t);
      } else if (name === 'explosion') {
        const n = this._noise(2.5), lp = filt('lowpass', 600), g = ac.createGain();
        n.connect(lp).connect(g).connect(out);
        this._env(g, t, 0.01, 1.0 * gain, 2.2);
        n.start(t);
        const o1 = ac.createOscillator(), g2 = ac.createGain();
        o1.frequency.setValueAtTime(70, t); o1.frequency.exponentialRampToValueAtTime(22, t + 1.4);
        o1.connect(g2).connect(out);
        this._env(g2, t, 0.01, 0.9 * gain, 1.5);
        o1.start(t); o1.stop(t + 1.8);
      } else if (name === 'jet') {
        const n = this._noise(2.4), bp = filt('bandpass', 400), g = ac.createGain();
        bp.frequency.setValueAtTime(300, t); bp.frequency.exponentialRampToValueAtTime(2400, t + 0.9); bp.frequency.exponentialRampToValueAtTime(250, t + 2.2);
        n.connect(bp).connect(g).connect(out);
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.7 * gain, t + 0.8); g.gain.exponentialRampToValueAtTime(0.0001, t + 2.3);
        n.start(t); n.stop(t + 2.4);
      } else if (name === 'siren') {
        const d = o.duration || 2.4, osc = ac.createOscillator(), g = ac.createGain();
        osc.type = 'sawtooth';
        for (let k = 0; k < d; k += 0.8) { osc.frequency.setValueAtTime(420, t + k); osc.frequency.linearRampToValueAtTime(880, t + k + 0.4); osc.frequency.linearRampToValueAtTime(420, t + k + 0.8); }
        const lp = filt('lowpass', 1800);
        osc.connect(lp).connect(g).connect(out);
        g.gain.setValueAtTime(0.12 * gain, t); g.gain.setValueAtTime(0.12 * gain, t + d - 0.1); g.gain.linearRampToValueAtTime(0, t + d);
        osc.start(t); osc.stop(t + d);
      } else if (name === 'chopper' || name === 'minigun') {
        const d = o.duration || 3, n = this._noise(d), f = filt(name === 'chopper' ? 'lowpass' : 'bandpass', name === 'chopper' ? 220 : 1400);
        const g = ac.createGain(), lfo = ac.createOscillator(), lg = ac.createGain();
        lfo.type = 'square'; lfo.frequency.value = name === 'chopper' ? 11 : 38;
        lg.gain.value = 0.25 * gain;
        g.gain.value = 0.3 * gain;
        lfo.connect(lg).connect(g.gain);
        n.connect(f).connect(g).connect(out);
        n.start(t); n.stop(t + d); lfo.start(t); lfo.stop(t + d);
      } else if (name === 'sting') {
        [196, 247, 294, 392].forEach((f, i) => {
          const osc = ac.createOscillator(), g = ac.createGain(), lp = filt('lowpass', 2200);
          osc.type = 'sawtooth'; osc.frequency.value = f;
          osc.connect(lp).connect(g).connect(out);
          this._env(g, t + i * 0.03, 0.02, 0.09 * gain, 1.6);
          osc.start(t); osc.stop(t + 2);
        });
      }
    }
  }

  WT.Sound = Sound;
})(window.WT);
