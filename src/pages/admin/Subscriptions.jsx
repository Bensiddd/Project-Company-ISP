import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import FormModal from '../../components/FormModal';
import {
  HiRefresh, HiPlus, HiEye, HiBan, HiCheckCircle,
  HiX, HiCalendar, HiUser, HiChip, HiStop,
  HiExclamationCircle, HiClock, HiPlay
} from 'react-icons/hi';
import { subscriptionsAPI, clientsAPI, servicePackagesAPI } from '../../services/api';
import './Billing.css';

const formatIDR = (num) => `Rp${Number(num || 0).toLocaleString('id-ID')}`;
const SUBS_STATUS = [
  { value: '', label: 'All' },
  { value: 'active', label: 'Active', cls: 'active' },
  { value: 'suspended', label: 'Suspended', cls: 'suspended' },
  { value: 'terminated', label: 'Terminated', cls: 'terminated' },
];

const initialForm = {
  client_id: '', package_id: '', price: '',
  billing_cycle: 'monthly', start_date: '',
};

const Subscriptions = () => {
  const [subscriptions, setSubscriptions] = useState([]);
  const [clients, setClients] = useState([]);
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showDetail, setShowDetail] = useState(null);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [saving, setSaving] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [confirmAction, setConfirmAction] = useState(null);

  const fetchSubscriptions = useCallback(async () => {
    try {
      const params = {};
      if (statusFilter) params.status = statusFilter;
      const { data } = await subscriptionsAPI.getAll(params);
      setSubscriptions(Array.isArray(data) ? data : (data.subscriptions || []));
    } catch (err) { console.error('Failed fetch subscriptions:', err); }
    finally { setLoading(false); }
  }, [statusFilter]);

  const fetchRefs = async () => {
    try {
      const [cRes, pRes] = await Promise.all([
        clientsAPI.getAll().catch(() => ({ data: [] })),
        servicePackagesAPI.getAll().catch(() => ({ data: [] }))
      ]);
      setClients(Array.isArray(cRes.data) ? cRes.data : []);
      setPackages(Array.isArray(pRes.data) ? pRes.data : []);
    } catch (e) { console.error(e); }
  };

  useEffect(() => { fetchSubscriptions(); }, [fetchSubscriptions]);
  useEffect(() => { fetchRefs(); }, []);

  const getClientName = (id) => {
    const c = clients.find(cl => cl.id === id);
    return c ? c.name || c.full_name || c.nama || `Client #${id}` : `Client #${id}`;
  };
  const getClientInitial = (id) => getClientName(id).charAt(0).toUpperCase();

  const getPackageName = (id) => {
    const p = packages.find(pk => pk.id === id);
    return p ? p.name : `Package #${id}`;
  };

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const payload = { ...form, price: parseFloat(form.price) || 0 };
      if (editing) {
        const { data } = await subscriptionsAPI.update(editing.id, payload);
        setSubscriptions(prev => prev.map(s => s.id === editing.id ? data : s));
      } else {
        const { data } = await subscriptionsAPI.create(payload);
        setSubscriptions(prev => [...prev, data]);
      }
      setShowForm(false); setEditing(null); setForm(initialForm);
    } catch (e) { console.error(e); } finally { setSaving(false); }
  };

  const handleStatusAction = async (id, action, reason = '') => {
    try {
      let res;
      if (action === 'suspend') res = await subscriptionsAPI.suspend(id);
      else if (action === 'activate') res = await subscriptionsAPI.activate(id);
      else if (action === 'terminate') res = await subscriptionsAPI.terminate(id, reason);
      if (res && res.data) {
        setSubscriptions(prev => prev.map(s => s.id === id ? res.data : s));
      } else {
        fetchSubscriptions();
      }
      setConfirmAction(null);
    } catch (e) { console.error(e); }
  };

  const filtered = subscriptions.filter(s => {
    if (statusFilter && s.status !== statusFilter) return false;
    return true;
  });

  const activeSubs = subscriptions.filter(s => s.status === 'active').length;
  const suspendedSubs = subscriptions.filter(s => s.status === 'suspended').length;

  if (loading) {
    return (
      <div>
        <div className="billing-header"><h1>Subscriptions</h1></div>
        <div className="data-table-skeleton">{[1,2,3].map(i => <div key={i} className="skeleton-row"><div className="skeleton-bar" style={{ height: 120 }} /></div>)}</div>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className="billing-header">
        <div>
          <h1>Subscriptions <span className="billing-count">({subscriptions.length})</span></h1>
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Manage client service subscriptions</span>
        </div>
        <button className="btn btn-primary" onClick={() => { setEditing(null); setForm(initialForm); setShowForm(true); }}>
          <HiPlus /> New Subscription
        </button>
      </div>

      {/* Stats */}
      <div className="billing-stats">
        <div className="billing-stat-card">
          <div className="billing-stat-label">Total Subscriptions</div>
          <div className="billing-stat-value">{subscriptions.length}</div>
        </div>
        <div className="billing-stat-card">
          <div className="billing-stat-label">Active</div>
          <div className="billing-stat-value" style={{ color: 'var(--success)' }}>{activeSubs}</div>
        </div>
        <div className="billing-stat-card">
          <div className="billing-stat-label">Suspended</div>
          <div className="billing-stat-value" style={{ color: 'var(--warning)' }}>{suspendedSubs}</div>
        </div>
        <div className="billing-stat-card">
          <div className="billing-stat-label">Monthly Recurring</div>
          <div className="billing-stat-value" style={{ color: 'var(--primary-light)', fontSize: 18 }}>
            {formatIDR(subscriptions.filter(s => s.status === 'active').reduce((sum, s) => sum + parseFloat(s.price || 0), 0))}
          </div>
          <div className="billing-stat-sub">MRR</div>
        </div>
      </div>

      {/* Filter */}
      <div className="billing-filters">
        <select className="form-control" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ width: 160 }}>
          {SUBS_STATUS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{filtered.length} of {subscriptions.length}</span>
      </div>

      {/* Card Grid */}
      <div className="sub-grid">
        {filtered.length === 0 && (
          <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>
            No subscriptions found
          </div>
        )}
        {filtered.map((sub, i) => (
          <motion.div key={sub.id} className="sub-card"
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <div className="sub-card-top">
              <div className="sub-card-client">{getClientName(sub.client_id)}</div>
              <span className={`billing-badge ${sub.status || 'active'}`}>{(sub.status || 'active').toUpperCase()}</span>
            </div>
            <div className="sub-card-package">
              <HiChip size={14} style={{ marginRight: 4 }} />
              {getPackageName(sub.package_id)}
            </div>
            <div className="sub-card-meta">
              <span><HiCalendar size={12} /> {sub.start_date ? new Date(sub.start_date).toLocaleDateString('id-ID') : '-'}</span>
              <span><HiClock size={12} /> {sub.billing_cycle || 'monthly'}</span>
              <span className="billing-amount">{formatIDR(sub.price || 0)}</span>
            </div>
            {sub.next_billing_date && (
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
                Next billing: {new Date(sub.next_billing_date).toLocaleDateString('id-ID')}
              </div>
            )}
            <div className="sub-card-actions">
              <button className="btn btn-ghost btn-sm" onClick={() => setShowDetail(sub)} title="View Detail">
                <HiEye size={14} /> Detail
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => {
                setEditing(sub);
                setForm({
                  client_id: sub.client_id, package_id: sub.package_id,
                  price: sub.price, billing_cycle: sub.billing_cycle || 'monthly',
                  start_date: sub.start_date ? sub.start_date.split('T')[0] : '',
                });
                setShowForm(true);
              }} title="Edit">Edit</button>
              {sub.status === 'active' && (
                <button className="btn btn-ghost btn-sm" style={{ color: 'var(--warning)' }}
                  onClick={() => setConfirmAction({ id: sub.id, action: 'suspend', label: 'suspend', client: getClientName(sub.client_id) })}>
                  <HiStop size={14} /> Suspend
                </button>
              )}
              {sub.status === 'suspended' && (
                <button className="btn btn-ghost btn-sm" style={{ color: 'var(--success)' }}
                  onClick={() => handleStatusAction(sub.id, 'activate')}>
                  <HiPlay size={14} /> Activate
                </button>
              )}
              {(sub.status === 'active' || sub.status === 'suspended') && (
                <button className="btn btn-ghost btn-sm" style={{ color: 'var(--error)' }}
                  onClick={() => setConfirmAction({ id: sub.id, action: 'terminate', label: 'terminate', client: getClientName(sub.client_id) })}>
                  <HiBan size={14} /> Terminate
                </button>
              )}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Detail Modal */}
      <AnimatePresence>
        {showDetail && (
          <motion.div className="form-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setShowDetail(null)}>
            <motion.div className="form-container" style={{ maxWidth: 540 }}
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              onClick={e => e.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px 0' }}>
                <h2 style={{ margin: 0, fontSize: 18, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <HiChip style={{ color: 'var(--primary-light)' }} />
                  Subscription #{showDetail.id}
                </h2>
                <button className="btn btn-ghost btn-sm" onClick={() => setShowDetail(null)}><HiX size={18} /></button>
              </div>
              <div style={{ padding: '12px 24px 24px' }}>
                <div className="billing-detail-grid">
                  <div className="billing-detail-item">
                    <span className="billing-detail-label">Client</span>
                    <span className="billing-detail-value" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div className="billing-client-avatar" style={{ width: 24, height: 24, fontSize: 10 }}>
                        {getClientInitial(showDetail.client_id)}
                      </div>
                      {getClientName(showDetail.client_id)}
                    </span>
                  </div>
                  <div className="billing-detail-item">
                    <span className="billing-detail-label">Package</span>
                    <span className="billing-detail-value">{getPackageName(showDetail.package_id)}</span>
                  </div>
                  <div className="billing-detail-item">
                    <span className="billing-detail-label">Status</span>
                    <span className={`billing-badge ${showDetail.status || 'active'}`}>{(showDetail.status || 'active').toUpperCase()}</span>
                  </div>
                  <div className="billing-detail-item">
                    <span className="billing-detail-label">Billing Cycle</span>
                    <span className="billing-detail-value">{showDetail.billing_cycle || 'monthly'}</span>
                  </div>
                  <div className="billing-detail-item">
                    <span className="billing-detail-label">Price</span>
                    <span className="billing-detail-value billing-amount">{formatIDR(showDetail.price || 0)}</span>
                  </div>
                  <div className="billing-detail-item">
                    <span className="billing-detail-label">Start Date</span>
                    <span className="billing-detail-value">{showDetail.start_date ? new Date(showDetail.start_date).toLocaleDateString('id-ID') : '-'}</span>
                  </div>
                  {showDetail.next_billing_date && (
                    <div className="billing-detail-item">
                      <span className="billing-detail-label">Next Billing</span>
                      <span className="billing-detail-value">{new Date(showDetail.next_billing_date).toLocaleDateString('id-ID')}</span>
                    </div>
                  )}
                  <div className="billing-detail-item">
                    <span className="billing-detail-label">Suspended At</span>
                    <span className="billing-detail-value">{showDetail.suspended_at ? new Date(showDetail.suspended_at).toLocaleDateString('id-ID') : '-'}</span>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Create/Edit Form */}
      <FormModal isOpen={showForm} onClose={() => { setShowForm(false); setEditing(null); setForm(initialForm); }}
        title={editing ? 'Edit Subscription' : 'New Subscription'} onSubmit={handleSubmit} loading={saving}>
        <div className="form-row">
          <div className="form-group">
            <label>Client</label>
            <select className="form-control" value={form.client_id} onChange={e => setForm({...form, client_id: e.target.value})} required>
              <option value="">-- Select Client --</option>
              {clients.map(c => (
                <option key={c.id} value={c.id}>{c.name || c.full_name || c.nama || `Client #${c.id}`}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Package</label>
            <select className="form-control" value={form.package_id} onChange={e => {
              const pkg = packages.find(p => p.id === parseInt(e.target.value));
              setForm({...form, package_id: e.target.value, price: pkg ? pkg.price : form.price});
            }} required>
              <option value="">-- Select Package --</option>
              {packages.map(p => (
                <option key={p.id} value={p.id}>{p.name} — {formatIDR(p.price)}/{p.type}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>Price (Rp)</label>
            <input type="number" className="form-control" value={form.price} onChange={e => setForm({...form, price: e.target.value})} required />
          </div>
          <div className="form-group">
            <label>Billing Cycle</label>
            <select className="form-control" value={form.billing_cycle} onChange={e => setForm({...form, billing_cycle: e.target.value})}>
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="yearly">Yearly</option>
            </select>
          </div>
        </div>
        <div className="form-group">
          <label>Start Date</label>
          <input type="date" className="form-control" value={form.start_date} onChange={e => setForm({...form, start_date: e.target.value})} required />
        </div>
      </FormModal>

      {/* Confirm Action Dialog */}
      <AnimatePresence>
        {confirmAction && (
          <motion.div className="form-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="confirm-dialog" initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}>
              <div className="confirm-header">
                <HiExclamationCircle size={24} style={{ color: confirmAction.action === 'activate' ? 'var(--success)' : 'var(--warning)' }} />
                <h3>Confirm {confirmAction.action === 'activate' ? 'Activate' : capitalize(confirmAction.action)}</h3>
              </div>
              <p>
                Are you sure you want to <strong>{confirmAction.label}</strong> subscription for <strong>{confirmAction.client}</strong>?
                {confirmAction.action === 'terminate' && ' This action cannot be undone.'}
              </p>
              {confirmAction.action === 'terminate' && (
                <div className="form-group">
                  <label>Termination Reason</label>
                  <input type="text" className="form-control" id="terminate_reason" placeholder="e.g. Customer request, non-payment..." />
                </div>
              )}
              <div className="confirm-actions">
                <button className="btn btn-secondary" onClick={() => setConfirmAction(null)}>Cancel</button>
                <button className={`btn ${confirmAction.action === 'activate' ? 'btn-primary' : 'btn-danger'}`}
                  onClick={() => {
                    const reason = document.getElementById('terminate_reason')?.value || '';
                    handleStatusAction(confirmAction.id, confirmAction.action, reason);
                  }}>
                  Yes, {confirmAction.label}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);

export default Subscriptions;
