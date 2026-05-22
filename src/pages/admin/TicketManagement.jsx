import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HiClipboardList, HiFilter, HiUser, HiTrash, HiCheck, HiClock, HiExclamation, HiX, HiIdentification, HiLocationMarker, HiPhone, HiMail } from 'react-icons/hi';
import { ticketsAPI, adminUsersAPI } from '../../services/api';
import './TicketManagement.css';

const typeLabels = { maintenance: 'Maintenance', upgrade: 'Upgrade Paket', installation: 'Instalasi', request: 'Request' };
const typeColors = { maintenance: '#f59e0b', upgrade: '#6366f1', installation: '#10b981', request: '#ef4444' };
const statusLabels = { open: 'Open', in_progress: 'In Progress', resolved: 'Resolved', closed: 'Closed' };
const priorityLabels = { low: 'Low', medium: 'Medium', high: 'High', checking: 'Checking' };
const priorityColors = { low: '#6b7280', medium: '#f59e0b', high: '#ef4444', checking: '#3b82f6' };

const INFO_ICONS = { nama: HiUser, 'id pelanggan': HiIdentification, alamat: HiLocationMarker, 'no hp': HiPhone, identitas: HiMail, lokasi: HiLocationMarker };

function parseTicketDescription(desc) {
  if (!desc) return { fields: [], keluhan: '' };
  const lines = desc.split('\n');
  const fields = [];
  let keluhan = '';
  let inKeluhan = false;
  for (const line of lines) {
    if (inKeluhan) { keluhan += (keluhan ? '\n' : '') + line; continue; }
    const trimmed = line.trim();
    const colonIdx = trimmed.indexOf(':');
    if (colonIdx > 0) {
      const key = trimmed.slice(0, colonIdx).trim().toLowerCase();
      const val = trimmed.slice(colonIdx + 1).trim();
      if (key === 'keluhan') { inKeluhan = true; if (val) keluhan = val; }
      else if (val && val !== '-') fields.push({ label: trimmed.slice(0, colonIdx).trim(), value: val, key });
    }
  }
  return { fields, keluhan };
}

