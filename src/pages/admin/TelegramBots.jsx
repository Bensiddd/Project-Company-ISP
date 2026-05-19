import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import FormModal from '../../components/FormModal';
import { HiChatAlt2, HiShieldCheck, HiExclamationCircle, HiRefresh, HiGlobe } from 'react-icons/hi';
import { telegramBotsAPI, telegramAPI } from '../../services/api';

const initialForm = { name: '', bot_token: '', admin_chat_id: '', is_active: true, role: 'admin', ai_provider: '', ai_model: '', ai_api_key: '', ai_url: '' };
const roleLabels = { customer_service: 'CS (AI)', admin: 'Admin', teknisi: 'Teknisi' };
const roleColors = { customer_service: '#10b981', admin: '#6366f1', teknisi: '#f59e0b' };

const TelegramBots = () => {
  const [bots, setBots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [saving, setSaving] = useState(false);
  const [statuses, setStatuses] = useState({});
  const [testingAI, setTestingAI] = useState(false);
  const [aiTestResult, setAiTestResult] = useState(null);

  const fetchBots = async () => {
    try {
      const { data } = await telegramBotsAPI.getAll();
      setBots(data);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  useEffect(() => { fetchBots(); }, []);

  const checkStatus = async (id) => {
    try {
      const { data } = await telegramAPI.getStatus(id);
      setStatuses(prev => ({ ...prev, [id]: data }));
    } catch (e) {
      setStatuses(prev => ({ ...prev, [id]: { ok: false, error: e.response?.data?.description || e.message } }));
    }
  };

  const handleFullTest = async (bot) => {
    const results = [];
    try {
      const { data: testData } = await telegramAPI.test(bot.id);
      if (!testData.ok) {
        alert('❌ Token invalid: ' + (testData.description || 'Unknown error'));
        return;
      }
      results.push('✅ Token: ' + (testData.bot_name || 'OK'));

      if (bot.role === 'customer_service' && bot.ai_api_key) {
        try {
          const { data: aiData } = await telegramAPI.checkAI(bot.id);
          if (aiData.ok) results.push('✅ AI connected');
          else results.push('⚠️ AI: ' + (aiData.error || 'failed'));
        } catch (e) {
          results.push('⚠️ AI error: ' + e.message);
        }
      }

      if (bot.role === 'customer_service') {
        try {
          const { data: pollData } = await telegramAPI.startPolling(bot.id);
          if (pollData.ok) results.push('✅ Polling active');
          else results.push('⚠️ Polling: ' + (pollData.message || 'failed'));
        } catch (e) {
          results.push('⚠️ Polling error: ' + e.message);
        }
      }

      checkStatus(bot.id);
      alert(results.join('\n'));
    } catch (e) {
      alert('❌ ' + (e.response?.data?.description || e.response?.data?.message || e.message));
    }
  };

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const payload = { ...form };
      if (payload.role !== 'customer_service') {
        payload.ai_provider = ''; payload.ai_model = ''; payload.ai_api_key = ''; payload.ai_url = '';
      }
      if (editing) {
        const { data } = await telegramBotsAPI.update(editing.id, payload);
        setBots(prev => prev.map(b => b.id === editing.id ? data : b));
      } else {
        const { data } = await telegramBotsAPI.create(payload);
        setBots(prev => [...prev, data]);
      }
      setShowForm(false); setEditing(null); setForm(initialForm); setAiTestResult(null);
    } catch (e) {
      alert('❌ Save failed: ' + (e.response?.data?.message || e.message));
    } finally { setSaving(false); }
  };

  const handleSetWebhook = async (bot) => {
    const baseUrl = prompt('Enter your public server URL (e.g. https://your-server.com):');
    if (!baseUrl) return;
    try {
      const { data } = await telegramAPI.setWebhook(bot.id, baseUrl.replace(/\/+$/, ''));
      if (data.ok) alert('✅ Webhook set successfully!');
      else alert('❌ Failed: ' + (data.description || 'Unknown error'));
    } catch (e) { alert('❌ Error: ' + (e.response?.data?.message || e.message)); }
  };

  const handleTestFormAI = async () => {
    const botId = editing?.id;
    if (!botId) { alert('⚠️ Simpan bot terlebih dahulu sebelum test.'); return; }
    if (!form.ai_provider) { alert('⚠️ Pilih AI Provider terlebih dahulu.'); return; }
    setTestingAI(true);
    setAiTestResult(null);
    try {
      const { data } = await telegramAPI.checkAIWithValues(botId, {
        ai_provider: form.ai_provider,
        ai_model:    form.ai_model,
        ai_api_key:  form.ai_api_key || undefined,
        ai_url:      form.ai_url
      });
      setAiTestResult(data);
    } catch (e) {
      setAiTestResult({ ok: false, error: e.message });
    } finally { setTestingAI(false); }
  };

  const handleStartPolling = async (id) => {
    try {
      const { data } = await telegramAPI.startPolling(id);
      if (data.ok) alert('✅ Polling started! Bot listening for messages.');
      else alert('❌ Polling failed: ' + (data.message || 'Unknown error'));
    } catch (e) { alert('❌ Error: ' + (e.response?.data?.message || e.message)); }
  };

  const handleDelete = async (id) => {
    try {
      await telegramBotsAPI.delete(id);
      setBots(prev => prev.filter(b => b.id !== id));
    } catch (e) { alert('❌ Delete failed: ' + (e.response?.data?.message || e.message)); }
  };

  if (loading) {
    return (
      <div>
        <div className="data-table-header"><h1>Telegram Bots</h1></div>
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
          <div><h1>Telegram Bots</h1><span className="data-table-count">{bots.length} bots</span></div>
          <button className="btn btn-primary" onClick={() => { setEditing(null); setForm(initialForm); setAiTestResult(null); setShowForm(true); }}>
            + Add Bot
          </button>
        </div>

        <div className="service-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))' }}>
          {bots.map((bot, i) => (
            <motion.div key={bot.id} className={`service-card ${!bot.is_active ? 'inactive' : ''}`}
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
            >
              <div className="service-card-header">
                <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}><HiChatAlt2 /> {bot.name}</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="badge" style={{ background: `${roleColors[bot.role] || '#666'}22`, color: roleColors[bot.role] || '#666', fontSize: 11 }}>
                    {roleLabels[bot.role] || bot.role}
                  </span>
                  <div
                    className={`toggle-switch ${bot.is_active ? 'on' : 'off'}`}
                    onClick={async () => {
                      try {
                        const { data } = await telegramBotsAPI.update(bot.id, { ...bot, is_active: !bot.is_active });
                        setBots(prev => prev.map(b => b.id === bot.id ? data : b));
                      } catch (e) { alert('❌ Toggle failed: ' + (e.response?.data?.message || e.message)); }
                    }}
                  >
                    <div className="toggle-thumb" />
                  </div>
                </div>
              </div>

              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>
                Token: <code style={{ fontSize: 12 }}>{bot.bot_token ? bot.bot_token.substring(0, 20) + '...' : 'N/A'}</code>
              </p>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>Chat ID: {bot.admin_chat_id || '-'}</p>
              {bot.role === 'customer_service' && bot.ai_provider && (
                <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>
                  AI: {bot.ai_provider} / {bot.ai_model || 'default'}{bot.ai_url ? ' • Custom URL' : ''}
                </p>
              )}

              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                {statuses[bot.id]?.ok ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--success)', fontSize: 13 }}>
                    <HiShieldCheck /> Active ({statuses[bot.id]?.bot_name})
                  </span>
                ) : statuses[bot.id] ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--danger)', fontSize: 13 }}>
                    <HiExclamationCircle /> Offline
                  </span>
                ) : (
                  <button className="btn btn-ghost btn-sm" onClick={() => checkStatus(bot.id)}><HiRefresh /> Check Status</button>
                )}
              </div>

              <div className="service-card-actions">
                <button className="btn btn-secondary btn-sm" onClick={() => {
                  setEditing(bot);
                  setAiTestResult(null);
                  setForm({ name: bot.name, bot_token: bot.bot_token, admin_chat_id: bot.admin_chat_id || '', is_active: bot.is_active, role: bot.role || 'admin', ai_provider: bot.ai_provider || '', ai_model: bot.ai_model || '', ai_api_key: bot.ai_api_key || '', ai_url: bot.ai_url || '' });
                  setShowForm(true);
                }}>Edit</button>
                <button className="btn btn-primary btn-sm" onClick={() => handleFullTest(bot)}>Test</button>
                <button className="btn btn-info btn-sm" onClick={() => handleSetWebhook(bot)} style={{ background: '#1e93de', color: '#fff' }}>
                  <HiGlobe /> Webhook
                </button>
                {bot.role === 'customer_service' && (
                  <button className="btn btn-secondary btn-sm" onClick={() => handleStartPolling(bot.id)} style={{ background: '#9333ea', color: '#fff' }}>
                    Polling
                  </button>
                )}
                <button className="btn btn-danger btn-sm" onClick={() => handleDelete(bot.id)}>Delete</button>
              </div>
            </motion.div>
          ))}
          {bots.length === 0 && <div className="empty-state">No bots yet. Add your first Telegram bot.</div>}
        </div>

        <FormModal
          isOpen={showForm}
          onClose={() => { setShowForm(false); setEditing(null); setForm(initialForm); setAiTestResult(null); }}
          title={editing ? 'Edit Bot' : 'Add Bot'}
          onSubmit={handleSubmit}
          loading={saving}
        >
          <div className="form-group">
            <label>Bot Name</label>
            <input type="text" className="form-control" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Support Bot" required />
          </div>
          <div className="form-group">
            <label>Bot Token</label>
            <input type="text" className="form-control" value={form.bot_token} onChange={e => setForm({ ...form, bot_token: e.target.value })} placeholder="123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11" required />
          </div>
          <div className="form-group">
            <label>Admin Chat ID (optional)</label>
            <input type="text" className="form-control" value={form.admin_chat_id} onChange={e => setForm({ ...form, admin_chat_id: e.target.value })} placeholder="e.g. -1001234567890" />
          </div>
          <div className="form-group">
            <label>Role</label>
            <select className="form-control" value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
              <option value="admin">Admin</option>
              <option value="customer_service">Customer Service (AI)</option>
              <option value="teknisi">Teknisi</option>
            </select>
          </div>

          {form.role === 'customer_service' && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
              {/* AI Provider */}
              <div className="form-group">
                <label>AI Provider</label>
                <select className="form-control" value={form.ai_provider} onChange={e => setForm({ ...form, ai_provider: e.target.value })}>
                  <option value="">Select provider...</option>
                  <option value="openai">OpenAI</option>
                  <option value="gemini">Google Gemini</option>
                  <option value="claude">Anthropic Claude</option>
                  <option value="openrouter">OpenRouter</option>
                  <option value="custom">Custom API</option>
                </select>
              </div>

              {/* AI Model + hints */}
              <div className="form-group">
                <label>AI Model</label>
                <input type="text" className="form-control" value={form.ai_model} onChange={e => setForm({ ...form, ai_model: e.target.value })} placeholder="e.g. gpt-4o-mini, gemini-2.0-flash" />
                {form.ai_provider && (
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.7 }}>
                    {form.ai_provider === 'openai'     && <span>💡 <b>OpenAI:</b> gpt-4o-mini &bull; gpt-4o &bull; gpt-3.5-turbo</span>}
                    {form.ai_provider === 'openrouter' && <span>💡 <b>OpenRouter:</b> openai/gpt-4o-mini &bull; google/gemini-2.0-flash &bull; anthropic/claude-3-haiku</span>}
                    {form.ai_provider === 'gemini'     && <span>💡 <b>Gemini:</b> gemini-2.0-flash &bull; gemini-1.5-flash &bull; gemini-1.5-pro</span>}
                    {form.ai_provider === 'claude'     && <span>💡 <b>Claude:</b> claude-3-haiku-20240307 &bull; claude-3-5-sonnet-20241022</span>}
                    {form.ai_provider === 'custom'     && <span>💡 Sesuaikan nama model dengan API Anda.</span>}
                  </div>
                )}
              </div>

              {/* API Key */}
              <div className="form-group">
                <label>AI API Key</label>
                <input type="password" className="form-control" value={form.ai_api_key} onChange={e => setForm({ ...form, ai_api_key: e.target.value })} placeholder="sk-..." />
              </div>

              {/* API URL */}
              <div className="form-group">
                <label>
                  API URL {form.ai_provider === 'custom'
                    ? <span style={{ color: 'var(--danger)' }}>(required)</span>
                    : <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional — override default endpoint)</span>}
                </label>
                <input type="text" className="form-control" value={form.ai_url} onChange={e => setForm({ ...form, ai_url: e.target.value })}
                  placeholder={form.ai_provider === 'custom' ? 'https://your-api.com/v1/chat/completions' : 'e.g. http://localhost:11434/v1 (Ollama)'} />
              </div>

              {/* Inline Test AI (only when editing an existing bot) */}
              {editing && (
                <div className="form-group">
                  <button type="button" className="btn btn-secondary btn-sm" onClick={handleTestFormAI} disabled={testingAI}
                    style={{ background: '#1e93de', color: '#fff', width: '100%', marginBottom: 8 }}>
                    {testingAI ? '⏳ Testing...' : '🧠 Test AI dengan nilai form saat ini'}
                  </button>
                  {aiTestResult && (
                    <div style={{
                      padding: '10px 14px', borderRadius: 8, fontSize: 13,
                      background: aiTestResult.ok ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
                      border: `1px solid ${aiTestResult.ok ? '#10b981' : '#ef4444'}`,
                      color: aiTestResult.ok ? '#10b981' : '#ef4444'
                    }}>
                      {aiTestResult.ok
                        ? <><b>✅ Berhasil!</b> Model: <code>{aiTestResult.model}</code><br /><span style={{ color: 'var(--text)', fontSize: 12 }}>{aiTestResult.text}</span></>
                        : <><b>❌ Gagal:</b> {aiTestResult.error}<br />{aiTestResult.hint && <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>💡 {aiTestResult.hint}</span>}</>
                      }
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          )}

          <div className="form-group">
            <label className="checkbox-label">
              <input type="checkbox" checked={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })} /> Active
            </label>
          </div>
        </FormModal>
      </motion.div>
    </>
  );
};

export default TelegramBots;
