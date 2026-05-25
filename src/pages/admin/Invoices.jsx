import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import FormModal from '../../components/FormModal';
import {
  HiDocumentText, HiFilter, HiSearch, HiEye, HiDownload,
  HiX, HiBan, HiCurrencyDollar, HiPlus, HiPrinter,
  HiCalendar, HiUser, HiCheckCircle, HiExclamationCircle,
  HiRefresh, HiLightningBolt, HiTrash, HiOutlineTrash, HiLink, HiClipboardCopy
} from 'react-icons/hi';
import { invoicesAPI, clientsAPI, servicePackagesAPI } from '../../services/api';
import { useToast } from '../../components/Toast';
import './Billing.css';

const formatIDR = (num) => `Rp${Number(num || 0).toLocaleString('id-ID')}`;
const INV_STATUS = [
  { value: '', label: 'All Status' },
  { value: 'draft', label: 'Draft', cls: 'draft' },
  { value: 'unpaid', label: 'Unpaid', cls: 'unpaid' },
  { value: 'paid', label: 'Paid', cls: 'paid' },
  { value: 'overdue', label: 'Overdue', cls: 'overdue' },
  { value: 'cancelled', label: 'Cancelled', cls: 'cancelled' },
  { value: 'refunded', label: 'Refunded', cls: 'refunded' },
];
const PERIODS = [
  { value: '', label: 'All Period' },
  { value: 'this_month', label: 'This Month' },
  { value: 'last_month', label: 'Last Month' },
  { value: 'this_quarter', label: 'This Quarter' },
  { value: 'this_year', label: 'This Year' },
];

const initialForm = {
  client_id: '', subscription_id: '', due_date: '',
  items: [{ description: '', quantity: 1, unit_price: 0 }],
  notes: ''
};

