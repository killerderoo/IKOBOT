// War Train — Twitch EventSub (WebSocket transport) → normalised overlay events.
// STATUS: implemented against the public EventSub docs but NOT tested against a live Twitch channel.
// Needs a *user* access token for the broadcaster with scopes:
//   channel:read:subscriptions   channel:read:hype_train
// Uses Node's global WebSocket (Node 22+). Tokens never leave this process.
const HELIX = 'https://api.twitch.tv/helix';
const WS_URL = 'wss://eventsub.wss.twitch.tv/ws';

export async function startEventSub(o) {
  if (typeof WebSocket === 'undefined') throw new Error('global WebSocket missing — use Node 22 or newer');
  const headers = { 'Client-Id': o.clientId, Authorization: `Bearer ${o.token}`, 'Content-Type': 'application/json' };
  const log = (...a) => console.log('[eventsub]', ...a);

  async function helix(pathname, init) {
    const r = await fetch(HELIX + pathname, Object.assign({ headers }, init));
    const body = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(`${r.status} ${pathname}: ${body.message || JSON.stringify(body)}`);
    return body;
  }

  let broadcasterId = o.broadcasterId;
  if (!broadcasterId) {
    const q = o.broadcasterLogin ? `?login=${encodeURIComponent(o.broadcasterLogin)}` : '';
    const u = await helix(`/users${q}`);
    if (!u.data || !u.data[0]) throw new Error('broadcaster not found');
    broadcasterId = u.data[0].id;
  }
  log('broadcaster id', broadcasterId);

  const avatars = new Map();
  async function avatar(login) {
    if (!login) return '';
    if (avatars.has(login)) return avatars.get(login);
    try {
      const u = await helix(`/users?login=${encodeURIComponent(login)}`);
      const url = (u.data && u.data[0] && u.data[0].profile_image_url) || '';
      avatars.set(login, url);
      return url;
    } catch { return ''; }
  }

  const subs = [
    ['channel.subscribe', '1'],
    ['channel.subscription.message', '1'],
    ['channel.subscription.gift', '1'],
    ['channel.hype_train.begin', o.hypeVersion],
    ['channel.hype_train.progress', o.hypeVersion],
    ['channel.hype_train.end', o.hypeVersion],
  ];
  async function subscribeAll(sessionId) {
    for (const [type, version] of subs) {
      try {
        await helix('/eventsub/subscriptions', { method: 'POST', body: JSON.stringify({ type, version, condition: { broadcaster_user_id: broadcasterId }, transport: { method: 'websocket', session_id: sessionId } }) });
        log('subscribed', type, 'v' + version);
      } catch (e) { log('subscribe failed', type, e.message); }
    }
  }

  let hypeLevel = 0;
  async function toOverlay(type, ev, id) {
    switch (type) {
      case 'channel.subscribe':
        if (ev.is_gift) return null; // recipients of gifts — the gift event credits the gifter
        return { id, type: 'sub', username: ev.user_name, tier: ev.tier };
      case 'channel.subscription.message':
        return { id, type: 'resub', username: ev.user_name, months: ev.cumulative_months, tier: ev.tier };
      case 'channel.subscription.gift': {
        const anon = ev.is_anonymous || !ev.user_login;
        return { id, type: 'gift', username: anon ? 'Anonymous' : ev.user_name, count: ev.total, tier: ev.tier, avatarUrl: anon ? '' : await avatar(ev.user_login) };
      }
      case 'channel.hype_train.begin':
        hypeLevel = ev.level || 1;
        return { id, type: 'hypetrain_progress', level: hypeLevel, progress: ev.progress, goal: ev.goal };
      case 'channel.hype_train.progress': {
        const lvl = ev.level || 1, up = lvl > hypeLevel && hypeLevel > 0;
        hypeLevel = lvl;
        return { id, type: up ? 'hypetrain_levelup' : 'hypetrain_progress', level: lvl, progress: ev.progress, goal: ev.goal };
      }
      case 'channel.hype_train.end':
        hypeLevel = 0;
        return { id, type: 'hypetrain_end', level: ev.level };
    }
    return null;
  }

  let ws = null, watchdog = null, backoff = 1000;
  function connect(url, isReconnect) {
    const sock = new WebSocket(url);
    let timeoutS = 30;
    const arm = () => { clearTimeout(watchdog); watchdog = setTimeout(() => { log('keepalive timeout, reconnecting'); sock.close(); }, (timeoutS + 5) * 1000); };
    sock.onmessage = async (m) => {
      let msg; try { msg = JSON.parse(m.data); } catch { return; }
      const mt = msg.metadata && msg.metadata.message_type;
      arm();
      if (mt === 'session_welcome') {
        timeoutS = msg.payload.session.keepalive_timeout_seconds || 30;
        backoff = 1000;
        const old = ws; ws = sock;
        if (old && old !== sock) old.close(); // reconnect handover: subscriptions carry over
        else if (!isReconnect) await subscribeAll(msg.payload.session.id);
        log('session ready', msg.payload.session.id);
      } else if (mt === 'notification') {
        const ev = await toOverlay(msg.payload.subscription.type, msg.payload.event, msg.metadata.message_id);
        if (ev) o.onEvent(ev);
      } else if (mt === 'session_reconnect') {
        log('server requested reconnect');
        connect(msg.payload.session.reconnect_url, true);
      } else if (mt === 'revocation') {
        log('subscription revoked:', msg.payload.subscription.type, msg.payload.subscription.status);
      }
    };
    sock.onclose = () => {
      if (sock !== ws && ws) return; // an old socket after a handover
      clearTimeout(watchdog);
      ws = null;
      log(`socket closed, new session in ${backoff / 1000}s`);
      setTimeout(() => connect(WS_URL, false), backoff);
      backoff = Math.min(backoff * 2, 60000);
    };
    sock.onerror = () => {};
    if (!ws) ws = sock;
  }
  connect(WS_URL, false);
}
