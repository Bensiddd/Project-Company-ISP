import { Router } from 'express';
import { RouterOSAPI } from 'node-routeros';
import db from '../db.js';
import { authenticate } from '../middleware/auth.js';
import { encrypt, decrypt, maskSecret } from '../utils/encryption.js';

const router = Router();

let mikrotikConn = null;
let currentConfigHash = '';
let connectPromise = null;

async function closeMikrotikConn() {
  if (mikrotikConn) {
    try { await mikrotikConn.close(); } catch {}
    mikrotikConn = null;
    currentConfigHash = '';
  }
}

async function getMikrotikConnection() {
  const config = await db.get('SELECT * FROM mikrotik_settings ORDER BY id DESC LIMIT 1');
  if (!config || !config.host) throw new Error('No configuration');

  const hash = `${config.host}:${config.port || 8728}:${config.username}`;

  if (mikrotikConn && currentConfigHash === hash) {
    try {
      await mikrotikConn.write('/system/identity/print');
      return mikrotikConn;
    } catch {
      await closeMikrotikConn();
    }
  }

  if (!connectPromise) {
    connectPromise = (async () => {
      await closeMikrotikConn();
      const pw = decrypt(config.password);
        const conn = new RouterOSAPI({
          host: config.host,
          user: config.username,
          password: pw,
          port: config.port || 8728,
          timeout: 20000
        });
      await conn.connect();
      mikrotikConn = conn;
      currentConfigHash = hash;
      return mikrotikConn;
    })();
  }

  try {
    return await connectPromise;
  } finally {
    connectPromise = null;
  }
}

router.get('/settings', authenticate, async (_req, res) => {
  const row = await db.get('SELECT * FROM mikrotik_settings ORDER BY id DESC LIMIT 1');
  if (row) {
    try {
      row.password = row.password ? maskSecret(decrypt(row.password)) : '';
    } catch {
      row.password = row.password ? '••••(invalid)' : '';
    }
    res.json(row);
  } else {
    res.json({ host: '', username: '', password: '', port: 8728, is_active: 0 });
  }
});

router.post('/settings', authenticate, async (req, res) => {
  const { host, username, password, port } = req.body;
  const existing = await db.get('SELECT * FROM mikrotik_settings ORDER BY id DESC LIMIT 1');
  // Preserve existing encrypted password if caller didn't send a new one
  const storedPassword = (password && password.length > 0)
    ? encrypt(password)
    : (existing ? existing.password : '');
  if (existing) {
    await db.run('UPDATE mikrotik_settings SET host=?, username=?, password=?, port=?, is_active=1, updated_at=CURRENT_TIMESTAMP WHERE id=?', [host || '', username || '', storedPassword, port || 8728, existing.id]);
  } else {
    await db.insert('INSERT INTO mikrotik_settings (host, username, password, port, is_active) VALUES (?, ?, ?, ?, 1)', [host || '', username || '', storedPassword, port || 8728]);
  }
  await closeMikrotikConn();
  const row = await db.get('SELECT * FROM mikrotik_settings ORDER BY id DESC LIMIT 1');
  row.password = '';
  res.json(row);
});

router.get('/status', authenticate, async (_req, res) => {
  try {
    const conn = await getMikrotikConnection();
    const identity = await conn.write('/system/identity/print');
    const config = await db.get('SELECT host FROM mikrotik_settings ORDER BY id DESC LIMIT 1');
    res.json({ connected: true, identity: identity?.[0]?.name || 'Unknown', host: config?.host || '' });
  } catch (e) {
    res.json({ connected: false, error: e.message });
  }
});

