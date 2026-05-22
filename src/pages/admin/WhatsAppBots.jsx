import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import FormModal from '../../components/FormModal';
import { HiChatAlt2, HiShieldCheck, HiExclamationCircle, HiRefresh, HiGlobe, HiQrcode } from 'react-icons/hi';
import { whatsappBotsAPI, whatsappAPI } from '../../services/api';

const DEFAULT_SYSTEM_PROMPT = 'Anda adalah customer service MAZNET, ISP RT RW NET di Bekasi. Jawab dengan ramah, profesional, dan ringkas dalam Bahasa Indonesia. Jangan mengulangi jawaban yang sudah pernah Anda berikan sebelumnya dalam percakapan ini.';
const initialForm = { name: '', phone_number: '', provider: 'baileys', is_active: true, role: 'customer_service', ai_enabled: false, ai_provider: '', ai_model: '', ai_api_key: '', ai_url: '', api_key: '', webhook_url: '', system_prompt: '' };
const roleLabels = { customer_service: 'CS (AI)', admin: 'Admin', teknisi: 'Teknisi' };
const roleColors = { customer_service: '#10b981', admin: '#6366f1', teknisi: '#f59e0b' };
const providerLabels = { baileys: 'Baileys (Dev)', 'business-api': 'Business API (Prod)' };

