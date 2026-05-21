import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HiServer, HiRefresh, HiCog, HiX, HiGlobe, HiUserGroup, HiClipboardList, HiShieldCheck, HiExclamationCircle } from 'react-icons/hi';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { mikrotikAPI } from '../../services/api';
import './MikrotikMonitor.css';

const RANGES = ['3m', '30m', '1h', '1d', '1w', '1m'];
const HISTORY_POLL_MS = 60000;   // history refresh (matches backend cron interval)
const LIVE_POLL_MS = 10000;      // live current-traffic refresh (just the stat card + chart edge)

// Window length per range (in seconds) — used to lock the chart's X-axis domain to [now-window, now]
// so that the axis is always visually consistent with which range button is active, even if data
// is sparse or just starting to accumulate.
const RANGE_SECONDS = {
  '3m':  180,
  '30m': 1800,
  '1h':  3600,
  '1d':  86400,
  '1w':  604800,
  '1m':  2592000
};

const RANGE_LABEL = {
  '3m':  '3 menit',
  '30m': '30 menit',
  '1h':  '1 jam',
  '1d':  '1 hari',
  '1w':  '1 minggu',
  '1m':  '1 bulan'
};

function formatBits(bps) {
  if (!bps || bps === 0) return '0 Mbps';
  const mbps = bps / 1000000;
  return mbps.toFixed(mbps < 10 ? 2 : 1) + ' Mbps';
}

