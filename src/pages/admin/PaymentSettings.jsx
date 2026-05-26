import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  HiCog, HiShieldCheck, HiCurrencyDollar, HiRefresh,
  HiCheckCircle, HiExclamationCircle, HiExternalLink,
  HiSave, HiEye, HiEyeOff
} from 'react-icons/hi';
import { paymentSettingsAPI } from '../../services/api';
import { useToast } from '../../components/Toast';
import './Billing.css';

const parseMaybeJson = (value, fallback) => {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    try { return JSON.parse(value); } catch { return fallback; }
  }
  return fallback;
};

const PaymentSettings = () => {
  const { showToast } = useToast();
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testLoading, setTestLoading] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [showKeys, setShowKeys] = useState({});
  const [form, setForm] = useState({
    is_sandbox: true,
    merchant_id: '',
    client_key: '',
    server_key: '',
    payment_channels: ['gopay', 'bank_transfer', 'credit_card'],
    invoice_prefix: 'INV',
    payment_due_days: 14,
    bank_accounts: [{ bank: 'BCA', account_number: '', account_name: '' }],
  });

  const fetchSettings = async () => {
    try {
      const { data } = await paymentSettingsAPI.get();
      if (data) {
        setSettings(data);
        setForm({
          is_sandbox: data.is_sandbox !== undefined ? Boolean(Number(data.is_sandbox)) : true,
          merchant_id: data.merchant_id || '',
          client_key: data.client_key || '',
          server_key: data.server_key || '',
          payment_channels: parseMaybeJson(data.payment_channels, ['gopay', 'bank_transfer', 'credit_card']),
          invoice_prefix: data.invoice_prefix || 'INV',
          payment_due_days: data.payment_due_days || 14,
          bank_accounts: parseMaybeJson(data.bank_accounts, [{ bank: 'BCA', account_number: '', account_name: '' }]),
        });
      }
    } catch (err) { console.error('Failed fetch payment settings:', err); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchSettings(); }, []);

  const toggleShowKey = (key) => {
    setShowKeys(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const maskKey = (val) => {
    if (!val || val.length < 8) return val;
    return val.slice(0, 4) + '••••••••••' + val.slice(-4);
  };

  const handleBankChange = (idx, field, value) => {
    const banks = [...form.bank_accounts];
    banks[idx] = { ...banks[idx], [field]: value };
    setForm({ ...form, bank_accounts: banks });
  };

  const addBank = () => {
    setForm({ ...form, bank_accounts: [...form.bank_accounts, { bank: 'BCA', account_number: '', account_name: '' }] });
  };

  const removeBank = (idx) => {
    if (form.bank_accounts.length <= 1) return;
    setForm({ ...form, bank_accounts: form.bank_accounts.filter((_, i) => i !== idx) });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data } = await paymentSettingsAPI.update(form);
      setSettings(data);
      showToast({ title: 'Payment settings tersimpan.', type: 'success' });
    } catch (e) {
      showToast({ title: 'Gagal simpan settings', subtitle: e.response?.data?.message || e.message, type: 'error' });
    }
    finally { setSaving(false); }
  };

  const handleTest = async () => {
    setTestLoading(true);
    setTestResult(null);
    try {
      const { data } = await paymentSettingsAPI.test({ server_key: form.server_key, is_sandbox: form.is_sandbox });
      // Backend now always returns 200 with success field
      setTestResult({ success: data.success !== false, message: data.message || 'Koneksi Midtrans berhasil.' });
    } catch (e) {
      // Network/axios error (not auth error since backend returns 200)
      setTestResult({ success: false, message: 'Gagal menghubungi server. Coba lagi.' });
    }
    finally { setTestLoading(false); }
  };

  const CHANNELS = [
    { value: 'gopay', label: 'GoPay', group: 'E-Wallet' },
    { value: 'shopeepay', label: 'ShopeePay', group: 'E-Wallet' },
    { value: 'qris', label: 'QRIS', group: 'E-Wallet' },
    { value: 'credit_card', label: 'Credit Card (Visa/MC/JCB)', group: 'Card' },
    { value: 'bank_transfer', label: 'Bank Transfer (All Banks)', group: 'Bank Transfer' },
    { value: 'bca_va', label: 'BCA Virtual Account', group: 'Bank Transfer' },
    { value: 'bni_va', label: 'BNI Virtual Account', group: 'Bank Transfer' },
    { value: 'bri_va', label: 'BRI Virtual Account', group: 'Bank Transfer' },
    { value: 'mandiri_va', label: 'Mandiri Bill', group: 'Bank Transfer' },
    { value: 'permata_va', label: 'Permata Virtual Account', group: 'Bank Transfer' },
    { value: 'cimb_va', label: 'CIMB Virtual Account', group: 'Bank Transfer' },
    { value: 'cstore', label: 'Convenience Store (Indomaret/Alfamart)', group: 'OTC' },
    { value: 'akulaku', label: 'Akulaku PayLater', group: 'PayLater' },
    { value: 'indomaret', label: 'Indomaret', group: 'OTC' },
    { value: 'alfamart', label: 'Alfamart', group: 'OTC' },
  ];

  if (loading) {
    return (
      <div>
        <div className="billing-header"><h1>Payment Settings</h1></div>
        <div className="data-table-skeleton">{[1,2].map(i => <div key={i} className="skeleton-row"><div className="skeleton-bar" style={{ height: 200 }} /></div>)}</div>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className="billing-header">
        <div>
          <h1>Payment Settings</h1>
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Midtrans payment gateway configuration</span>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary btn-sm" onClick={handleTest} disabled={testLoading}>
            {testLoading ? <><HiRefresh className="spinning" /> Testing...</> : <><HiExternalLink /> Test Connection</>}
          </button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            <HiSave /> {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>

      {/* Test Result */}
      {testResult && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          className={`billing-chart-wrap`}
          style={{ borderColor: testResult.success ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {testResult.success
              ? <HiCheckCircle size={20} style={{ color: 'var(--success)' }} />
              : <HiExclamationCircle size={20} style={{ color: 'var(--error)' }} />}
            <span style={{ fontWeight: 600 }}>{testResult.success ? 'Success' : 'Failed'}</span>
            <span style={{ color: 'var(--text-muted)', fontSize: 14 }}>{testResult.message}</span>
          </div>
        </motion.div>
      )}

      {/* Midtrans Configuration */}
      <div className="settings-section">
        <h3><HiShieldCheck /> Midtrans API Keys</h3>
        <div className="settings-row">
          <div className="form-group">
            <label className="form-label">Environment</label>
            <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
              <label className="checkbox-label" style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input type="radio" name="env" checked={form.is_sandbox}
                  onChange={() => setForm({...form, is_sandbox: true})} />
                <span className={`env-indicator sandbox`}>Sandbox</span>
              </label>
              <label className="checkbox-label" style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input type="radio" name="env" checked={!form.is_sandbox}
                  onChange={() => setForm({...form, is_sandbox: false})} />
                <span className={`env-indicator production`}>Production</span>
              </label>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Merchant ID</label>
            <input type="text" className="form-control" value={form.merchant_id}
              onChange={e => setForm({...form, merchant_id: e.target.value})}
              placeholder="M12345678" />
          </div>
        </div>
        <div className="settings-row">
          <div className="form-group">
            <label className="form-label">Client Key</label>
            <div style={{ position: 'relative' }}>
              <input type={showKeys.client_key ? 'text' : 'password'} className="form-control"
                value={form.client_key}
                onChange={e => setForm({...form, client_key: e.target.value})}
                placeholder="Mid-client-xxxx" style={{ paddingRight: 40 }} />
              <button className="btn btn-ghost btn-sm" style={{ position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)' }}
                onClick={() => toggleShowKey('client_key')}>
                {showKeys.client_key ? <HiEyeOff size={14} /> : <HiEye size={14} />}
              </button>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Server Key</label>
            <div style={{ position: 'relative' }}>
              <input type={showKeys.server_key ? 'text' : 'password'} className="form-control"
                value={form.server_key}
                onChange={e => setForm({...form, server_key: e.target.value})}
                placeholder="Mid-server-xxxx" style={{ paddingRight: 40 }} />
              <button className="btn btn-ghost btn-sm" style={{ position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)' }}
                onClick={() => toggleShowKey('server_key')}>
                {showKeys.server_key ? <HiEyeOff size={14} /> : <HiEye size={14} />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Invoice Settings */}
      <div className="settings-section">
        <h3><HiCog /> Invoice Settings</h3>
        <div className="settings-row">
          <div className="form-group">
            <label className="form-label">Invoice Prefix</label>
            <input type="text" className="form-control" value={form.invoice_prefix}
              onChange={e => setForm({...form, invoice_prefix: e.target.value})}
              placeholder="INV" />
          </div>
          <div className="form-group">
            <label className="form-label">Payment Due (days)</label>
            <input type="number" className="form-control" min="1" max="90" value={form.payment_due_days}
              onChange={e => setForm({...form, payment_due_days: parseInt(e.target.value) || 14})} />
          </div>
        </div>
      </div>

      {/* Payment Channels */}
      <div className="settings-section">
        <h3><HiCurrencyDollar /> Active Payment Channels</h3>
        
        {/* Production mode warning */}
        {!form.is_sandbox && (
          <div style={{ marginBottom: 16, padding: '12px 16px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 'var(--radius)', fontSize: 13 }}>
            <strong style={{ color: '#f59e0b' }}>⚠ Production Mode — Aktivasi Payment Channel</strong>
            <p style={{ margin: '6px 0 0', color: 'var(--text-muted)', lineHeight: 1.5 }}>
              Di production, payment channel harus diaktivasi manual lewat{' '}
              <a href="https://dashboard.midtrans.com" target="_blank" rel="noopener" style={{ color: 'var(--primary)' }}>
                Midtrans MAP Dashboard
              </a>:
            </p>
            <ol style={{ margin: '8px 0 0', paddingLeft: 20, color: 'var(--text-muted)', fontSize: 12, lineHeight: 1.7 }}>
              <li>Pilih Environment <strong>Production</strong></li>
              <li>Klik <strong>+ Payment Methods</strong></li>
              <li>Pilih metode pembayaran → upload dokumen → sign addendum</li>
              <li>Tunggu review & approval dari tim Midtrans</li>
            </ol>
            <p style={{ margin: '8px 0 0', color: 'var(--text-muted)', fontSize: 12 }}>
              Centang di halaman ini hanya untuk reference/pencatatan — tidak otomatis mengaktifkan channel di production.{' '}
              <a href="https://docs.midtrans.com/docs/activation-of-payment-methods-that-havent-been-active-yet" target="_blank" rel="noopener" style={{ color: 'var(--primary)' }}>
                Docs lengkap →
              </a>
            </p>
          </div>
        )}

        {['E-Wallet', 'Bank Transfer', 'Card', 'OTC', 'PayLater'].map(group => {
          const groupChannels = CHANNELS.filter(ch => ch.group === group);
          if (!groupChannels.length) return null;
          return (
            <div key={group} style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{group}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {groupChannels.map(ch => (
                  <label key={ch.value} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '8px 14px', background: form.payment_channels.includes(ch.value) ? 'rgba(99,102,241,0.1)' : 'var(--bg-secondary)', borderRadius: 'var(--radius)', border: `1px solid ${form.payment_channels.includes(ch.value) ? 'rgba(99,102,241,0.3)' : 'var(--border)'}`, transition: 'var(--transition)' }}>
                    <input type="checkbox" checked={form.payment_channels.includes(ch.value)}
                      onChange={() => {
                        const channels = form.payment_channels.includes(ch.value)
                          ? form.payment_channels.filter(c => c !== ch.value)
                          : [...form.payment_channels, ch.value];
                        setForm({ ...form, payment_channels: channels });
                      }} />
                    {ch.label}
                  </label>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Bank Accounts for Manual Transfer */}
      <div className="settings-section">
        <h3><HiCurrencyDollar /> Bank Accounts (Manual Transfer)</h3>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
          These accounts will be shown to clients for manual bank transfer payments.
        </p>
        {form.bank_accounts.map((bank, idx) => (
          <div key={idx} className="settings-row" style={{ marginBottom: 12, padding: 16, background: 'var(--bg-secondary)', borderRadius: 'var(--radius-lg)' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Bank</label>
              <select className="form-control" value={bank.bank}
                onChange={e => handleBankChange(idx, 'bank', e.target.value)}>
                <option value="BCA">BCA</option>
                <option value="BNI">BNI</option>
                <option value="BRI">BRI</option>
                <option value="Mandiri">Mandiri</option>
                <option value="BSI">BSI</option>
                <option value="Permata">Permata</option>
                <option value="CIMB">CIMB Niaga</option>
                <option value="Danamon">Danamon</option>
                <option value="Maybank">Maybank</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Account Number</label>
              <input type="text" className="form-control" value={bank.account_number}
                onChange={e => handleBankChange(idx, 'account_number', e.target.value)}
                placeholder="1234567890" />
            </div>
            <div className="form-group" style={{ margin: 0, flex: 1.5 }}>
              <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                Account Name
                {form.bank_accounts.length > 1 && (
                  <button className="btn btn-ghost btn-sm" onClick={() => removeBank(idx)}
                    style={{ color: 'var(--error)', fontSize: 11, padding: 0 }}>
                    Remove
                  </button>
                )}
              </label>
              <input type="text" className="form-control" value={bank.account_name}
                onChange={e => handleBankChange(idx, 'account_name', e.target.value)}
                placeholder="PT. MAZNET" />
            </div>
          </div>
        ))}
        <button className="btn btn-ghost btn-sm" onClick={addBank}>
          + Add Bank Account
        </button>
      </div>

      {settings && (
        <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', gap: 16, alignItems: 'center' }}>
          <span>Last updated: {settings.updated_at ? new Date(settings.updated_at).toLocaleString('id-ID') : 'Never'}</span>
          <span>Status: <span className={`billing-badge ${settings.server_key ? 'active' : 'draft'}`}>
            {settings.server_key ? 'Configured' : 'Not Configured'}
          </span></span>
        </div>
      )}
    </motion.div>
  );
};

export default PaymentSettings;
