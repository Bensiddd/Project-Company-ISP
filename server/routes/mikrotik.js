import { Router } from 'express';
import { RouterOSAPI } from 'node-routeros';
import db from '../db.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

function encodePassword(pw) {
  return Buffer.from(pw || '').toString('base64');
}

function decodePassword(enc) {
  try {
    return Buffer.from(enc || '', 'base64').toString('utf-8');
  } catch { return ''; }
}

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
  const config = db.get('SELECT * FROM mikrotik_settings ORDER BY id DESC LIMIT 1');
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
      const pw = decodePassword(config.password);
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

router.get('/settings', authenticate, (_req, res) => {
  const row = db.get('SELECT * FROM mikrotik_settings ORDER BY id DESC LIMIT 1');
  if (row) {
    row.password = decodePassword(row.password);
    res.json(row);
  } else {
    res.json({ host: '', username: '', password: '', port: 8728, is_active: 0 });
  }
});

router.post('/settings', authenticate, async (req, res) => {
  const { host, username, password, port } = req.body;
  const encoded = encodePassword(password);
  const existing = db.get('SELECT id FROM mikrotik_settings ORDER BY id DESC LIMIT 1');
  if (existing) {
    db.run('UPDATE mikrotik_settings SET host=?, username=?, password=?, port=?, is_active=1, updated_at=CURRENT_TIMESTAMP WHERE id=?', [host || '', username || '', encoded, port || 8728, existing.id]);
  } else {
    db.insert('INSERT INTO mikrotik_settings (host, username, password, port, is_active) VALUES (?, ?, ?, ?, 1)', [host || '', username || '', encoded, port || 8728]);
  }
  await closeMikrotikConn();
  const row = db.get('SELECT * FROM mikrotik_settings ORDER BY id DESC LIMIT 1');
  row.password = '';
  res.json(row);
});

router.get('/status', authenticate, async (_req, res) => {
  try {
    const conn = await getMikrotikConnection();
    const identity = await conn.write('/system/identity/print');
    const config = db.get('SELECT host FROM mikrotik_settings ORDER BY id DESC LIMIT 1');
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

router.post('/traffic/save', authenticate, (req, res) => {
  const { interface: iface, rx, tx } = req.body;
  if (!iface) return res.status(400).json({ error: 'Interface is required' });
  db.insert('INSERT INTO traffic_history (interface, rx, tx) VALUES (?, ?, ?)', [iface, rx || 0, tx || 0]);
  res.json({ ok: true });
});

router.get('/traffic/history/:interface', authenticate, (req, res) => {
  const { interface: iface } = req.params;
  const range = RANGE_MAP[req.query.range] || RANGE_MAP['3m'];
  const since = new Date(Date.now() - range.seconds * 1000).toISOString().replace('T', ' ').split('.')[0];
  const rows = db.all(
    `SELECT ROUND((strftime('%s', sampled_at) / ?) * ?) as time_bucket, AVG(rx) as rx, AVG(tx) as tx FROM traffic_history WHERE interface = ? AND sampled_at >= ? GROUP BY time_bucket ORDER BY time_bucket ASC`,
    [range.bucket, range.bucket, iface, since]
  );
  res.json(rows.map(r => ({
    time: r.time_bucket,
    rx: Math.round(r.rx),
    tx: Math.round(r.tx)
  })));
});

export default router;
