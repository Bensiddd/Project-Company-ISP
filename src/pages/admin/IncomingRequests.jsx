import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HiInbox, HiUser, HiMail, HiPhone, HiClock, HiCheck, HiX } from 'react-icons/hi';
import { ticketsAPI, adminUsersAPI } from '../../services/api';

const typeOptions = [
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'upgrade', label: 'Upgrade Paket' },
  { value: 'installation', label: 'Instalasi' }
];

const priorityOptions = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' }
];

const IncomingRequests = () => {
  const [requests, setRequests] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(null);
  const [form, setForm] = useState({ type: 'maintenance', priority: 'medium', assigned_to: '' });
  const [saving, setSaving] = useState(false);

  const fetchRequests = async () => {
    try {
      const { data } = await ticketsAPI.getAll();
      setRequests(data.filter(t => t.type === 'request'));
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  useEffect(() => {
    Promise.all([
      ticketsAPI.getAll(),
      adminUsersAPI.getAll()
    ]).then(([tRes, aRes]) => {
      setRequests(tRes.data.filter(t => t.type === 'request'));
      setAdmins(aRes.data);
    }).catch(e => console.error(e)).finally(() => setLoading(false));
  }, []);

  const openProcess = (req) => {
    setProcessing(req);
    setForm({ type: 'maintenance', priority: 'medium', assigned_to: String(req.assigned_to || '') });
  };

  const handleProcess = async () => {
    if (!processing) return;
    setSaving(true);
    try {
      await ticketsAPI.update(processing.id, {
        type: form.type,
        priority: form.priority,
        assigned_to: form.assigned_to || null
      });
      setRequests(prev => prev.filter(r => r.id !== processing.id));
      setProcessing(null);
    } catch (e) {
      alert('Gagal memproses request: ' + (e.response?.data?.message || e.message));
    } finally { setSaving(false); }
  };

  if (loading) {
    return (
      <div>
        <div className="data-table-header"><h1>Request Masuk</h1></div>
        <div className="data-table-skeleton">{[1,2,3].map(i => <div key={i} className="skeleton-row"><div className="skeleton-bar" style={{ height: 120 }} /></div>)}</div>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className="data-table-header">
        <div><h1>Request Masuk</h1><span className="data-table-count">{requests.length} request</span></div>
      </div>

      {requests.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
          <HiInbox style={{ fontSize: 48, marginBottom: 12, opacity: 0.3 }} />
          <h3 style={{ fontSize: 18, color: 'var(--text-secondary)', marginBottom: 8 }}>Tidak ada request masuk</h3>
          <p style={{ fontSize: 14 }}>Request dari form contact akan muncul di sini.</p>
        </div>
      ) : (
        <div className="ticket-grid">
          {requests.map((req, i) => (
            <motion.div key={req.id} className="ticket-card"
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            >
              <div className="ticket-card-top">
                <span className="ticket-type-badge" style={{ background: 'rgba(59,130,246,0.15)', color: '#3b82f6' }}>Request</span>
                <span className="ticket-priority-badge" style={{ background: 'rgba(59,130,246,0.15)', color: '#3b82f6' }}>Checking</span>
                <span className="ticket-status-badge open">Open</span>
              </div>

              <h3 className="ticket-card-title">{req.title}</h3>

              <div className="ticket-card-meta">
                <span><HiUser /> {req.customer_name || 'Anonymous'}</span>
                {req.whatsapp && <span><HiPhone /> {req.whatsapp}</span>}
                <span><HiClock /> {new Date(req.created_at + 'Z').toLocaleDateString()}</span>
              </div>

              {req.description && (
                <div className="ticket-desc" style={{ fontSize: 13, padding: 12, background: 'var(--bg-secondary)', borderRadius: 'var(--radius-lg)' }}>
                  {req.description}
                </div>
              )}

              <div className="ticket-card-actions" style={{ borderTop: '1px solid var(--border)', paddingTop: 12, marginTop: 4 }}>
                <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }} onClick={() => openProcess(req)}>
                  <HiCheck /> Proses
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <AnimatePresence>
        {processing && (
          <motion.div className="form-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="form-container" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}>
              <div className="form-modal-header">
                <h2>Proses Request Masuk</h2>
                <button className="btn-icon" onClick={() => setProcessing(null)}><HiX /></button>
              </div>
              <form onSubmit={e => { e.preventDefault(); handleProcess(); }}>
                <div style={{ padding: '0 24px 16px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius)', margin: '0 24px 20px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 12 }}>
                    <div style={{ fontSize: 13, color: 'var(--text-muted)' }}><HiUser style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6 }} />{processing.customer_name || 'Anonymous'}</div>
                    {processing.whatsapp && <div style={{ fontSize: 13, color: 'var(--text-muted)' }}><HiPhone style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6 }} />{processing.whatsapp}</div>}
                    <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4, padding: 8, background: 'var(--bg-elevated)', borderRadius: 'var(--radius-sm)' }}>
                      {processing.description}
                    </div>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Type</label>
                    <select className="form-control" value={form.type} onChange={e => setForm({...form, type: e.target.value})}>
                      {typeOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Priority</label>
                    <select className="form-control" value={form.priority} onChange={e => setForm({...form, priority: e.target.value})}>
                      {priorityOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label>Assign ke</label>
                  <select className="form-control" value={form.assigned_to} onChange={e => setForm({...form, assigned_to: e.target.value})}>
                    <option value="">Pilih Admin...</option>
                    {admins.map(a => <option key={a.id} value={a.id}>{a.full_name}</option>)}
                  </select>
                </div>

                <div className="form-actions">
                  <button type="button" className="btn btn-secondary" onClick={() => setProcessing(null)} disabled={saving}>Batal</button>
                  <button type="submit" className="btn btn-primary" disabled={saving}>
                    {saving ? 'Memproses...' : 'Proses'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default IncomingRequests;