const TicketManagement = () => {
  const [tickets, setTickets] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [expanded, setExpanded] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null);
  const currentUser = JSON.parse(localStorage.getItem('admin_user') || '{}');
  const isTeknisi = currentUser.role === 'teknisi';

  const fetchData = async () => {
    try {
      const [tRes, aRes] = await Promise.all([ticketsAPI.getAll(), adminUsersAPI.getAll()]);
      setTickets(tRes.data);
      setAdmins(aRes.data);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const handleAssign = async (id, assigned_to) => {
    try {
      const { data } = await ticketsAPI.update(id, { assigned_to });
      setTickets(prev => prev.map(t => t.id === id ? data : t));
    } catch (e) { console.error(e); }
  };

  const handleStatus = async (id, status) => {
    const ticket = tickets.find(t => t.id === id);
    if (status === 'closed') {
      setConfirmAction({ type: 'close', id, status, title: ticket?.title });
      return;
    }
    try {
      const { data } = await ticketsAPI.update(id, { status });
      setTickets(prev => prev.map(t => t.id === id ? data : t));
    } catch (e) { console.error(e); }
  };

  const handleDelete = async (id) => {
    const ticket = tickets.find(t => t.id === id);
    setConfirmAction({ type: 'delete', id, title: ticket?.title });
  };

  const handleDeleteAll = () => {
    setConfirmAction({ type: 'deleteAll' });
  };

  const executeConfirm = async () => {
    if (!confirmAction) return;
    const { type, id, status } = confirmAction;
    try {
      if (type === 'deleteAll') {
        await ticketsAPI.deleteAll();
        setTickets([]);
      } else if (type === 'delete') {
        await ticketsAPI.delete(id);
        setTickets(prev => prev.filter(t => t.id !== id));
        if (expanded === id) setExpanded(null);
      } else if (type === 'close') {
        const { data } = await ticketsAPI.update(id, { status });
        setTickets(prev => prev.map(t => t.id === id ? data : t));
      }
    } catch (e) { console.error(e); }
    setConfirmAction(null);
  };

  const handleExpand = (id) => {
    setExpanded(prev => prev === id ? null : id);
  };

  const filtered = tickets.filter(t => {
    if (filterType !== 'all' && t.type !== filterType) return false;
    if (filterType === 'all' && t.type === 'request') return false;
    if (filterStatus !== 'all' && t.status !== filterStatus) return false;
    return true;
  });

  if (loading) {
    return (
      <div>
        <div className="data-table-header"><h1>Ticketing</h1></div>
        <div className="data-table-skeleton">{[1,2,3].map(i => <div key={i} className="skeleton-row"><div className="skeleton-bar" style={{ height: 120 }} /></div>)}</div>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className="data-table-header">
        <div><h1>Ticketing</h1><span className="data-table-count">{tickets.length} tickets</span></div>
        {!isTeknisi && tickets.length > 0 && (
          <button className="btn btn-danger" onClick={handleDeleteAll}>🗑 Delete All</button>
        )}
      </div>

      <div className="ticket-filters">
        <HiFilter className="filter-icon" />
        <select className="form-control" value={filterType} onChange={e => setFilterType(e.target.value)}>
          <option value="all">All Types</option>
          <option value="maintenance">Maintenance</option>
          <option value="upgrade">Upgrade Paket</option>
          <option value="installation">Instalasi</option>
          <option value="request">Request</option>
        </select>
        <select className="form-control" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="all">All Status</option>
          <option value="open">Open</option>
          <option value="in_progress">In Progress</option>
          <option value="resolved">Resolved</option>
          <option value="closed">Closed</option>
        </select>
      </div>

      <div className="ticket-grid">
        {filtered.map((t, i) => (
          <motion.div key={t.id} className={`ticket-card ${t.status}`}
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
          >
            <div className="ticket-card-top">
              <span className="ticket-type-badge" style={{ background: typeColors[t.type] + '22', color: typeColors[t.type] }}>{typeLabels[t.type]}</span>
              <span className="ticket-priority-badge" style={{ background: priorityColors[t.priority] + '22', color: priorityColors[t.priority] }}>{priorityLabels[t.priority]}</span>
              <span className={`ticket-status-badge ${t.status}`}>{statusLabels[t.status]}</span>
              {t.source && t.source !== 'manual' && (
                <span className="ticket-source-badge" style={{ 
                  background: t.source === 'telegram' ? '#0088cc22' : '#25D36622', 
                  color: t.source === 'telegram' ? '#0088cc' : '#25D366',
                  fontSize: 11,
                  padding: '4px 8px',
                  borderRadius: 4,
                  fontWeight: 600
                }}>
                  {t.source === 'telegram' ? '✈️ Telegram' : '📱 WhatsApp'}
                </span>
              )}
            </div>
            <h3 className="ticket-card-title" onClick={() => handleExpand(t.id)}>{t.title}</h3>
            <div className="ticket-card-meta">
              <span><HiUser /> {t.customer_name || 'Anonymous'}</span>
              {t.whatsapp && <span>📱 {t.whatsapp}</span>}
              <span><HiClock /> {new Date(t.created_at).toLocaleDateString()}</span>
            </div>
            {t.assigned_name && <div className="ticket-card-assignee">Assigned to: {t.assigned_name}</div>}

            <AnimatePresence>
              {expanded === t.id && (() => {
                const { fields, keluhan } = parseTicketDescription(t.description);
                return (
                  <motion.div key={t.id} className="ticket-expanded" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                    {fields.length > 0 && (
                      <div className="ticket-info-grid">
                        {fields.map((f, fi) => {
                          const Icon = INFO_ICONS[f.key] || HiUser;
                          return (
                            <div key={fi} className="ticket-info-item">
                              <span className="ticket-info-label"><Icon /> {f.label}</span>
                              <span className="ticket-info-value">{f.value.split(/(https?:\/\/[^\s]+)/).map((part, i) => i % 2 === 1 ? <a key={i} href={part} target="_blank" rel="noopener noreferrer">{part}</a> : part)}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {keluhan && (
                      <div className="ticket-keluhan">
                        <div className="ticket-keluhan-header">📋 Keluhan</div>
                        <div className="ticket-keluhan-text">{keluhan.split(/(https?:\/\/[^\s]+)/).map((part, i) => i % 2 === 1 ? <a key={i} href={part} target="_blank" rel="noopener noreferrer">{part}</a> : part)}</div>
                      </div>
                    )}
                    {!fields.length && !keluhan && t.description && <div className="ticket-desc">{t.description.split(/(https?:\/\/[^\s]+)/).map((part, i) => i % 2 === 1 ? <a key={i} href={part} target="_blank" rel="noopener noreferrer">{part}</a> : part)}</div>}
                  </motion.div>
                );
              })()}
            </AnimatePresence>

            <div className="ticket-card-actions">
              {!isTeknisi && t.status !== 'closed' && (
                <select className="form-control form-control-sm" value={t.assigned_to || ''} onChange={e => handleAssign(t.id, e.target.value || null)}>
                  <option value="">Assign...</option>
                  {admins.map(a => <option key={a.id} value={a.id}>{a.full_name}</option>)}
                </select>
              )}
              <select className="form-control form-control-sm" value={t.status} onChange={e => handleStatus(t.id, e.target.value)} disabled={t.status === 'closed'}>
                <option value="open">Open</option>
                <option value="in_progress">In Progress</option>
                <option value="resolved">Resolved</option>
                {!isTeknisi && <option value="closed">Closed</option>}
              </select>
              {!isTeknisi && <button className="btn btn-danger btn-sm" onClick={() => handleDelete(t.id)}><HiTrash /></button>}
            </div>
          </motion.div>
        ))}
        {filtered.length === 0 && <div className="empty-state">No tickets found.</div>}
      </div>

      <AnimatePresence>
        {confirmAction && (
          <motion.div className="confirm-overlay"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          >
            <motion.div className="confirm-dialog"
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
            >
              <div className="confirm-header">
                <HiExclamation />
                <h3>{confirmAction.type === 'deleteAll' ? 'Hapus Semua Ticket' : confirmAction.type === 'delete' ? 'Hapus Ticket' : 'Tutup Ticket'}</h3>
              </div>
              <p>
                {confirmAction.type === 'deleteAll'
                  ? 'Yakin ingin menghapus SEMUA ticket? Tindakan ini tidak bisa dibatalkan!'
                  : confirmAction.type === 'delete'
                  ? `Yakin ingin menghapus ticket "${confirmAction.title}"?`
                  : `Yakin ingin menutup ticket "${confirmAction.title}"?`}
              </p>
              <div className="confirm-actions">
                <button className="btn btn-secondary" onClick={() => setConfirmAction(null)}>Batal</button>
                <button className={`btn ${confirmAction.type !== 'close' ? 'btn-danger' : 'btn-primary'}`} onClick={executeConfirm}>
                  {confirmAction.type === 'deleteAll' ? 'Ya, Hapus Semua' : confirmAction.type === 'delete' ? 'Ya, Hapus' : 'Ya, Tutup'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default TicketManagement;
