/* War Train — event queue + run scheduler.
   Events never interrupt a running train: they are queued and picked up by the next pass. */
window.WT = window.WT || {};
(function (WT) {
  'use strict';
  const U = WT.U;
  const TYPES = ['sub', 'resub', 'gift', 'hypetrain_levelup', 'hypetrain_progress', 'hypetrain_end'];

  // Normalised event shape used everywhere in the overlay:
  // { id, type, username, avatarUrl, count, tier, months, level, progress, goal }
  WT.normalize = function (raw) {
    if (!raw || TYPES.indexOf(raw.type) < 0) return null;
    const e = {
      id: String(raw.id || raw.eventId || `${raw.type}-${raw.username || ''}-${raw.count || ''}-${Date.now()}-${Math.random()}`),
      type: raw.type,
      username: U.cleanName(raw.username || raw.name || raw.user_name),
      avatarUrl: typeof raw.avatarUrl === 'string' && /^https?:\/\//.test(raw.avatarUrl) ? raw.avatarUrl : '',
      count: Math.max(1, Math.min(1000, parseInt(raw.count || raw.amount || 1, 10) || 1)),
      tier: String(raw.tier || '1000'),
      months: Math.max(1, parseInt(raw.months || 1, 10) || 1),
      level: Math.max(1, parseInt(raw.level || 1, 10) || 1),
      progress: +raw.progress || 0,
      goal: +raw.goal || 0,
    };
    return e;
  };

  class TrainController {
    constructor(cfg, fx, sound) {
      this.cfg = cfg;
      this.fx = fx;
      this.sound = sound;
      this.clock = 0;
      this.run = null;
      this.runT = 0;
      this.pendingGifters = [];
      this.pendingRecruits = [];
      this.pendingHype = null;
      this.hype = { level: 1, progress: 0, goal: 0 };
      this.wakeAt = Infinity;
      this.seen = [];
      this.demoIdx = 0;
      this.listeners = [];
      this.recent = [];
      this.totalGifts = 0;
      this.load();
    }

    on(fn) { this.listeners.push(fn); }
    emit(kind, data) { for (const fn of this.listeners) try { fn(kind, data); } catch (e) { /* ignore */ } }

    load() {
      if (!this.cfg.persist) return;
      try {
        const s = JSON.parse(localStorage.getItem('wartrain.state') || 'null');
        if (s) { this.recent = s.recent || []; this.totalGifts = s.totalGifts || 0; }
      } catch (e) { /* storage unavailable — start fresh */ }
    }
    save() {
      if (!this.cfg.persist) return;
      try { localStorage.setItem('wartrain.state', JSON.stringify({ recent: this.recent.slice(0, 10), totalGifts: this.totalGifts })); } catch (e) { /* ignore */ }
    }
    resetStats() { this.recent = []; this.totalGifts = 0; this.save(); this.emit('stats'); }

    // Entry point for every integration (mock, StreamElements, SSE relay, custom code).
    handle(raw) {
      const e = WT.normalize(raw);
      if (!e) return false;
      if (this.seen.indexOf(e.id) >= 0) return false; // duplicate delivery
      this.seen.push(e.id);
      if (this.seen.length > 300) this.seen.shift();
      const trig = this.cfg.triggerOn;

      if (e.type === 'gift') {
        // merge rapid repeat gifts from the same person into one wagon (only while still queued)
        const same = this.pendingGifters.find((g) => g.username.toLowerCase() === e.username.toLowerCase() && this.clock - g.at < this.cfg.aggregateWindowMs / 1000);
        if (same) { same.giftCount += e.count; same.at = this.clock; }
        else {
          const g = { username: e.username, avatarUrl: e.avatarUrl, giftCount: e.count, tier: e.tier, eventId: e.id, at: this.clock };
          this.pendingGifters.push(g);
          if (!g.avatarUrl && this.cfg.avatarLookup === 'decapi' && e.username !== 'Anonymous') this.lookupAvatar(g);
        }
        if (trig.gift) this.arm();
      } else if (e.type === 'sub' || e.type === 'resub') {
        this.pendingRecruits.push({ username: e.username, type: e.type, months: e.months });
        if (this.pendingRecruits.length > 8) this.pendingRecruits.shift();
        if (trig[e.type]) this.arm();
      } else if (e.type === 'hypetrain_progress') {
        Object.assign(this.hype, { level: e.level, progress: e.progress, goal: e.goal });
      } else if (e.type === 'hypetrain_levelup') {
        Object.assign(this.hype, { level: e.level, progress: e.progress || this.hype.progress, goal: e.goal || this.hype.goal, complete: false });
        this.pendingHype = { event: 'levelup', level: e.level };
        if (trig.hypetrain) this.arm();
      } else if (e.type === 'hypetrain_end') {
        Object.assign(this.hype, { level: e.level, complete: true, progress: 1, goal: 1 });
        this.pendingHype = { event: 'complete', level: e.level };
        if (trig.hypetrain) this.arm();
      }
      this.emit('event', e);
      this.emit('queue');
      return true;
    }

    lookupAvatar(g) {
      fetch(`https://decapi.me/twitch/avatar/${encodeURIComponent(g.username)}`)
        .then((r) => r.text())
        .then((u) => { u = u.trim(); if (/^https:\/\//.test(u)) g.avatarUrl = u; })
        .catch(() => {});
    }

    arm() {
      const at = this.clock + this.cfg.startDelayMs / 1000;
      if (this.wakeAt === Infinity) this.wakeAt = at;
    }

    hasWork() {
      return this.pendingGifters.length > 0 || this.pendingHype || this.pendingRecruits.length > 0;
    }

    startRun(demo) {
      const cfg = this.cfg;
      let gifters, recruits, hype, recent, counter, wagons;
      if (demo) {
        // preview / prerender pass: rotate through the demo gifters, never touch real stats
        const d = cfg.demo.gifters, i = this.demoIdx++;
        const bombs = d.filter((x) => x.giftCount >= cfg.bombMin), small = d.filter((x) => x.giftCount < cfg.bombMin);
        const bomb = Object.assign({}, bombs[i % Math.max(1, bombs.length)] || d[i]);
        const squadMembers = (cfg.demo.squad || small).map((x) => Object.assign({}, x));
        gifters = squadMembers.concat([bomb]);
        wagons = [{ type: 'squad', members: squadMembers }, { type: 'bomb', g: bomb }];
        recruits = cfg.demo.recruits.slice();
        hype = Object.assign({}, cfg.demo.hype);
        recent = gifters.slice().reverse().concat(d).filter((g, k, arr) => arr.findIndex((x) => x.username === g.username) === k).slice(0, 5);
        const base = 120 + i * 7;
        counter = [base, base + gifters.reduce((a, g) => a + g.giftCount, 0)];
      } else {
        // every SUB BOMB (≥ bombMin gifts) gets its own cannon wagon; smaller gifts share squad wagons of 5
        gifters = [];
        wagons = [];
        let squad = null;
        while (this.pendingGifters.length) {
          const g = this.pendingGifters[0];
          const bomb = g.giftCount >= cfg.bombMin;
          const needs = bomb || !squad || squad.members.length >= 5;
          if (needs && wagons.length >= cfg.maxWagonsPerRun) break;
          this.pendingGifters.shift();
          gifters.push(g);
          if (bomb) wagons.push({ type: 'bomb', g });
          else {
            if (!squad || squad.members.length >= 5) { squad = { type: 'squad', members: [] }; wagons.push(squad); }
            squad.members.push(g);
          }
        }
        recruits = this.pendingRecruits.splice(0, 4);
        hype = Object.assign({}, this.hype, this.pendingHype || {});
        this.pendingHype = null;
      }
      if (!demo) {
        recent = gifters.slice().reverse().concat(this.recent.filter((r) => !gifters.some((g) => g.username === r.username))).slice(0, 5);
        const thisRun = gifters.reduce((a, g) => a + g.giftCount, 0);
        counter = [this.totalGifts, this.totalGifts + thisRun];
      }
      this.run = new WT.Run(this, { gifters, wagons, recruits, hype, recent, counter, demo: !!demo });
      this.runT = 0;
      this.wakeAt = Infinity;
      this.emit('run', this.run);
      this.emit('queue');
    }

    // Called by a Run when a gifter's cannon fires: counts the gifts and updates the roster.
    onGifterFired(g) {
      if (this.run && this.run.p.demo) return; // demo passes never change real stats
      this.totalGifts += g.giftCount;
      this.recent = [{ username: g.username, giftCount: g.giftCount }].concat(this.recent.filter((r) => r.username !== g.username)).slice(0, 10);
      this.save();
      this.emit('stats');
    }

    tick(dt) {
      this.clock += dt;
      if (this.run) {
        this.runT += dt;
        this.run.update(this.runT, dt);
        if (this.runT >= this.run.D) {
          this.run = null;
          this.emit('idle');
          if (this.hasWork()) this.wakeAt = this.clock + 0.3;
        }
      }
      if (!this.run) {
        if (this.hasWork() && this.clock >= this.wakeAt) { this.wakeAt = Infinity; this.startRun(false); }
        else if (!this.hasWork() && this.cfg.mode === 'loop') this.startRun(true);
      }
      this.fx.update(dt);
    }

    draw(ctx) {
      if (this.run) this.run.draw(ctx, this.runT);
      else { this.fx.draw(ctx, 'back'); this.fx.draw(ctx, 'front'); }
    }
  }

  WT.TrainController = TrainController;
})(window.WT);
