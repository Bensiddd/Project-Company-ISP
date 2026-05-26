import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import FormModal from '../../components/FormModal';
import {
  HiCurrencyDollar, HiFilter, HiSearch, HiEye, HiX,
  HiCheckCircle, HiRefresh, HiCash, HiCreditCard,
  HiClock, HiExclamationCircle, HiExternalLink, HiTrash, HiOutlineTrash, HiBadgeCheck
} from 'react-icons/hi';
import { paymentsAPI, invoicesAPI } from '../../services/api';
import { useToast } from '../../components/Toast';
import './Billing.css';

const formatIDR = (num) => `Rp${Number(num || 0).toLocaleString('id-ID')}`;
const PAYMENT_STATUSES = [
  { value: '', label: 'All Status' },
  { value: 'pending', label: 'Pending', cls: 'pending' },
  { value: 'success', label: 'Success', cls: 'success' },
  { value: 'failed', label: 'Failed', cls: 'failed' },
  { value: 'expired', label: 'Expired', cls: 'expired' },
  { value: 'refunded', label: 'Refunded', cls: 'refunded' },
];
const PAYMENT_METHODS = [
  { value: '', label: 'All Methods' },
  { value: 'midtrans', label: 'Midtrans' },
  { value: 'manual_transfer', label: 'Manual Transfer' },
  { value: 'cash', label: 'Cash' },
];

const initialManualForm = {
  invoice_id: '', amount: '', payment_method: 'manual_transfer',
  bank_name: '', account_name: '', account_number: '', notes: '',
};

