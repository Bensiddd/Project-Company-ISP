import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HiServer, HiRefresh, HiCog, HiX, HiGlobe, HiUserGroup, HiClipboardList, HiShieldCheck, HiExclamationCircle } from 'react-icons/hi';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { mikrotikAPI } from '../../services/api';
import './MikrotikMonitor.css';

const RANGES = ['3m', '30m', '1h', '1d', '1w', '1m'];
const POLL_INTERVAL = 60000;

function formatBits(bps) {
  if (!bps || bps === 0) return '0 Mbps';
  const mbps = bps / 1000000;
  return mbps.toFixed(mbps < 10 ? 2 : 1) + ' Mbps';
}

function formatChartTime(ts, range) {
  const d = new Date(ts);
  if (['1d', '1w', '1m'].includes(range)) {
    return d.toLocaleDateString('id-ID', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
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
  const [trafficLoading, setTrafficLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [trafficError, setTrafficError] = useState(null);
  const [pppoePage, setPppoePage] = useState(1);
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState({ host: '', username: '', password: '', port: 8728 });
  const [saving, setSaving] = useState(false);
  const PER_PAGE = 10;
  const liveRef = useRef({ rx: 0, tx: 0 });
  const saveSampleRef = useRef(async () => {});

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
      setSettings({ host: data.host || '', username: data.username || '', password: data.password || '', port: data.port || 8728 });
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

  // Save live sample ref — always points to latest selectedIface
  useEffect(() => {
    saveSampleRef.current = async () => {
      if (!selectedIface) return;
      setTrafficError(null);
      setTrafficLoading(true);
      try {
        const { data } = await mikrotikAPI.getTraffic(selectedIface);
        if (data?.rx !== undefined) {
          liveRef.current = { rx: data.rx, tx: data.tx };
          mikrotikAPI.saveTraffic(selectedIface, data.rx, data.tx).catch(() => {});
        }
      } catch (e) {
        setTrafficError(e.response?.data?.error || e.message || 'Request failed');
      } finally { setTrafficLoading(false); }
    };
  }, [selectedIface]);

  // Save sample interval (every 60s)
  useEffect(() => {
    if (!selectedIface) return;
    const id = setInterval(() => saveSampleRef.current(), POLL_INTERVAL);
    saveSampleRef.current();
    return () => clearInterval(id);
  }, [selectedIface]);

  // Fetch history when range or interface changes
  useEffect(() => {
    if (!selectedIface) return;
    setTrafficHistory([]);
    setTrafficError(null);
    fetchHistory();
  }, [selectedIface, timeRange, fetchHistory]);

  // Periodically refresh history (every 60s)
  useEffect(() => {
    if (!selectedIface) return;
    const id = setInterval(fetchHistory, POLL_INTERVAL);
    return () => clearInterval(id);
  }, [selectedIface, timeRange, fetchHistory]);

  const reloadAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchStatus(), fetchInterfaces(), fetchLogs(), fetchPppoe(), fetchSettings()]);
    setLoading(false);
  }, [fetchStatus, fetchInterfaces, fetchLogs, fetchPppoe, fetchSettings]);

  useEffect(() => { reloadAll(); }, []);

  // Auto-refresh logs every 30s
  useEffect(() => {
    const id = setInterval(fetchLogs, 30000);
    return () => clearInterval(id);
  }, [fetchLogs]);

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      const { data } = await mikrotikAPI.saveSettings(settings);
      setSettings({ host: data.host, username: data.username, password: '', port: data.port });
      setShowSettings(false);
      setTimeout(reloadAll, 500);
    } catch (e) { alert('Gagal menyimpan: ' + (e.response?.data?.message || e.message)); }
    finally { setSaving(false); }
  };

  const currentRx = liveRef.current.rx;
  const currentTx = liveRef.current.tx;
  const peakRx = trafficHistory.length > 0 ? Math.max(...trafficHistory.map(t => t.rx)) : 0;
  const peakTx = trafficHistory.length > 0 ? Math.max(...trafficHistory.map(t => t.tx)) : 0;
  const lowestRx = trafficHistory.length > 0 ? Math.min(...trafficHistory.map(t => t.rx)) : 0;
  const lowestTx = trafficHistory.length > 0 ? Math.min(...trafficHistory.map(t => t.tx)) : 0;
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
          <button className="btn btn-primary" onClick={() => { mikrotikAPI.getSettings().then(({data}) => setSettings({ host: data.host || '', username: data.username || '', password: '', port: data.port || 8728 })); setShowSettings(true); }}>
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
          <div className="monitor-stat-label">Peak ({timeRange})</div>
          <div className="monitor-stat-value" style={{ color: '#f59e0b' }}>{formatBits(peakRx)} <span style={{ fontSize: 14, fontWeight: 400, color: 'var(--text-muted)' }}>/ {formatBits(peakTx)}</span></div>
          <div className="monitor-stat-sub">RX / TX</div>
        </div>
        <div className="monitor-stat-card" style={{ borderLeft: '3px solid #10b981' }}>
          <div className="monitor-stat-label">Lowest ({timeRange})</div>
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
          <span style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
            {trafficLoading ? <span className="monitor-status-dot connected" style={{ animation: 'pulse 1s infinite' }} /> : null}
            Sampling every 60s
            {lastUpdate && <span>· {lastUpdate.toLocaleTimeString()}</span>}
          </span>
        </div>

        <div className="range-buttons">
          {RANGES.map(r => (
            <button key={r} className={`range-btn ${timeRange === r ? 'active' : ''}`} onClick={() => setTimeRange(r)}>
              {r}
            </button>
          ))}
        </div>

        {trafficError && (
          <div style={{ padding: '8px 12px', marginBottom: 12, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, fontSize: 13, color: '#ef4444' }}>
            <HiExclamationCircle style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6 }} />{trafficError}
          </div>
        )}
        {selectedIface ? (
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={trafficHistory.length > 0 ? trafficHistory : [{ time: '—', rx: 0, tx: 0 }]} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="rxGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} /><stop offset="95%" stopColor="#6366f1" stopOpacity={0} /></linearGradient>
                <linearGradient id="txGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={0.3} /><stop offset="95%" stopColor="#10b981" stopOpacity={0} /></linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="time" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} tickFormatter={v => typeof v === 'number' ? formatChartTime(v * 1000, timeRange) : v} />
              <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} tickFormatter={v => v ? (v / 1000000).toFixed(v > 100000000 ? 0 : 1) + 'M' : '0'} />
              <Tooltip content={(props) => {
                if (!props.active || !props.payload?.length) return null;
                const ts = typeof props.label === 'number' ? formatChartTime(props.label * 1000, timeRange) : props.label;
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
              <Area type="monotone" dataKey="rx" name="RX" stroke="#6366f1" fill="url(#rxGrad)" strokeWidth={2} dot={false} animationDuration={300} />
              <Area type="monotone" dataKey="tx" name="TX" stroke="#10b981" fill="url(#txGrad)" strokeWidth={2} dot={false} animationDuration={300} />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
            <HiServer size={40} style={{ opacity: 0.2, marginBottom: 8 }} />
            <p>Select an interface to start monitoring traffic</p>
          </div>
        )}
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
                <div className="form-group"><label>Password</label><input type="password" className="form-control" value={settings.password} onChange={e => setSettings({...settings, password: e.target.value})} placeholder="Router password" required /></div>
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
