import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  HiCog, HiShieldCheck, HiCurrencyDollar, HiRefresh,
  HiCheckCircle, HiExclamationCircle, HiExternalLink,
  HiSave, HiEye, HiEyeOff
} from 'react-icons/hi';
import { paymentSettingsAPI } from '../../services/api';
import './Billing.css';

const PaymentSettings = () => {
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
          is_sandbox: data.is_sandbox !== undefined ? data.is_sandbox : true,
          merchant_id: data.merchant_id || '',
          client_key: data.client_key || '',
          server_key: data.server_key || '',
          payment_channels: data.payment_channels || ['gopay', 'bank_transfer', 'credit_card'],
          invoice_prefix: data.invoice_prefix || 'INV',
          payment_due_days: data.payment_due_days || 14,
          bank_accounts: data.bank_accounts && data.bank_accounts.length > 0
            ? data.bank_accounts
            : [{ bank: 'BCA', account_number: '', account_name: '' }],
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
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  const handleTest = async () => {
    setTestLoading(true);
    setTestResult(null);
    try {
      const { data } = await paymentSettingsAPI.test({ server_key: form.server_key, is_sandbox: form.is_sandbox });
      setTestResult({ success: true, message: data.message || 'Midtrans connection successful!' });
    } catch (e) {
      setTestResult({ success: false, message: e.response?.data?.message || e.message || 'Test failed' });
    }
    finally { setTestLoading(false); }
  };

  const CHANNELS = [
    { value: 'gopay', label: 'GoPay' },
    { value: 'bank_transfer', label: 'Bank Transfer' },
    { value: 'credit_card', label: 'Credit Card' },
    { value: 'cstore', label: 'Convenience Store' },
    { value: 'shopeepay', label: 'ShopeePay' },
    { value: 'akulaku', label: 'Akulaku' },
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
                placeholder="SB-Mid-client-xxxx" style={{ paddingRight: 40 }} />
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
                placeholder="SB-Mid-server-xxxx" style={{ paddingRight: 40 }} />
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
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
          {CHANNELS.map(ch => (
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