const Payments = () => {
  const [payments, setPayments] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showManualForm, setShowManualForm] = useState(false);
  const [showDetail, setShowDetail] = useState(null);
  const [form, setForm] = useState(initialManualForm);
  const [saving, setSaving] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [methodFilter, setMethodFilter] = useState('');
  const [search, setSearch] = useState('');
  const { showToast } = useToast();
  const [confirmDel, setConfirmDel] = useState(null);

  const fetchPayments = useCallback(async () => {
    try {
      const params = {};
      if (statusFilter) params.status = statusFilter;
      if (methodFilter) params.method = methodFilter;
      if (search) params.search = search;
      const { data } = await paymentsAPI.getAll(params);
      setPayments(Array.isArray(data) ? data : (data.payments || []));
    } catch (err) { console.error('Failed fetch payments:', err); }
    finally { setLoading(false); }
  }, [statusFilter, methodFilter, search]);

  const fetchInvoices = async () => {
    try {
      const { data } = await invoicesAPI.getAll({ limit: 200 });
      const list = Array.isArray(data) ? data : (data.invoices || []);
      setInvoices(list.filter(inv => inv.status === 'unpaid' || inv.status === 'overdue'));
    } catch (e) { console.error(e); }
  };

  useEffect(() => { fetchPayments(); }, [fetchPayments]);
  useEffect(() => { fetchInvoices(); }, []);

  const pollRef = useRef(null);
  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(() => fetchPayments(), 30_000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [fetchPayments]);

  const getInvNumber = (id) => {
    const inv = invoices.find(i => i.id === id) || payments.find(p => p.invoice_id === id);
    if (inv) return inv.invoice_number || `INV-${id}`;
    return `INV-${id}`;
  };

  const handleManualSubmit = async () => {
    setSaving(true);
    try {
      const payload = {
        invoice_id: parseInt(form.invoice_id),
        amount: parseFloat(form.amount),
        payment_method: form.payment_method,
        bank_name: form.bank_name,
        account_name: form.account_name,
        account_number: form.account_number,
        notes: form.notes,
      };
      const { data } = await paymentsAPI.manualPayment(payload);
      setPayments(prev => [data, ...prev]);
      setShowManualForm(false);
      setForm(initialManualForm);
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  const handleVerify = async (id) => {
    try {
      const { data } = await paymentsAPI.verify(id);
      setPayments(prev => prev.map(p => p.id === id ? data : p));
    } catch (e) { console.error(e); }
  };

  const handleMidtransCharge = async (invoiceId) => {
    try {
      const { data } = await paymentsAPI.midtransCharge(invoiceId, 'snap');
      if (data.redirect_url) {
        window.open(data.redirect_url, '_blank');
      }
    } catch (e) { console.error(e); }
  };

  const handleCheckMidtrans = async (id) => {
    try {
      const { data } = await paymentsAPI.checkMidtrans(id);
      setPayments(prev => prev.map(p => p.id === id ? data : p));
      if (data.status === 'success') {
        showToast({ title: 'Pembayaran berhasil.', type: 'success' });
      } else if (data.status === 'failed') {
        showToast({ title: 'Pembayaran gagal.', type: 'error' });
      } else {
        showToast({ title: `Status: ${data.status}`, subtitle: 'Coba lagi nanti.', type: 'info' });
      }
    } catch (e) {
      showToast({ title: 'Gagal mengecek', subtitle: e.response?.data?.message || e.message, type: 'error' });
    }
  };

  const handleDelete = async (id) => {
    setConfirmDel({ id, single: true });
  };

  const executeDelete = async () => {
    if (!confirmDel) return;
    setConfirmDel(null);
    try {
      if (confirmDel.single) {
        await paymentsAPI.delete(confirmDel.id);
        setPayments(prev => prev.filter(p => p.id !== confirmDel.id));
        showToast({ title: 'Payment dihapus.', type: 'success' });
      } else {
        const { data } = await paymentsAPI.deleteAll();
        setPayments([]);
        showToast({ title: data.message, type: 'success' });
      }
    } catch (e) { showToast({ title: 'Gagal hapus', subtitle: e.response?.data?.message || e.message, type: 'error' }); }
  };

  const handleDeleteAll = async () => {
    setConfirmDel({ single: false });
  };

  const getAmount = (p) => parseFloat(p.amount || p.gross_amount || 0);

  const totalCollected = payments
    .filter(p => p.status === 'success')
    .reduce((sum, p) => sum + getAmount(p), 0);
  const totalPending = payments
    .filter(p => p.status === 'pending')
    .reduce((sum, p) => sum + getAmount(p), 0);

  if (loading) {
    return (
      <div>
        <div className="billing-header"><h1>Payments</h1></div>
        <div className="data-table-skeleton">{[1,2,3].map(i => <div key={i} className="skeleton-row"><div className="skeleton-bar" style={{ height: 80 }} /></div>)}</div>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className="billing-header">
        <div>
          <h1>Payments <span className="billing-count">({payments.length})</span></h1>
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Track all payments — Midtrans & manual</span>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-danger btn-sm" onClick={handleDeleteAll} title="Delete all payments">
            <HiOutlineTrash /> Delete All
          </button>
          <button className="btn btn-primary" onClick={() => { setForm(initialManualForm); fetchInvoices(); setShowManualForm(true); }}>
            <HiCash /> Record Manual Payment
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="billing-stats">
        <div className="billing-stat-card">
          <div className="billing-stat-label">Total Collected</div>
          <div className="billing-stat-value" style={{ color: 'var(--success)' }}>{formatIDR(totalCollected)}</div>
        </div>
        <div className="billing-stat-card">
          <div className="billing-stat-label">Pending</div>
          <div className="billing-stat-value" style={{ color: 'var(--warning)' }}>{formatIDR(totalPending)}</div>
          <div className="billing-stat-sub">{payments.filter(p => p.status === 'pending').length} transactions</div>
        </div>
        <div className="billing-stat-card">
          <div className="billing-stat-label">Successful</div>
          <div className="billing-stat-value">{payments.filter(p => p.status === 'success').length}</div>
        </div>
        <div className="billing-stat-card">
          <div className="billing-stat-label">Failed</div>
          <div className="billing-stat-value" style={{ color: 'var(--error)' }}>{payments.filter(p => p.status === 'failed').length}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="billing-filters">
        <HiFilter size={16} style={{ color: 'var(--text-muted)' }} />
        <select className="form-control" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ width: 150 }}>
          {PAYMENT_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <select className="form-control" value={methodFilter} onChange={e => setMethodFilter(e.target.value)} style={{ width: 150 }}>
          {PAYMENT_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
        <div style={{ position: 'relative', flex: 1, maxWidth: 280 }}>
          <HiSearch size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input className="form-control search-input" placeholder="Search invoice or transaction..." value={search}
            onChange={e => setSearch(e.target.value)} style={{ paddingLeft: 36 }} />
        </div>
      </div>

      {/* Table */}
      <div className="billing-table-wrap">
        <table className="billing-table">
          <thead>
            <tr>
              <th>Transaction</th>
              <th>Invoice</th>
              <th>Method</th>
              <th>Amount</th>
              <th>Date</th>
              <th>Status</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {payments.length === 0 && (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>No payments yet</td></tr>
            )}
            {payments.map((p, i) => (
              <motion.tr key={p.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <HiCurrencyDollar size={16} style={{ color: p.status === 'success' ? 'var(--success)' : 'var(--text-muted)', opacity: 0.7 }} />
                    <span style={{ fontWeight: 600, fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                      {p.transaction_id || `TXN-${p.id}`}
                    </span>
                  </div>
                </td>
                <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                  {getInvNumber(p.invoice_id)}
                </td>
                <td>
                  <span className="payment-method-badge">
                    {(p.payment_method === 'midtrans' || p.payment_method === 'midtrans_snap') ? <HiCreditCard size={12} /> : <HiCash size={12} />}
                    {(p.payment_method === 'midtrans' || p.payment_method === 'midtrans_snap') ? 'Midtrans' : p.payment_method === 'manual_transfer' ? 'Transfer' : p.payment_method === 'cash' ? 'Cash' : p.payment_method || '-'}
                  </span>
                </td>
                <td><span className="billing-amount">{formatIDR(getAmount(p))}</span></td>
                <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <HiClock size={11} style={{ color: 'var(--text-muted)' }} />
                    {p.paid_at ? new Date(p.paid_at).toLocaleDateString('id-ID') :
                     p.created_at ? new Date(p.created_at).toLocaleDateString('id-ID') : '-'}
                  </span>
                </td>
                <td>
                  <span className={`billing-badge ${p.status || 'pending'}`}>
                    {(p.status || 'pending').toUpperCase()}
                  </span>
                </td>
                <td style={{ textAlign: 'right' }}>
                  <div className="billing-actions" style={{ justifyContent: 'flex-end' }}>
                    <button className="btn btn-ghost btn-sm" title="View Detail" onClick={() => setShowDetail(p)}>
                      <HiEye size={15} />
                    </button>
                    {p.status === 'pending' && (
                      <>
                        {(p.payment_method === 'midtrans_snap') && p.transaction_id && (
                          <button className="btn btn-ghost btn-sm" title="Sync Midtrans Status"
                            onClick={() => handleCheckMidtrans(p.id)}
                            style={{ color: 'var(--primary-light)' }}>
                            <HiRefresh size={15} />
                          </button>
                        )}
                        <button className="btn btn-ghost btn-sm" title="Verify Payment" onClick={() => handleVerify(p.id)}
                          style={{ color: 'var(--success)' }}>
                          <HiCheckCircle size={15} />
                        </button>
                        {(p.payment_method === 'midtrans' || p.payment_method === 'midtrans_snap') && p.invoice_id && (
                          <button className="btn btn-ghost btn-sm" title="Retry Midtrans" onClick={() => handleMidtransCharge(p.invoice_id)}
                            style={{ color: 'var(--primary-light)' }}>
                            <HiExternalLink size={15} />
                          </button>
                        )}
                      </>
                    )}
                    <button className="btn btn-ghost btn-sm" title="Delete Payment" onClick={() => handleDelete(p.id)}>
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
            <motion.div className="form-container" style={{ maxWidth: 560 }}
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              onClick={e => e.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px 0' }}>
                <h2 style={{ margin: 0, fontSize: 18, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <HiCurrencyDollar style={{ color: 'var(--primary-light)' }} />
                  Payment Detail
                </h2>
                <button className="btn btn-ghost btn-sm" onClick={() => setShowDetail(null)}><HiX size={18} /></button>
              </div>
              <div style={{ padding: '12px 24px 24px' }}>
                <div className="billing-detail-grid">
                  <div className="billing-detail-item">
                    <span className="billing-detail-label">Transaction ID</span>
                    <span className="billing-detail-value" style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}>
                      {showDetail.transaction_id || `TXN-${showDetail.id}`}
                    </span>
                  </div>
                  <div className="billing-detail-item">
                    <span className="billing-detail-label">Invoice</span>
                    <span className="billing-detail-value">{getInvNumber(showDetail.invoice_id)}</span>
                  </div>
                  <div className="billing-detail-item">
                    <span className="billing-detail-label">Amount</span>
                    <span className="billing-detail-value billing-amount">{formatIDR(getAmount(showDetail))}</span>
                  </div>
                  <div className="billing-detail-item">
                    <span className="billing-detail-label">Status</span>
                    <span className={`billing-badge ${showDetail.status || 'pending'}`}>
                      {(showDetail.status || 'pending').toUpperCase()}
                    </span>
                  </div>
                  <div className="billing-detail-item">
                    <span className="billing-detail-label">Method</span>
                    <span className="billing-detail-value">{showDetail.payment_method || '-'}</span>
                  </div>
                  <div className="billing-detail-item">
                    <span className="billing-detail-label">Date</span>
                    <span className="billing-detail-value">
                      {showDetail.paid_at ? new Date(showDetail.paid_at).toLocaleString('id-ID') :
                       showDetail.created_at ? new Date(showDetail.created_at).toLocaleString('id-ID') : '-'}
                    </span>
                  </div>
                  {showDetail.bank_name && (
                    <div className="billing-detail-item">
                      <span className="billing-detail-label">Bank</span>
                      <span className="billing-detail-value">{showDetail.bank_name}</span>
                    </div>
                  )}
                  {showDetail.account_name && (
                    <div className="billing-detail-item">
                      <span className="billing-detail-label">Account Name</span>
                      <span className="billing-detail-value">{showDetail.account_name}</span>
                    </div>
                  )}
                </div>

                {/* Raw Midtrans Response */}
                {showDetail.midtrans_response && (
                  <div style={{ marginTop: 16 }}>
                    <h4 style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Midtrans Response
                    </h4>
                    <div className="payment-detail-json">
                      {typeof showDetail.midtrans_response === 'object'
                        ? JSON.stringify(showDetail.midtrans_response, null, 2)
                        : showDetail.midtrans_response}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Manual Payment Form */}
      <FormModal isOpen={showManualForm} onClose={() => { setShowManualForm(false); setForm(initialManualForm); }}
        title="Record Manual Payment" onSubmit={handleManualSubmit} loading={saving}
        submitLabel="Record Payment">
        <div className="form-row">
          <div className="form-group">
            <label>Invoice</label>
            <select className="form-control" value={form.invoice_id}
              onChange={e => {
                const inv = invoices.find(i => i.id === parseInt(e.target.value));
                setForm({...form, invoice_id: e.target.value, amount: inv ? (inv.total || inv.amount || 0) : form.amount});
              }} required>
              <option value="">-- Select Invoice --</option>
              {invoices.map(inv => (
                <option key={inv.id} value={inv.id}>
                  {inv.invoice_number || `INV-${inv.id}`} — {formatIDR(inv.total || inv.amount || 0)} ({inv.status})
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Amount (Rp)</label>
            <input type="number" className="form-control" value={form.amount}
              onChange={e => setForm({...form, amount: e.target.value})} required />
          </div>
        </div>
        <div className="form-group">
          <label>Payment Method</label>
          <select className="form-control" value={form.payment_method}
            onChange={e => setForm({...form, payment_method: e.target.value})}>
            <option value="manual_transfer">Manual Transfer</option>
            <option value="cash">Cash</option>
          </select>
        </div>
        {form.payment_method === 'manual_transfer' && (
          <div className="form-row">
            <div className="form-group">
              <label>Bank Name</label>
              <input type="text" className="form-control" value={form.bank_name}
                onChange={e => setForm({...form, bank_name: e.target.value})} placeholder="e.g. BCA, Mandiri" />
            </div>
            <div className="form-group">
              <label>Account Number</label>
              <input type="text" className="form-control" value={form.account_number}
                onChange={e => setForm({...form, account_number: e.target.value})} />
            </div>
          </div>
        )}
        <div className="form-group">
          <label>Account Name (optional)</label>
          <input type="text" className="form-control" value={form.account_name}
            onChange={e => setForm({...form, account_name: e.target.value})} placeholder="Sender name" />
        </div>
        <div className="form-group">
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
                <h3>{confirmDel.single ? 'Hapus Payment' : 'Hapus Semua Payment'}</h3>
              </div>
              <p>
                {confirmDel.single
                  ? 'Yakin ingin menghapus payment ini? Data yang dihapus tidak bisa dikembalikan.'
                  : '⚠️ Yakin ingin menghapus SEMUA payment? Seluruh data akan hilang permanen dan tidak bisa dikembalikan.'}
              </p>
              <div className="confirm-actions">
                <button className="btn btn-secondary" onClick={() => setConfirmDel(null)}>Batal</button>
                <button className="btn btn-danger" onClick={executeDelete}>Ya, Hapus</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default Payments;