router.get('/interfaces', authenticate, async (_req, res) => {
  try {
    const conn = await getMikrotikConnection();
    const ifaces = await conn.write('/interface/print');
    res.json(ifaces.map(i => ({ name: i.name, type: i.type, 'mtu': i.mtu, running: i.running === 'true', disabled: i.disabled === 'true' })));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/traffic/:interface', authenticate, async (req, res) => {
  try {
    const conn = await getMikrotikConnection();
    const traffic = await conn.write('/interface/monitor-traffic', [`=interface=${req.params.interface}`, '=once=']);
    const row = traffic?.[0] || {};
    res.json({ rx: parseInt(row['rx-bits-per-second']) || 0, tx: parseInt(row['tx-bits-per-second']) || 0 });
  } catch (e) {
    res.status(500).json({ error: e.message, rx: 0, tx: 0 });
  }
});

router.get('/logs', authenticate, async (_req, res) => {
  try {
    const conn = await getMikrotikConnection();
    const logs = await conn.write('/log/print', []);
    const filtered = (logs || []).filter(l => {
      const topics = (l.topics || '').toLowerCase().split(',');
      return !topics.includes('telnet') && !topics.includes('debug') && !topics.includes('api');
    });
      res.json({ logs: filtered.slice(-100).reverse().map(l => ({
      id: l['.id'] || '', time: l.time || '', topics: l.topics || '', message: l.message || ''
    })) });
  } catch (e) {
    res.status(500).json({ error: e.message, logs: [] });
  }
});

router.get('/pppoe', authenticate, async (_req, res) => {
  try {
    const conn = await getMikrotikConnection();
    const active = await conn.write('/ppp/active/print');
    res.json((active || []).map(a => ({
      id: a['.id'], name: a.name, address: a.address, uptime: a.uptime, 'caller-id': a['caller-id'], service: a.service
    })));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

const RANGE_MAP = {
  '3m': { seconds: 180, bucket: 10 },
  '30m': { seconds: 1800, bucket: 30 },
  '1h': { seconds: 3600, bucket: 60 },
  '1d': { seconds: 86400, bucket: 300 },
  '1w': { seconds: 604800, bucket: 1800 },
  '1m': { seconds: 2592000, bucket: 7200 }
};

router.post('/traffic/save', authenticate, async (req, res) => {
  const { interface: iface, rx, tx } = req.body;
  if (!iface) return res.status(400).json({ error: 'Interface is required' });
  // Explicit Node-side timestamp (UTC) — single source of truth, immune to MySQL session TZ drift
  await db.insert('INSERT INTO traffic_history (interface, rx, tx, sampled_at) VALUES (?, ?, ?, ?)', [iface, rx || 0, tx || 0, new Date()]);
  res.json({ ok: true, sampled_at: new Date().toISOString() });
});

router.get('/traffic/history/:interface', authenticate, async (req, res) => {
  const { interface: iface } = req.params;
  const range = RANGE_MAP[req.query.range] || RANGE_MAP['3m'];
  // Use UNIX_TIMESTAMP for the WHERE filter so we never depend on MySQL session TZ
  // (works regardless of how `sampled_at` was inserted)
  const sinceUnix = Math.floor((Date.now() - range.seconds * 1000) / 1000);
  const rows = await db.all(
    `SELECT ROUND(UNIX_TIMESTAMP(sampled_at) / ?) * ? as time_bucket, AVG(rx) as rx, AVG(tx) as tx FROM traffic_history WHERE interface = ? AND UNIX_TIMESTAMP(sampled_at) >= ? GROUP BY time_bucket ORDER BY time_bucket ASC`,
    [range.bucket, range.bucket, iface, sinceUnix]
  );
  res.json(rows.map(r => {
    const ms = Number(r.time_bucket) * 1000;
    return {
      time: Number(r.time_bucket),       // unix seconds (kept for backwards compat with frontend)
      ms,                                  // explicit ms-since-epoch
      iso: new Date(ms).toISOString(),    // absolute UTC ISO string
      rx: Math.round(r.rx),
      tx: Math.round(r.tx)
    };
  }));
});

// ── Background traffic polling ────────────────────────────────────────
// Samples every running interface @ 60s and writes to traffic_history,
// independent of the dashboard being open. Without this, range buttons
// (3m/30m/1h/1d/1w/1m) show empty data for any interface the user has
// never opened.

const POLL_INTERVAL_MS = 60_000;
let trafficPollTimer = null;
let trafficPollInflight = false;

async function pollAllInterfaces() {
  if (trafficPollInflight) return; // skip if previous tick still running
  trafficPollInflight = true;
  try {
    const config = await db.get('SELECT * FROM mikrotik_settings WHERE is_active = 1 ORDER BY id DESC LIMIT 1');
    if (!config || !config.host) return; // not configured yet

    const conn = await getMikrotikConnection();
    const ifaces = await conn.write('/interface/print');
    const running = (ifaces || []).filter(i => i.running === 'true' && i.disabled !== 'true');

    const now = new Date();
    for (const iface of running) {
      try {
        const traffic = await conn.write('/interface/monitor-traffic', [`=interface=${iface.name}`, '=once=']);
        const row = traffic?.[0] || {};
        const rx = parseInt(row['rx-bits-per-second']) || 0;
        const tx = parseInt(row['tx-bits-per-second']) || 0;
        await db.insert(
          'INSERT INTO traffic_history (interface, rx, tx, sampled_at) VALUES (?, ?, ?, ?)',
          [iface.name, rx, tx, now]
        );
      } catch (e) {
        console.warn(`[Traffic Poll] sample ${iface.name} failed:`, e.message);
      }
    }
  } catch (e) {
    // Most common: Mikrotik unreachable. Don't spam — log once per tick.
    console.warn('[Traffic Poll] tick error:', e.message);
  } finally {
    trafficPollInflight = false;
  }
}

export async function startTrafficPolling() {
  if (trafficPollTimer) return;
  console.log(`[Traffic Poll] starting — sampling running interfaces every ${POLL_INTERVAL_MS / 1000}s`);
  // Fire immediately (don't wait 60s for the first sample)
  pollAllInterfaces().catch(() => {});
  trafficPollTimer = setInterval(() => pollAllInterfaces().catch(() => {}), POLL_INTERVAL_MS);
}

export function stopTrafficPolling() {
  if (trafficPollTimer) {
    clearInterval(trafficPollTimer);
    trafficPollTimer = null;
  }
}

export default router;