// Tick label per range — kept short so axis isn't crowded:
//   3m / 30m   →  HH:MM:SS  (seconds matter)
//   1h          →  HH:MM
//   1d          →  HH:MM
//   1w / 1m    →  DD MMM
function formatChartTime(ms, range) {
  const d = new Date(ms);
  if (range === '1w' || range === '1m') {
    return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
  }
  if (range === '1d' || range === '1h') {
    return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

// Tooltip uses full date+time always (less ambiguous when hovering).
function formatTooltipTime(ms) {
  return new Date(ms).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function formatAbsoluteTime(isoOrMs) {
  if (!isoOrMs) return '—';
  const d = (typeof isoOrMs === 'string') ? new Date(isoOrMs) : new Date(isoOrMs);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

const MikrotikMonitor = () => {
  const [status, setStatus] = useState(null);
  const [interfaces, setInterfaces] = useState([]);
  const [selectedIface, setSelectedIface] = useState('');
  const [timeRange, setTimeRange] = useState('3m');
  const [trafficHistory, setTrafficHistory] = useState([]);
  const [logs, setLogs] = useState([]);
  const [logsError, setLogsError] = useState(null);
  const [pppoe, setPppoe] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [trafficError, setTrafficError] = useState(null);
  const [pppoePage, setPppoePage] = useState(1);
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState({ host: '', username: '', password: '', passwordMask: '', port: 8728 });
  const [saving, setSaving] = useState(false);
  const [liveCurrent, setLiveCurrent] = useState({ rx: 0, tx: 0, ts: null });
  const PER_PAGE = 10;
  const livePollRef = useRef(async () => {});

  const fetchStatus = useCallback(async () => {
    try {
      const { data } = await mikrotikAPI.getStatus();
      setStatus(data);
    } catch { setStatus({ connected: false, error: 'Request failed' }); }
  }, []);

  const fetchInterfaces = useCallback(async () => {
    try {
      const { data } = await mikrotikAPI.getInterfaces();
      if (Array.isArray(data)) setInterfaces(data);
    } catch { /* ignore */ }
  }, []);

  const fetchLogs = useCallback(async () => {
    try {
      const { data } = await mikrotikAPI.getLogs();
      if (data?.error) { setLogsError(data.error); return; }
      if (data?.logs) { setLogs(data.logs); setLogsError(null); }
    } catch (e) { setLogsError(e.response?.data?.error || e.message || 'Request failed'); }
  }, []);

  const fetchPppoe = useCallback(async () => {
    try {
      const { data } = await mikrotikAPI.getPppoe();
      if (Array.isArray(data)) setPppoe(data);
    } catch { /* ignore */ }
  }, []);

  const fetchSettings = useCallback(async () => {
    try {
      const { data } = await mikrotikAPI.getSettings();
      setSettings({ host: data.host || '', username: data.username || '', password: '', passwordMask: data.password || '', port: data.port || 8728 });
    } catch { /* ignore */ }
  }, []);

  const fetchHistory = useCallback(async () => {
    if (!selectedIface) return;
    try {
      const { data } = await mikrotikAPI.getTrafficHistory(selectedIface, timeRange);
      if (Array.isArray(data)) {
        setTrafficHistory(data);
        setLastUpdate(new Date());
      }
    } catch (e) {
      setTrafficError(e.response?.data?.error || e.message || 'Failed to fetch history');
    }
  }, [selectedIface, timeRange]);

  // Live polling (10s) — updates the Current Traffic stat + chart edge marker.
  // Backend cron handles persistence to traffic_history, so no save call here.
  useEffect(() => {
    livePollRef.current = async () => {
      if (!selectedIface) return;
      try {
        const { data } = await mikrotikAPI.getTraffic(selectedIface);
        if (data?.rx !== undefined) {
          setLiveCurrent({ rx: data.rx, tx: data.tx, ts: Date.now() });
          setTrafficError(null);
        }
      } catch (e) {
        setTrafficError(e.response?.data?.error || e.message || 'Request failed');
      }
    };
  }, [selectedIface]);

  // Live current poller — runs every 10s while an interface is selected
  useEffect(() => {
    if (!selectedIface) {
      setLiveCurrent({ rx: 0, tx: 0, ts: null });
      return;
    }
    livePollRef.current();
    const id = setInterval(() => livePollRef.current(), LIVE_POLL_MS);
    return () => clearInterval(id);
  }, [selectedIface]);

  // Fetch history immediately when range or interface changes
  useEffect(() => {
    if (!selectedIface) return;
    setTrafficHistory([]);
    setTrafficError(null);
    fetchHistory();
  }, [selectedIface, timeRange, fetchHistory]);

  // Periodically refresh history (every 60s, matches backend cron cadence)
  useEffect(() => {
    if (!selectedIface) return;
    const id = setInterval(fetchHistory, HISTORY_POLL_MS);
    return () => clearInterval(id);
  }, [selectedIface, timeRange, fetchHistory]);

  const reloadAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchStatus(), fetchInterfaces(), fetchLogs(), fetchPppoe(), fetchSettings()]);
    setLoading(false);
  }, [fetchStatus, fetchInterfaces, fetchLogs, fetchPppoe, fetchSettings]);

  useEffect(() => { reloadAll(); }, []);

  // Auto-select the first running interface so the chart works out of the box
  useEffect(() => {
    if (!selectedIface && interfaces.length > 0) {
      const running = interfaces.find(i => i.running) || interfaces[0];
      if (running) setSelectedIface(running.name);
    }
  }, [interfaces, selectedIface]);

  // Auto-refresh logs every 30s
  useEffect(() => {
    const id = setInterval(fetchLogs, 30000);
    return () => clearInterval(id);
  }, [fetchLogs]);

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      // Omit empty password so backend preserves the existing stored value
      const payload = { ...settings };
      if (!payload.password) delete payload.password;
      delete payload.passwordMask;
      const { data } = await mikrotikAPI.saveSettings(payload);
      setSettings({ host: data.host, username: data.username, password: '', passwordMask: settings.passwordMask, port: data.port });
      setShowSettings(false);
      setTimeout(reloadAll, 500);
    } catch (e) { alert('Gagal menyimpan: ' + (e.response?.data?.message || e.message)); }
    finally { setSaving(false); }
  };

  const currentRx = liveCurrent.rx;
  const currentTx = liveCurrent.tx;

  // Build chart data: history buckets + live edge point (when newer than last bucket).
  // Every point MUST carry `ms` because the X-axis is type="number" scale="time".
  const chartData = (() => {
    if (trafficHistory.length === 0 && liveCurrent.ts) {
      const t = Math.floor(liveCurrent.ts / 1000);
      return [{ time: t, ms: liveCurrent.ts, iso: new Date(liveCurrent.ts).toISOString(), rx: currentRx, tx: currentTx }];
    }
    if (trafficHistory.length > 0 && liveCurrent.ts) {
      const lastBucket = trafficHistory[trafficHistory.length - 1];
      const liveSec = Math.floor(liveCurrent.ts / 1000);
      if (liveSec > Number(lastBucket.time)) {
        return [
          ...trafficHistory,
          { time: liveSec, ms: liveCurrent.ts, iso: new Date(liveCurrent.ts).toISOString(), rx: currentRx, tx: currentTx, live: true }
        ];
      }
    }
    return trafficHistory;
  })();

  // X-axis domain locked to the selected range button: [now - window, now]. This keeps the chart
  // visually consistent with the active range, even if data is sparse or just starting to accumulate.
  // We anchor `now` to the latest refresh (lastUpdate || liveCurrent.ts || Date.now()) so the axis
  // doesn't jitter on every render.
  const nowAnchor = (lastUpdate?.getTime?.() || liveCurrent.ts || Date.now());
  const rangeMs = RANGE_SECONDS[timeRange] * 1000;
  const xAxisDomain = [nowAnchor - rangeMs, nowAnchor];

  // Generate ~6 evenly spaced ticks across the range so labels never overcrowd.
  const xAxisTicks = (() => {
    const N = 6;
    const step = rangeMs / (N - 1);
    const ticks = [];
    for (let i = 0; i < N; i++) ticks.push(Math.round(xAxisDomain[0] + step * i));
    return ticks;
  })();

  const stats = chartData.length > 0 ? chartData : [];
  const peakRx = stats.length > 0 ? Math.max(...stats.map(t => t.rx)) : 0;
  const peakTx = stats.length > 0 ? Math.max(...stats.map(t => t.tx)) : 0;
  const lowestRx = stats.length > 0 ? Math.min(...stats.map(t => t.rx)) : 0;
  const lowestTx = stats.length > 0 ? Math.min(...stats.map(t => t.tx)) : 0;
  const totalPppoePages = Math.ceil(pppoe.length / PER_PAGE) || 1;
  const pagedPppoe = pppoe.slice((pppoePage - 1) * PER_PAGE, pppoePage * PER_PAGE);

  useEffect(() => { setPppoePage(1); }, [pppoe]);

  if (loading) {
    return (
      <div>
        <div className="data-table-header"><h1>Network Monitor</h1></div>
        <div className="data-table-skeleton">{[1,2,3].map(i => <div key={i} className="skeleton-row"><div className="skeleton-bar" style={{ height: 160 }} /></div>)}</div>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className="monitor-header">
        <div className="monitor-status">
          <HiServer size={22} style={{ color: 'var(--primary)', opacity: 0.7 }} />
          <h1 style={{ margin: 0, fontSize: 22 }}>Network Monitor</h1>
          {status && (
            <div className="monitor-status">
              <span className={`monitor-status-dot ${status.connected ? 'connected' : 'disconnected'}`} />
              <span className={`monitor-status-text ${status.connected ? 'connected' : 'disconnected'}`}>
                {status.connected ? `Connected - ${status.identity || ''}` : 'Disconnected'}
              </span>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary" onClick={reloadAll}><HiRefresh /> Refresh</button>
          <button className="btn btn-primary" onClick={() => { mikrotikAPI.getSettings().then(({data}) => setSettings({ host: data.host || '', username: data.username || '', password: '', passwordMask: data.password || '', port: data.port || 8728 })); setShowSettings(true); }}>
            <HiCog /> Settings
          </button>
        </div>
      </div>

      <div className="monitor-grid">
        <div className="monitor-stat-card" style={{ borderLeft: '3px solid #6366f1' }}>
          <div className="monitor-stat-label">Current Traffic</div>
          <div className="monitor-stat-value" style={{ color: '#6366f1' }}>{formatBits(currentRx)} <span style={{ fontSize: 14, fontWeight: 400, color: 'var(--text-muted)' }}>/ {formatBits(currentTx)}</span></div>
          <div className="monitor-stat-sub">RX / TX · live</div>
        </div>
        <div className="monitor-stat-card" style={{ borderLeft: '3px solid #f59e0b' }}>
          <div className="monitor-stat-label">Peak ({RANGE_LABEL[timeRange]})</div>
          <div className="monitor-stat-value" style={{ color: '#f59e0b' }}>{formatBits(peakRx)} <span style={{ fontSize: 14, fontWeight: 400, color: 'var(--text-muted)' }}>/ {formatBits(peakTx)}</span></div>
          <div className="monitor-stat-sub">RX / TX</div>
        </div>
        <div className="monitor-stat-card" style={{ borderLeft: '3px solid #10b981' }}>
          <div className="monitor-stat-label">Lowest ({RANGE_LABEL[timeRange]})</div>
          <div className="monitor-stat-value" style={{ color: '#10b981' }}>{formatBits(lowestRx)} <span style={{ fontSize: 14, fontWeight: 400, color: 'var(--text-muted)' }}>/ {formatBits(lowestTx)}</span></div>
          <div className="monitor-stat-sub">RX / TX</div>
        </div>
      </div>

      <div className="monitor-chart-wrap">
        <div className="monitor-interface-bar">
          <label style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)' }}>Interface</label>
          <select className="form-control" value={selectedIface} onChange={e => setSelectedIface(e.target.value)}>
            {interfaces.length === 0 && <option value="">— No interfaces —</option>}
            {interfaces.map(iface => (
              <option key={iface.name} value={iface.name}>{iface.name} {iface.running ? '(UP)' : '(DOWN)'}</option>
            ))}
          </select>
          <span style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span className="monitor-status-dot connected" style={{ animation: 'pulse 2s infinite' }} />
            Live · {Math.floor(LIVE_POLL_MS / 1000)}s
            {liveCurrent.ts && <span title="Waktu polling terakhir">· {formatAbsoluteTime(liveCurrent.ts)}</span>}
          </span>
        </div>

        <div className="range-buttons" role="tablist" aria-label="Rentang waktu chart">
          {RANGES.map(r => (
            <button
              key={r}
              type="button"
              role="tab"
              aria-selected={timeRange === r}
              className={`range-btn ${timeRange === r ? 'active' : ''}`}
              onClick={() => setTimeRange(r)}
              title={RANGE_LABEL[r]}
            >
              {RANGE_LABEL[r]}
            </button>
          ))}
        </div>

        {trafficError && (
          <div style={{ padding: '8px 12px', marginBottom: 12, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, fontSize: 13, color: '#ef4444' }}>
            <HiExclamationCircle style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6 }} />{trafficError}
          </div>
        )}
        {selectedIface && chartData.length === 0 && !trafficError && (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)', fontSize: 13 }}>
            <span className="monitor-status-dot connected" style={{ animation: 'pulse 1.5s infinite', display: 'inline-block', verticalAlign: 'middle', marginRight: 8 }} />
            Mengumpulkan data untuk <code>{selectedIface}</code> pada rentang <b>{RANGE_LABEL[timeRange]}</b>... data akan muncul setelah polling pertama.
          </div>
        )}
        {!selectedIface ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
            <HiServer size={40} style={{ opacity: 0.2, marginBottom: 8 }} />
            <p>Pilih interface untuk mulai monitoring traffic</p>
          </div>
        ) : chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="rxGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} /><stop offset="95%" stopColor="#6366f1" stopOpacity={0} /></linearGradient>
                <linearGradient id="txGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={0.3} /><stop offset="95%" stopColor="#10b981" stopOpacity={0} /></linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis
                dataKey="ms"
                type="number"
                scale="time"
                domain={xAxisDomain}
                ticks={xAxisTicks}
                tick={{ fontSize: 11, fill: '#64748b' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={v => formatChartTime(v, timeRange)}
                allowDataOverflow={false}
                minTickGap={20}
              />
              <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} tickFormatter={v => v ? (v / 1000000).toFixed(v > 100000000 ? 0 : 1) + 'M' : '0'} />
              <Tooltip content={(props) => {
                if (!props.active || !props.payload?.length) return null;
                const ts = typeof props.label === 'number' ? formatTooltipTime(props.label) : String(props.label);
                return (
                  <div style={{ background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: '12px 16px', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}>
                    <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 6 }}>{ts}</div>
                    {props.payload.map((p, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: p.color }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.color, display: 'inline-block' }} />
                        {p.name}: <strong>{formatBits(p.value)}</strong>
                      </div>
                    ))}
                  </div>
                );
              }} />
              <Area type="monotone" dataKey="rx" name="RX" stroke="#6366f1" fill="url(#rxGrad)" strokeWidth={2} dot={false} animationDuration={300} isAnimationActive={false} />
              <Area type="monotone" dataKey="tx" name="TX" stroke="#10b981" fill="url(#txGrad)" strokeWidth={2} dot={false} animationDuration={300} isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        ) : null}
      </div>

      <div className="monitor-table-wrap logs">
        <h3><HiClipboardList /> Logs</h3>
        {logsError && (
          <div style={{ padding: '8px 12px', marginBottom: 12, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, fontSize: 13, color: '#ef4444' }}>
            <HiExclamationCircle style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6 }} />{logsError}
          </div>
        )}
        <div className="monitor-table-wrap-inner">
          <table className="monitor-table">
            <thead><tr><th>Time</th><th>Topics</th><th>Message</th></tr></thead>
            <tbody>
              {logs.map((log, i) => (
                <tr key={log.id || i}>
                  <td style={{ whiteSpace: 'nowrap', fontSize: 12 }}>{log.time}</td>
                  <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{log.topics}</td>
                  <td style={{ maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis' }}>{log.message}</td>
                </tr>
              ))}
              {logs.length === 0 && <tr><td colSpan={3} style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)' }}>No logs</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div className="monitor-table-wrap">
        <h3><HiUserGroup /> Active PPPoE <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-muted)' }}>{pppoe.length} sessions</span></h3>
        <div className="monitor-table-wrap-inner">
          <table className="monitor-table">
            <thead><tr><th>Username</th><th>IP Address</th><th>Uptime</th><th>Caller ID</th></tr></thead>
            <tbody>
              {pagedPppoe.map((p, i) => (
                <tr key={p.id || i}>
                  <td style={{ fontWeight: 600 }}>{p.name}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{p.address}</td>
                  <td>{p.uptime}</td>
                  <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{p['caller-id'] || '-'}</td>
                </tr>
              ))}
              {pppoe.length === 0 && <tr><td colSpan={4} style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)' }}>No active PPPoE sessions</td></tr>}
            </tbody>
          </table>
        </div>
        {pppoe.length > PER_PAGE && (
          <div className="pagination-bar">
            <button className="btn btn-secondary btn-sm" disabled={pppoePage <= 1} onClick={() => setPppoePage(p => p - 1)}>« Prev</button>
            <span>Page {pppoePage} / {totalPppoePages}</span>
            <button className="btn btn-secondary btn-sm" disabled={pppoePage >= totalPppoePages} onClick={() => setPppoePage(p => p + 1)}>Next »</button>
          </div>
        )}
      </div>

      <AnimatePresence>
        {showSettings && (
          <motion.div className="form-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="form-container" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}>
              <div className="form-modal-header">
                <h2>Mikrotik Settings</h2>
                <button className="btn-icon" onClick={() => setShowSettings(false)}><HiX /></button>
              </div>
              <form onSubmit={e => { e.preventDefault(); handleSaveSettings(); }}>
                <div className="form-group"><label>Host / IP Address</label><input type="text" className="form-control" value={settings.host} onChange={e => setSettings({...settings, host: e.target.value})} placeholder="192.168.88.1" required /></div>
                <div className="form-group"><label>Port</label><input type="number" className="form-control" value={settings.port} onChange={e => setSettings({...settings, port: parseInt(e.target.value) || 8728})} placeholder="8728" /></div>
                <div className="form-group"><label>Username</label><input type="text" className="form-control" value={settings.username} onChange={e => setSettings({...settings, username: e.target.value})} placeholder="admin" required /></div>
                <div className="form-group">
                  <label>Password {settings.passwordMask && <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400 }}>(tersimpan: {settings.passwordMask} — kosongkan untuk mempertahankan)</span>}</label>
                  <input type="password" className="form-control" value={settings.password} onChange={e => setSettings({...settings, password: e.target.value})} placeholder={settings.passwordMask || 'Router password'} autoComplete="new-password" required={!settings.passwordMask} />
                </div>
                <div className="form-actions">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowSettings(false)} disabled={saving}>Cancel</button>
                  <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save & Connect'}</button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default MikrotikMonitor;