const Invoices = () => {
  const [invoices, setInvoices] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showDetail, setShowDetail] = useState(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [saving, setSaving] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [periodFilter, setPeriodFilter] = useState('');
  const [search, setSearch] = useState('');
  const [stats, setStats] = useState({ total: 0, unpaid: 0, overdue: 0, paid: 0, revenue: 0 });
  const { showToast } = useToast();
  const [generating, setGenerating] = useState(false);
  const [confirmDel, setConfirmDel] = useState(null); // { id, single: true } or { single: false }

  const fetchInvoices = useCallback(async () => {
    try {
      const params = {};
      if (statusFilter) params.status = statusFilter;
      if (periodFilter) params.period = periodFilter;
      if (search) params.search = search;
      const { data } = await invoicesAPI.getAll(params);
      if (data.invoices) {
        setInvoices(data.invoices);
        setStats(data.stats || { total: data.invoices.length, unpaid: 0, overdue: 0, paid: 0, revenue: 0 });
      } else {
        setInvoices(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error('Failed fetch invoices:', err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, periodFilter, search]);

  const fetchClients = async () => {
    try {
      const { data } = await clientsAPI.getAll();
      setClients(Array.isArray(data) ? data : []);
    } catch (e) { console.error(e); }
  };

  useEffect(() => { fetchInvoices(); }, [fetchInvoices]);
  useEffect(() => { fetchClients(); }, []);

  const getClientName = (id) => {
    const c = clients.find(cl => cl.id === id);
    return c ? c.name || c.full_name || c.nama || `Client #${id}` : `Client #${id}`;
  };

  const getClientInitial = (id) => {
    const name = getClientName(id);
    return name.charAt(0).toUpperCase();
  };

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const payload = {
        ...form,
        items: form.items.filter(i => i.description.trim()),
        due_date: form.due_date || null
      };
      if (editing) {
        const { data } = await invoicesAPI.update ? await invoicesAPI.update(editing.id, payload) : { data: payload };
        setInvoices(prev => prev.map(s => s.id === editing.id ? data : s));
        showToast({ title: 'Invoice diperbarui.', type: 'success' });
      } else {
        const { data } = await invoicesAPI.create(payload);
        setInvoices(prev => [data, ...prev]);
        showToast({ title: 'Invoice berhasil dibuat.', type: 'success' });
      }
      setShowForm(false); setEditing(null); setForm(initialForm);
    } catch (e) {
      showToast({ title: 'Gagal simpan invoice', subtitle: e.response?.data?.message || e.message, type: 'error' });
    } finally { setSaving(false); }
  };

  const handleCancel = async (id) => {
    try {
      await invoicesAPI.cancel(id);
      setInvoices(prev => prev.map(inv => inv.id === id ? { ...inv, status: 'cancelled' } : inv));
    } catch (e) { console.error(e); }
  };

  const handleDownloadPdf = async (id) => {
    try {
      const res = await invoicesAPI.getPdf(id);
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url; a.download = `invoice-${id}.pdf`; a.click();
      window.URL.revokeObjectURL(url);
    } catch (e) { console.error(e); }
  };

  const handleCopyPaymentLink = async (token) => {
    const link = `${window.location.origin}/pay/${token}`;
    try {
      await navigator.clipboard.writeText(link);
      showToast({ title: 'Link pembayaran disalin!', type: 'success' });
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
      // Also try direct text selection feedback
      if (window.getSelection) {
        const selection = window.getSelection();
        selection.removeAllRanges();
      }
    } catch {
      // Fallback for older browsers / non-HTTPS
      const ta = document.createElement('textarea');
      ta.value = link;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      try {
        document.execCommand('copy');
        showToast({ title: 'Link pembayaran disalin!', type: 'success' });
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2000);
      } catch {
        showToast({ title: 'Gagal menyalin, buka manual: ' + link, type: 'error' });
      }
      document.body.removeChild(ta);
    }
  };

  const handleGenerateMonthly = async () => {
    setGenerating(true);
    try {
      const { data } = await invoicesAPI.generateMonthly();
      showToast({ title: data.message || `${data.generated} invoice dibuat.`, type: 'success' });
      fetchInvoices();
    } catch (e) {
      showToast({ title: 'Gagal generate invoice', subtitle: e.response?.data?.message || e.message, type: 'error' });
    } finally { setGenerating(false); }
  };

  const handleDelete = async (id) => {
    setConfirmDel({ id, single: true });
  };

  const executeDelete = async () => {
    if (!confirmDel) return;
    setConfirmDel(null);
    try {
      if (confirmDel.single) {
        await invoicesAPI.delete(confirmDel.id);
        setInvoices(prev => prev.filter(i => i.id !== confirmDel.id));
        showToast({ title: 'Invoice dihapus.', type: 'success' });
      } else {
        const { data } = await invoicesAPI.deleteAll();
        setInvoices([]);
        showToast({ title: data.message, type: 'success' });
      }
    } catch (e) { showToast({ title: 'Gagal hapus', subtitle: e.response?.data?.message || e.message, type: 'error' }); }
  };

  const handleDeleteAll = async () => {
    setConfirmDel({ single: false });
  };

  const filtered = invoices.filter(inv => {
    if (statusFilter && inv.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const cn = getClientName(inv.client_id).toLowerCase();
      const inum = (inv.invoice_number || '').toLowerCase();
      if (!cn.includes(q) && !inum.includes(q)) return false;
    }
    return true;
  });

  if (loading) {
    return (
      <div>
        <div className="billing-header"><h1>Invoices</h1></div>
        <div className="data-table-skeleton">{[1,2,3].map(i => <div key={i} className="skeleton-row"><div className="skeleton-bar" style={{ height: 80 }} /></div>)}</div>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      {/* Header */}
      <div className="billing-header">
        <div>
          <h1>Invoices <span className="billing-count">({invoices.length})</span></h1>
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Manage customer invoices & billing</span>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary btn-sm" onClick={handleGenerateMonthly} disabled={generating}
            title="Generate this month's invoices">
            <HiLightningBolt /> {generating ? 'Generating...' : 'Generate Monthly'}
          </button>
          <button className="btn btn-danger btn-sm" onClick={handleDeleteAll} title="Delete all invoices">
            <HiOutlineTrash /> Delete All
          </button>
          <button className="btn btn-primary" onClick={() => { setEditing(null); setForm(initialForm); setShowForm(true); }}>
            <HiPlus /> New Invoice
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="billing-stats">
        <div className="billing-stat-card">
          <div className="billing-stat-label">Total Revenue</div>
          <div className="billing-stat-value" style={{ color: 'var(--success)' }}>{formatIDR(stats.revenue || 0)}</div>
        </div>
        <div className="billing-stat-card">
          <div className="billing-stat-label">Unpaid</div>
          <div className="billing-stat-value" style={{ color: 'var(--warning)' }}>{stats.unpaid || 0}</div>
          <div className="billing-stat-sub">{formatIDR(stats.unpaid_amount || 0)} outstanding</div>
        </div>
        <div className="billing-stat-card">
          <div className="billing-stat-label">Overdue</div>
          <div className="billing-stat-value" style={{ color: 'var(--error)' }}>{stats.overdue || 0}</div>
        </div>
        <div className="billing-stat-card">
          <div className="billing-stat-label">Paid</div>
          <div className="billing-stat-value" style={{ color: 'var(--success)' }}>{stats.paid || 0}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="billing-filters">
        <HiFilter size={16} style={{ color: 'var(--text-muted)' }} />
        <select className="form-control" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ width: 150 }}>
          {INV_STATUS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <select className="form-control" value={periodFilter} onChange={e => setPeriodFilter(e.target.value)} style={{ width: 150 }}>
          {PERIODS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>
        <div style={{ position: 'relative', flex: 1, maxWidth: 280 }}>
          <HiSearch size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input className="form-control search-input" placeholder="Search client or invoice..." value={search}
            onChange={e => setSearch(e.target.value)} style={{ paddingLeft: 36 }} />
        </div>
      </div>

      {/* Table */}
      <div className="billing-table-wrap">
        <table className="billing-table">
          <thead>
            <tr>
              <th>Invoice</th>
              <th>Client</th>
              <th>Period</th>
              <th>Due Date</th>
              <th>Amount</th>
              <th>Status</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>No invoices found</td></tr>
            )}
            {filtered.map((inv, i) => (
              <motion.tr key={inv.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <HiDocumentText size={16} style={{ color: 'var(--primary-light)', opacity: 0.7 }} />
                    <span style={{ fontWeight: 700, fontFamily: 'var(--font-mono)', fontSize: 13 }}>
                      {inv.invoice_number || `INV-${inv.id}`}
                    </span>
                  </div>
                </td>
                <td>
                  <div className="billing-client-chip">
                    <div className="billing-client-avatar">{getClientInitial(inv.client_id)}</div>
                    {getClientName(inv.client_id)}
                  </div>
                </td>
                <td style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
                  {inv.period ? new Date(inv.period + '-01').toLocaleDateString('id-ID', { month: 'short', year: 'numeric' }) : '-'}
                </td>
                <td>
                  {inv.due_date ? (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13 }}>
                      <HiCalendar size={12} style={{ color: 'var(--text-muted)' }} />
                      {new Date(inv.due_date).toLocaleDateString('id-ID')}
                    </span>
                  ) : '-'}
                </td>
                <td>
                  <span className="billing-amount">{formatIDR(inv.total || inv.amount || 0)}</span>
                </td>
                <td>
                  <span className={`billing-badge ${inv.status || 'draft'}`}>
                    {(inv.status || 'draft').toUpperCase()}
                  </span>
                </td>
                <td style={{ textAlign: 'right' }}>
                  <div className="billing-actions" style={{ justifyContent: 'flex-end' }}>
                    <button className="btn btn-ghost btn-sm" title="View Detail" onClick={() => setShowDetail(inv)}>
                      <HiEye size={15} />
                    </button>
                    <button className="btn btn-ghost btn-sm" title="Download PDF" onClick={() => handleDownloadPdf(inv.id)}>
                      <HiDownload size={15} />
                    </button>
                    {(inv.status === 'draft' || inv.status === 'unpaid' || inv.status === 'overdue') && (
                      <button className="btn btn-ghost btn-sm" title="Cancel Invoice" onClick={() => handleCancel(inv.id)}>
                        <HiBan size={15} style={{ color: 'var(--error)' }} />
                      </button>
                    )}
                    <button className="btn btn-ghost btn-sm" title="Delete Invoice" onClick={() => handleDelete(inv.id)}>
                      <HiTrash size={15} style={{ color: 'var(--error)' }} />
                    </button>
                  </div>
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Detail Modal */}
      <AnimatePresence>
        {showDetail && (
          <motion.div className="form-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setShowDetail(null)}>
            <motion.div className="form-container" style={{ maxWidth: 640 }}
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              onClick={e => e.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px 0' }}>
                <h2 style={{ margin: 0, fontSize: 18, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <HiDocumentText style={{ color: 'var(--primary-light)' }} />
                  {showDetail.invoice_number || `Invoice #${showDetail.id}`}
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
                    <span className="billing-detail-label">Status</span>
                    <span className={`billing-badge ${showDetail.status || 'draft'}`}>
                      {(showDetail.status || 'draft').toUpperCase()}
                    </span>
                  </div>
                  <div className="billing-detail-item">
                    <span className="billing-detail-label">Period</span>
                    <span className="billing-detail-value">
                      {showDetail.period ? new Date(showDetail.period + '-01').toLocaleDateString('id-ID', { month: 'long', year: 'numeric' }) : '-'}
                    </span>
                  </div>
                  <div className="billing-detail-item">
                    <span className="billing-detail-label">Due Date</span>
                    <span className="billing-detail-value">
                      {showDetail.due_date ? new Date(showDetail.due_date).toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : '-'}
                    </span>
                  </div>
                  {showDetail.paid_at && (
                    <div className="billing-detail-item">
                      <span className="billing-detail-label">Paid At</span>
                      <span className="billing-detail-value">{new Date(showDetail.paid_at).toLocaleString('id-ID')}</span>
                    </div>
                  )}
                  <div className="billing-detail-item">
                    <span className="billing-detail-label">Total</span>
                    <span className="billing-detail-value billing-amount">
                      {formatIDR(showDetail.total || showDetail.amount || 0)}
                    </span>
                  </div>
                </div>

                {/* Items */}
                {(showDetail.items && showDetail.items.length > 0) && (
                  <>
                    <h4 style={{ fontSize: 14, marginBottom: 8, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 700 }}>
                      Invoice Items
                    </h4>
                    <table className="billing-items-table">
                      <thead>
                        <tr>
                          <th style={{ width: '50%' }}>Description</th>
                          <th style={{ textAlign: 'center' }}>Qty</th>
                          <th style={{ textAlign: 'right' }}>Unit Price</th>
                          <th style={{ textAlign: 'right' }}>Subtotal</th>
                        </tr>
                      </thead>
                      <tbody>
                        {showDetail.items.map((item, j) => (
                          <tr key={j}>
                            <td>{item.description}</td>
                            <td style={{ textAlign: 'center' }}>{item.quantity}</td>
                            <td style={{ textAlign: 'right' }}>{formatIDR(item.unit_price)}</td>
                            <td style={{ textAlign: 'right' }}>{formatIDR(item.quantity * item.unit_price)}</td>
                          </tr>
                        ))}
                        <tr className="billing-total-row">
                          <td colSpan={3} style={{ textAlign: 'right', fontWeight: 700 }}>Total</td>
                          <td style={{ textAlign: 'right' }}>{formatIDR(showDetail.total || showDetail.amount || 0)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </>
                )}

                {/* Actions in detail */}
                <div style={{ display: 'flex', gap: 10, marginTop: 20, flexWrap: 'wrap' }}>
                  {showDetail.payment_token && (
                    copiedLink ? (
                      <button className="btn btn-secondary btn-sm"
                        style={{ color: 'var(--success)', cursor: 'default' }}>
                        <HiCheckCircle /> Link Disalin
                      </button>
                    ) : (
                      <button className="btn btn-secondary btn-sm"
                        onClick={() => handleCopyPaymentLink(showDetail.payment_token)}
                        style={{ color: 'var(--primary-light)' }}>
                        <HiLink /> Copy Payment Link
                      </button>
                    )
                  )}
                  <button className="btn btn-secondary btn-sm" onClick={() => handleDownloadPdf(showDetail.id)}>
                    <HiDownload /> Download PDF
                  </button>
                  {(showDetail.status === 'unpaid' || showDetail.status === 'overdue') && (
                    <button className="btn btn-secondary btn-sm" onClick={() => handleCancel(showDetail.id)}>
                      <HiBan /> Cancel Invoice
                    </button>
                  )}
                  {showDetail.status === 'unpaid' && (
                    <button className="btn btn-primary btn-sm"
                      onClick={() => window.open(`/admin/payments?invoice_id=${showDetail.id}`, '_self')}>
                      <HiCurrencyDollar /> Record Payment
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Create/Edit Modal */}
      <FormModal isOpen={showForm} onClose={() => { setShowForm(false); setEditing(null); setForm(initialForm); }}
        title={editing ? 'Edit Invoice' : 'Create Invoice'} onSubmit={handleSubmit} loading={saving}>
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
            <label>Due Date</label>
            <input type="date" className="form-control" value={form.due_date} onChange={e => setForm({...form, due_date: e.target.value})} />
          </div>
        </div>

        <h4 style={{ fontSize: 14, margin: '16px 0 8px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Invoice Items
        </h4>
        {form.items.map((item, j) => (
          <div key={j} className="form-row" style={{ marginBottom: 8, alignItems: 'flex-end' }}>
            <div className="form-group" style={{ flex: 2 }}>
              {j === 0 && <label>Description</label>}
              <input className="form-control" placeholder="Service description..." value={item.description}
                onChange={e => {
                  const items = [...form.items];
                  items[j] = {...items[j], description: e.target.value};
                  setForm({...form, items});
                }} />
            </div>
            <div className="form-group" style={{ flex: 0.5 }}>
              {j === 0 && <label>Qty</label>}
              <input type="number" className="form-control" min="1" value={item.quantity}
                onChange={e => {
                  const items = [...form.items];
                  items[j] = {...items[j], quantity: parseInt(e.target.value) || 1};
                  setForm({...form, items});
                }} />
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              {j === 0 && <label>Price (Rp)</label>}
              <input type="number" className="form-control" min="0" value={item.unit_price}
                onChange={e => {
                  const items = [...form.items];
                  items[j] = {...items[j], unit_price: parseFloat(e.target.value) || 0};
                  setForm({...form, items});
                }} />
            </div>
            {form.items.length > 1 && (
              <button className="btn btn-ghost btn-sm" style={{ marginBottom: j === 0 ? 20 : 0, padding: '8px' }}
                onClick={() => setForm({...form, items: form.items.filter((_, idx) => idx !== j)})}>
                <HiX size={14} style={{ color: 'var(--error)' }} />
              </button>
            )}
          </div>
        ))}
        <button className="btn btn-ghost btn-sm" onClick={() => setForm({...form, items: [...form.items, { description: '', quantity: 1, unit_price: 0 }]})}>
          <HiPlus size={12} /> Add Item
        </button>

        <div className="form-group" style={{ marginTop: 16 }}>
          <label>Notes (optional)</label>
          <textarea className="form-control" rows="2" value={form.notes} placeholder="Internal notes..."
            onChange={e => setForm({...form, notes: e.target.value})} />
        </div>
      </FormModal>

      {/* Confirm Delete Dialog */}
      <AnimatePresence>
        {confirmDel && (
          <motion.div className="confirm-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setConfirmDel(null)}>
            <motion.div className="confirm-dialog" initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              onClick={e => e.stopPropagation()}>
              <div className="confirm-header danger">
                <HiExclamationCircle size={24} />
                <h3>{confirmDel.single ? 'Hapus Invoice' : 'Hapus Semua Invoice'}</h3>
              </div>
              <p>
                {confirmDel.single
                  ? 'Yakin ingin menghapus invoice ini? Data yang dihapus tidak bisa dikembalikan.'
                  : '⚠️ Yakin ingin menghapus SEMUA invoice? Seluruh data invoice akan hilang permanen dan tidak bisa dikembalikan.'}
              </p>
              <div className="confirm-actions">
                <button className="btn btn-secondary" onClick={() => setConfirmDel(null)}>Batal</button>
                <button className="btn btn-danger" onClick={executeDelete}>
                  Ya, Hapus
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default Invoices;