const WhatsAppBots = () => {
  const [bots, setBots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [saving, setSaving] = useState(false);
  const [statuses, setStatuses] = useState({});
  const [qrCodes, setQrCodes] = useState({});
  const [testingAI, setTestingAI] = useState(false);
  const [aiTestResult, setAiTestResult] = useState(null);
  const pollingIntervals = useRef({}); // Track polling intervals per bot

  const fetchBots = async () => {
    try {
      const { data } = await whatsappBotsAPI.getAll();
      setBots(data);
      // Auto-fetch status for all bots
      data.forEach(bot => checkStatus(bot.id));
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  useEffect(() => {
    fetchBots();
    // Cleanup polling intervals on unmount
    return () => {
      Object.values(pollingIntervals.current).forEach(interval => clearInterval(interval));
      pollingIntervals.current = {};
    };
  }, []);

  const checkStatus = async (id) => {
    try {
      const { data } = await whatsappAPI.getStatus(id);
      setStatuses(prev => ({ ...prev, [id]: data }));
      if (data.qr_code) {
        setQrCodes(prev => ({ ...prev, [id]: data.qr_code }));
      }
    } catch (e) {
      setStatuses(prev => ({ ...prev, [id]: { status: 'error', error: e.response?.data?.message || e.message } }));
    }
  };

  const handleConnect = async (bot) => {
    try {
      const { data } = await whatsappAPI.connect(bot.id);
      setStatuses(prev => ({ ...prev, [bot.id]: { status: data.status } }));
      if (data.status !== 'connected') {
        alert('⏳ ' + data.message);
        checkStatus(bot.id);
      } else {
        alert('✅ ' + data.message);
      }
      // Poll for QR code if Baileys
      if (bot.provider === 'baileys') {
        // Clear any existing polling for this bot
        if (pollingIntervals.current[bot.id]) {
          clearInterval(pollingIntervals.current[bot.id]);
        }
        const interval = setInterval(async () => {
          try {
            const { data: statusData } = await whatsappAPI.getStatus(bot.id);
            // Update statuses state here so UI changes dynamically
            setStatuses(prev => ({ ...prev, [bot.id]: statusData }));

            if (statusData.status === 'connected') {
              clearInterval(interval);
              delete pollingIntervals.current[bot.id];
              setQrCodes(prev => ({ ...prev, [bot.id]: null }));
            } else if (statusData.qr_code) {
              setQrCodes(prev => ({ ...prev, [bot.id]: statusData.qr_code }));
            }
          } catch (e) {
            console.error('Polling error:', e);
          }
        }, 2000);
        pollingIntervals.current[bot.id] = interval;
        setTimeout(() => {
          if (pollingIntervals.current[bot.id]) {
            clearInterval(pollingIntervals.current[bot.id]);
            delete pollingIntervals.current[bot.id];
          }
        }, 60000); // Stop after 1 minute
      }
    } catch (e) {
      alert('❌ ' + (e.response?.data?.message || e.message));
    }
  };

  const handleDisconnect = async (bot) => {
    if (!confirm('Disconnect bot ' + bot.name + '?')) return;
    try {
      const { data } = await whatsappAPI.disconnect(bot.id);
      alert('✅ ' + data.message);
      checkStatus(bot.id);
      setQrCodes(prev => ({ ...prev, [bot.id]: null }));
    } catch (e) {
      alert('❌ ' + (e.response?.data?.message || e.message));
    }
  };

  const handleTest = async (bot) => {
    const chatId = prompt('Enter WhatsApp number (with country code, e.g., 628123456789):');
    if (!chatId) return;
    try {
      const { data } = await whatsappAPI.test(bot.id, chatId, 'Test message from MAZNET');
      alert('✅ Message sent successfully!');
    } catch (e) {
      alert('❌ ' + (e.response?.data?.message || e.message));
    }
  };

  const handleSetWebhook = async (bot) => {
    const webhookUrl = prompt('Enter webhook URL:', bot.webhook_url || `https://yourdomain.com/api/whatsapp/webhook/${bot.id}`);
    if (!webhookUrl) return;
    try {
      const { data } = await whatsappAPI.setWebhook(bot.id, webhookUrl);
      alert('✅ Webhook set successfully!');
      fetchBots();
    } catch (e) {
      alert('❌ ' + (e.response?.data?.message || e.message));
    }
  };

  const handleTestFormAI = async () => {
    const botId = editing?.id;
    if (!botId) { alert('⚠️ Simpan bot terlebih dahulu sebelum test.'); return; }
    if (!form.ai_provider) { alert('⚠️ Pilih AI Provider terlebih dahulu.'); return; }
    setTestingAI(true);
    setAiTestResult(null);
    try {
      const { data } = await whatsappAPI.checkAIWithValues(botId, {
        ai_provider: form.ai_provider,
        ai_model: form.ai_model,
        ai_api_key: form.ai_api_key || undefined,
        ai_url: form.ai_url
      });
      setAiTestResult(data);
    } catch (e) {
      setAiTestResult({ success: false, error: e.message });
    } finally { setTestingAI(false); }
  };

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const payload = { ...form };
      if (payload.role !== 'customer_service') {
        payload.ai_enabled = false;
        payload.ai_provider = '';
        payload.ai_model = '';
        payload.ai_api_key = '';
        payload.ai_url = '';
        payload.system_prompt = '';
      } else if (editing && !payload.ai_api_key) {
        delete payload.ai_api_key;
      }
      if (editing && !payload.api_key) {
        delete payload.api_key;
      }

      if (editing) {
        await whatsappBotsAPI.update(editing.id, payload);
      } else {
        await whatsappBotsAPI.create(payload);
      }
      
      setShowForm(false);
      setEditing(null);
      setForm(initialForm);
      setAiTestResult(null);
      fetchBots();
    } catch (e) {
      alert('❌ Save failed: ' + (e.response?.data?.message || e.message));
    } finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this bot? All conversations will be lost.')) return;
    try {
      await whatsappBotsAPI.delete(id);
      setBots(prev => prev.filter(b => b.id !== id));
    } catch (e) {
      alert('❌ Delete failed: ' + (e.response?.data?.message || e.message));
    }
  };

  if (loading) {
    return (
      <div>
        <div className="data-table-header"><h1>WhatsApp Bots</h1></div>
        <div className="data-table-skeleton">
          {[1, 2].map(i => <div key={i} className="skeleton-row"><div className="skeleton-bar" style={{ height: 100 }} /></div>)}
        </div>
      </div>
    );
  }

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <div className="data-table-header">
          <div>
            <h1>WhatsApp Bots</h1>
            <span className="data-table-count">{bots.length} bots</span>
          </div>
          <button className="btn btn-primary" onClick={() => {
            setEditing(null);
            setForm(initialForm);
            setAiTestResult(null);
            setShowForm(true);
          }}>
            + Add Bot
          </button>
        </div>

        <div className="service-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))' }}>
          {bots.map((bot, i) => (
            <motion.div
              key={bot.id}
              className={`service-card ${!bot.is_active ? 'inactive' : ''}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
            >
              <div className="service-card-header">
                <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <HiChatAlt2 /> {bot.name}
                </h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="badge" style={{
                    background: `${roleColors[bot.role] || '#666'}22`,
                    color: roleColors[bot.role] || '#666',
                    fontSize: 11
                  }}>
                    {roleLabels[bot.role] || bot.role}
                  </span>
                  <div
                    className={`toggle-switch ${bot.is_active ? 'on' : 'off'}`}
                    onClick={async () => {
                      try {
                        await whatsappBotsAPI.update(bot.id, { ...bot, is_active: !bot.is_active });
                        fetchBots();
                      } catch (e) {
                        alert('❌ Toggle failed: ' + (e.response?.data?.message || e.message));
                      }
                    }}
                  >
                    <div className="toggle-thumb" />
                  </div>
                </div>
              </div>

              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>
                Phone: <code style={{ fontSize: 12 }}>{bot.phone_number}</code>
              </p>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>
                Provider: <span style={{ color: bot.provider === 'baileys' ? '#f59e0b' : '#10b981' }}>
                  {providerLabels[bot.provider] || bot.provider}
                </span>
              </p>

              {bot.role === 'customer_service' && (
                <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>
                  {bot.ai_enabled && bot.ai_provider
                    ? <><span style={{ color: '#10b981' }}>🧠 AI Active</span> — {bot.ai_provider} / {bot.ai_model || 'default'}{bot.ai_url ? ' • Custom URL' : ''}</>
                    : <span style={{ color: 'var(--text-muted)' }}>📋 Template Mode</span>}
                </p>
              )}

              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                {statuses[bot.id]?.status === 'connected' ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--success)', fontSize: 13 }}>
                    <HiShieldCheck /> Connected
                  </span>
                ) : statuses[bot.id]?.status === 'qr' ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#f59e0b', fontSize: 13 }}>
                    <HiQrcode /> Waiting for QR scan
                  </span>
                ) : statuses[bot.id]?.status === 'connecting' ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#3b82f6', fontSize: 13 }}>
                    ⏳ Connecting...
                  </span>
                ) : statuses[bot.id]?.status === 'disconnected' ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--danger)', fontSize: 13 }}>
                    <HiExclamationCircle /> Disconnected
                  </span>
                ) : (
                  <button className="btn btn-ghost btn-sm" onClick={() => checkStatus(bot.id)}>
                    <HiRefresh /> Check Status
                  </button>
                )}
              </div>

              {/* QR Code Display */}
              {qrCodes[bot.id] && bot.provider === 'baileys' && (
                <div style={{
                  background: '#fff',
                  padding: 12,
                  borderRadius: 8,
                  marginBottom: 12
                }}>
                  <p style={{ fontSize: 12, color: '#666', marginBottom: 8, textAlign: 'center' }}>
                    Scan QR code dengan WhatsApp:
                  </p>
                  <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <img
                      src={qrCodes[bot.id]}
                      alt="QR Code"
                      width={200}
                      height={200}
                      style={{ borderRadius: 4 }}
                    />
                  </div>
                </div>
              )}

              <div className="service-card-actions">
                <button className="btn btn-secondary btn-sm" onClick={() => {
                  setEditing({ ...bot, ai_api_key_masked: bot.ai_api_key || '', api_key_masked: bot.api_key || '' });
                  setAiTestResult(null);
                  setForm({
                    name: bot.name,
                    phone_number: bot.phone_number,
                    provider: bot.provider || 'baileys',
                    is_active: bot.is_active,
                    role: bot.role || 'customer_service',
                    ai_enabled: !!bot.ai_enabled,
                    ai_provider: bot.ai_provider || '',
                    ai_model: bot.ai_model || '',
                    ai_api_key: '',
                    ai_url: bot.ai_url || '',
                    api_key: '',
                    webhook_url: bot.webhook_url || '',
                    system_prompt: bot.system_prompt || ''
                  });
                  setShowForm(true);
                }}>
                  Edit
                </button>

                {statuses[bot.id]?.status === 'connected' ? (
                  <button className="btn btn-danger btn-sm" onClick={() => handleDisconnect(bot)}>
                    Disconnect
                  </button>
                ) : (
                  <button className="btn btn-primary btn-sm" onClick={() => handleConnect(bot)}>
                    Connect
                  </button>
                )}

                <button className="btn btn-info btn-sm" onClick={() => handleTest(bot)}>
                  Test
                </button>

                {bot.provider === 'business-api' && (
                  <button
                    className="btn btn-info btn-sm"
                    onClick={() => handleSetWebhook(bot)}
                    style={{ background: '#1e93de', color: '#fff' }}
                  >
                    <HiGlobe /> Webhook
                  </button>
                )}

                <button className="btn btn-danger btn-sm" onClick={() => handleDelete(bot.id)}>
                  Delete
                </button>
              </div>
            </motion.div>
          ))}
          {bots.length === 0 && (
            <div className="empty-state">
              No WhatsApp bots yet. Add your first bot.
            </div>
          )}
        </div>

        <FormModal
          isOpen={showForm}
          onClose={() => {
            setShowForm(false);
            setEditing(null);
            setForm(initialForm);
            setAiTestResult(null);
          }}
          title={editing ? 'Edit WhatsApp Bot' : 'Add WhatsApp Bot'}
          onSubmit={handleSubmit}
          loading={saving}
        >
          <div className="form-group">
            <label>Bot Name</label>
            <input
              type="text"
              className="form-control"
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. MAZNET CS Bot"
              required
            />
          </div>

          <div className="form-group">
            <label>Phone Number / Phone Number ID</label>
            <input
              type="text"
              className="form-control"
              value={form.phone_number}
              onChange={e => setForm({ ...form, phone_number: e.target.value })}
              placeholder="628123456789 or Phone Number ID (Business API)"
              required
            />
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
              Baileys: nomor dengan kode negara (628xxx). Business API: Phone Number ID dari provider.
            </div>
          </div>

          <div className="form-group">
            <label>Provider</label>
            <select
              className="form-control"
              value={form.provider}
              onChange={e => setForm({ ...form, provider: e.target.value })}
            >
              <option value="baileys">Baileys (Development/Testing)</option>
              <option value="business-api">Business API (Production)</option>
            </select>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
              {form.provider === 'baileys'
                ? '⚠️ Baileys: Untuk development only. Scan QR code setelah connect.'
                : '✅ Business API: Untuk production. Support Meta Cloud API, Twilio, 360dialog.'}
            </div>
          </div>

          {form.provider === 'business-api' && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
              <div className="form-group">
                <label>
                  API Key / Access Token
                  {editing?.api_key_masked && (
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400 }}>
                      {' '}(tersimpan: {editing.api_key_masked} — kosongkan untuk mempertahankan)
                    </span>
                  )}
                </label>
                <input
                  type="password"
                  className="form-control"
                  value={form.api_key}
                  onChange={e => setForm({ ...form, api_key: e.target.value })}
                  placeholder="Meta: EAAxxxx... | Twilio: ACxxxx:authtoken | 360dialog: API key"
                  autoComplete="new-password"
                />
              </div>

              <div className="form-group">
                <label>Webhook URL (optional)</label>
                <input
                  type="text"
                  className="form-control"
                  value={form.webhook_url}
                  onChange={e => setForm({ ...form, webhook_url: e.target.value })}
                  placeholder={`https://yourdomain.com/api/whatsapp/webhook/${editing?.id || '{bot_id}'}`}
                />
              </div>
            </motion.div>
          )}

          <div className="form-group">
            <label>Role</label>
            <select
              className="form-control"
              value={form.role}
              onChange={e => setForm({ ...form, role: e.target.value })}
            >
              <option value="customer_service">Customer Service (AI)</option>
              <option value="admin">Admin</option>
              <option value="teknisi">Teknisi</option>
            </select>
          </div>

          {form.role === 'customer_service' && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
              <div className="form-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={form.ai_enabled}
                    onChange={e => setForm({ ...form, ai_enabled: e.target.checked })}
                  />
                  {' '}🧠 Aktifkan AI (template-only jika nonaktif)
                </label>
              </div>

              <div className="form-group">
                <label>AI Provider</label>
                <select
                  className="form-control"
                  value={form.ai_provider}
                  onChange={e => setForm({ ...form, ai_provider: e.target.value })}
                >
                  <option value="">Select provider...</option>
                  <option value="openai">OpenAI</option>
                  <option value="gemini">Google Gemini</option>
                  <option value="claude">Anthropic Claude</option>
                  <option value="openrouter">OpenRouter</option>
                  <option value="custom">Custom API</option>
                </select>
              </div>

              <div className="form-group">
                <label>AI Model</label>
                <input
                  type="text"
                  className="form-control"
                  value={form.ai_model}
                  onChange={e => setForm({ ...form, ai_model: e.target.value })}
                  placeholder="e.g. gpt-4o-mini, gemini-2.0-flash"
                />
                {form.ai_provider && (
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.7 }}>
                    {form.ai_provider === 'openai' && <span>💡 <b>OpenAI:</b> gpt-4o-mini &bull; gpt-4o &bull; gpt-3.5-turbo</span>}
                    {form.ai_provider === 'openrouter' && <span>💡 <b>OpenRouter:</b> openai/gpt-4o-mini &bull; google/gemini-2.0-flash &bull; anthropic/claude-3-haiku</span>}
                    {form.ai_provider === 'gemini' && <span>💡 <b>Gemini:</b> gemini-2.0-flash &bull; gemini-1.5-flash &bull; gemini-1.5-pro</span>}
                    {form.ai_provider === 'claude' && <span>💡 <b>Claude:</b> claude-3-haiku-20240307 &bull; claude-3-5-sonnet-20241022</span>}
                    {form.ai_provider === 'custom' && <span>💡 Sesuaikan nama model dengan API Anda.</span>}
                  </div>
                )}
              </div>

              <div className="form-group">
                <label>
                  System Prompt{' '}
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400 }}>
                    (opsional — kosongkan untuk pakai default MAZNET CS)
                  </span>
                </label>
                <textarea
                  className="form-control"
                  rows={5}
                  value={form.system_prompt}
                  onChange={e => setForm({ ...form, system_prompt: e.target.value })}
                  placeholder={DEFAULT_SYSTEM_PROMPT}
                  style={{ fontFamily: 'inherit', resize: 'vertical' }}
                />
              </div>

              <div className="form-group">
                <label>
                  AI API Key{' '}
                  {editing?.ai_api_key_masked && (
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400 }}>
                      (tersimpan: {editing.ai_api_key_masked} — kosongkan untuk mempertahankan)
                    </span>
                  )}
                </label>
                <input
                  type="password"
                  className="form-control"
                  value={form.ai_api_key}
                  onChange={e => setForm({ ...form, ai_api_key: e.target.value })}
                  placeholder={editing?.ai_api_key_masked || 'sk-...'}
                  autoComplete="new-password"
                />
              </div>

              <div className="form-group">
                <label>
                  API URL{' '}
                  {form.ai_provider === 'custom' ? (
                    <span style={{ color: 'var(--danger)' }}>(required)</span>
                  ) : (
                    <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>
                      (optional — override default endpoint)
                    </span>
                  )}
                </label>
                <input
                  type="text"
                  className="form-control"
                  value={form.ai_url}
                  onChange={e => setForm({ ...form, ai_url: e.target.value })}
                  placeholder={
                    form.ai_provider === 'custom'
                      ? 'https://your-api.com/v1/chat/completions'
                      : 'e.g. http://localhost:11434/v1 (Ollama)'
                  }
                />
              </div>

              {editing && (
                <div className="form-group">
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={handleTestFormAI}
                    disabled={testingAI}
                    style={{ background: '#1e93de', color: '#fff', width: '100%', marginBottom: 8 }}
                  >
                    {testingAI ? '⏳ Testing...' : '🧠 Test AI dengan nilai form saat ini'}
                  </button>
                  {aiTestResult && (
                    <div
                      style={{
                        padding: '10px 14px',
                        borderRadius: 8,
                        fontSize: 13,
                        background: aiTestResult.success ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
                        border: `1px solid ${aiTestResult.success ? '#10b981' : '#ef4444'}`,
                        color: aiTestResult.success ? '#10b981' : '#ef4444'
                      }}
                    >
                      {aiTestResult.success ? (
                        <>
                          <b>✅ Berhasil!</b> Model: <code>{aiTestResult.model}</code>
                          <br />
                          <span style={{ color: 'var(--text)', fontSize: 12 }}>{aiTestResult.response}</span>
                        </>
                      ) : (
                        <>
                          <b>❌ Gagal:</b> {aiTestResult.error}
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          )}

          <div className="form-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={e => setForm({ ...form, is_active: e.target.checked })}
              />
              {' '}Active
            </label>
          </div>
        </FormModal>
      </motion.div>
    </>
  );
};

export default WhatsAppBots;
