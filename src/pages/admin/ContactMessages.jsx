import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HiArrowLeft, HiChatAlt2, HiChip, HiRefresh, HiTrash, HiCog } from 'react-icons/hi';
import { telegramConversationsAPI, telegramAPI } from '../../services/api';

const ContactMessages = () => {
  const [convos, setConvos] = useState([]);
  const [selectedConvo, setSelectedConvo] = useState(null);
  const [convoMsgs, setConvoMsgs] = useState([]);
  const [convoReply, setConvoReply] = useState('');
  const [convoSending, setConvoSending] = useState(false);
  const [convosLoading, setConvosLoading] = useState(true);
  const [botStatuses, setBotStatuses] = useState({});
  const [toggling, setToggling] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);   // countdown modal
  const [countdown, setCountdown] = useState(3);             // 3-second timer
  const countdownRef = useRef(null);

  const chatEndRef = useRef(null);
  const msgContainerRef = useRef(null);
  const selectedConvoRef = useRef(null); // keep latest selectedConvo in ref for intervals

  // Keep ref in sync with state so intervals can read latest value
  useEffect(() => { selectedConvoRef.current = selectedConvo; }, [selectedConvo]);

  // Smart scroll: only auto-scroll if user is within 120px of the bottom
  const scrollToBottomIfNear = useCallback(() => {
    const el = msgContainerRef.current;
    if (!el) return;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (distFromBottom < 120) {
      el.scrollTop = el.scrollHeight;
    }
  }, []);

  const fetchConvos = useCallback(async () => {
    try {
      const { data } = await telegramConversationsAPI.getAll();
      setConvos(data);
      // Also sync selectedConvo status/unread from fresh list
      if (selectedConvoRef.current) {
        const fresh = data.find(c => c.id === selectedConvoRef.current.id);
        if (fresh) setSelectedConvo(fresh);
      }
    } catch (err) { console.error(err); }
  }, []);

  // Silently refresh messages for the open chat without replacing/flickering
  const refreshOpenChat = useCallback(async () => {
    const convo = selectedConvoRef.current;
    if (!convo) return;
    try {
      const { data } = await telegramConversationsAPI.getMessages(convo.id);
      setConvoMsgs(prev => {
        // Only update if there are genuinely new messages
        if (data.length !== prev.length) return data;
        if (data.length > 0 && prev.length > 0 && data[data.length - 1].id !== prev[prev.length - 1].id) return data;
        return prev;
      });
    } catch (err) { /* silently ignore */ }
  }, []);

  const loadConvoMessages = async (convo) => {
    setSelectedConvo(convo);
    try {
      const { data } = await telegramConversationsAPI.getMessages(convo.id);
      setConvoMsgs(data);
      // Mark as read by resetting unread in local state
      setConvos(prev => prev.map(c => c.id === convo.id ? { ...c, unread: 0 } : c));
      // Immediate scroll to bottom on open
      setTimeout(() => { if (msgContainerRef.current) msgContainerRef.current.scrollTop = msgContainerRef.current.scrollHeight; }, 50);
    } catch (err) { console.error(err); }
    // Non-blocking bot status fetch (fire-and-forget, won't block UI)
    if (convo.bot_id) {
      telegramAPI.getStatus(convo.bot_id).then(({ data: statusData }) => {
        setBotStatuses(prev => ({ ...prev, [convo.bot_id]: statusData }));
      }).catch(() => {});
    }
  };

  // Initial load + polling loops
  useEffect(() => {
    setConvosLoading(true);
    fetchConvos().finally(() => setConvosLoading(false));
    const convoInterval = setInterval(fetchConvos, 5000);
    // Poll open chat messages every 3 seconds
    const msgInterval = setInterval(refreshOpenChat, 3000);
    return () => { clearInterval(convoInterval); clearInterval(msgInterval); };
  }, [fetchConvos, refreshOpenChat]);

  // Smart scroll whenever messages update
  useEffect(() => {
    scrollToBottomIfNear();
  }, [convoMsgs, scrollToBottomIfNear]);

  const handleDeleteConvo = async (convo, e) => {
    if (e) e.stopPropagation();
    if (!window.confirm(`Hapus sesi dengan ${convo.user_name || 'Unknown'}? Semua pesan akan dihapus.`)) return;
    try {
      await telegramConversationsAPI.delete(convo.id);
      if (selectedConvo?.id === convo.id) setSelectedConvo(null);
      setConvos(prev => prev.filter(c => c.id !== convo.id));
    } catch (e) {
      alert('❌ Gagal hapus: ' + (e.response?.data?.message || e.message));
    }
  };

  const handleConvoReply = async () => {
    if (!convoReply.trim() || !selectedConvo) return;
    setConvoSending(true);
    try {
      const { data } = await telegramConversationsAPI.reply(selectedConvo.id, convoReply);
      setConvoMsgs(data);
      setConvoReply('');
      fetchConvos();
      // Force scroll to bottom after own reply
      setTimeout(() => { if (msgContainerRef.current) msgContainerRef.current.scrollTop = msgContainerRef.current.scrollHeight; }, 50);
    } catch (e) {
      alert('❌ Gagal kirim: ' + (e.response?.data?.description || e.message));
    } finally { setConvoSending(false); }
  };

  // Called when CS clicks "Switch to AI" — triggers countdown modal
  const handleToggleMode = () => {
    if (!selectedConvo) return;
    // If switching AI → Human (no confirmation needed)
    if (selectedConvo.status === 'ai') {
      doToggle();
      return;
    }
    // If switching Human → AI: show countdown confirmation
    setCountdown(3);
    setConfirmClose(true);
    countdownRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(countdownRef.current);
          setConfirmClose(false);
          doToggle();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const cancelConfirm = () => {
    clearInterval(countdownRef.current);
    setConfirmClose(false);
    setCountdown(3);
  };

  const doToggle = async () => {
    if (!selectedConvoRef.current) return;
    setToggling(true);
    try {
      const { data } = await telegramConversationsAPI.toggle(selectedConvoRef.current.id);
      setSelectedConvo(data);
      setConvos(prev => prev.map(c => c.id === data.id ? data : c));
      // Refresh messages so thank-you message appears immediately
      setTimeout(() => refreshOpenChat(), 800);
    } catch (e) { console.error(e); } finally { setToggling(false); }
  };


  const convoUnread = convos.reduce((sum, c) => sum + (c.unread || 0), 0);

  if (convosLoading && convos.length === 0) {
    return (
      <div>
        <div className="data-table-skeleton">{[1,2,3].map(i => <div key={i} className="skeleton-row"><div className="skeleton-bar" style={{ height: 60 }} /></div>)}</div>
      </div>
    );
  }

  return (
    <motion.div className="messages-page" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>

      {/* ── Countdown Confirmation Modal ─────────────────────────────────────── */}
      <AnimatePresence>
        {confirmClose && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{
              position: 'fixed', inset: 0, zIndex: 9999,
              background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}
          >
            <motion.div
              initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.85, opacity: 0 }}
              style={{
                background: 'var(--bg-card)', border: '1px solid var(--border)',
                borderRadius: 16, padding: '36px 40px', textAlign: 'center',
                maxWidth: 380, width: '90%', boxShadow: '0 24px 48px rgba(0,0,0,0.3)'
              }}
            >
              {/* Circular countdown */}
              <div style={{ position: 'relative', width: 80, height: 80, margin: '0 auto 20px' }}>
                <svg width="80" height="80" style={{ transform: 'rotate(-90deg)' }}>
                  <circle cx="40" cy="40" r="34" fill="none" stroke="var(--border)" strokeWidth="5" />
                  <circle cx="40" cy="40" r="34" fill="none" stroke="#10b981" strokeWidth="5"
                    strokeDasharray={`${2 * Math.PI * 34}`}
                    strokeDashoffset={`${2 * Math.PI * 34 * (1 - countdown / 3)}`}
                    style={{ transition: 'stroke-dashoffset 0.9s linear' }}
                  />
                </svg>
                <div style={{
                  position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
                  justifyContent: 'center', fontSize: 28, fontWeight: 700, color: '#10b981'
                }}>{countdown}</div>
              </div>

              <h3 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 700 }}>Selesaikan Percakapan?</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: 14, margin: '0 0 8px' }}>
                Percakapan dengan <strong>{selectedConvoRef.current?.user_name || 'pelanggan'}</strong> akan dikembalikan ke AI.
              </p>
              <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: '0 0 24px' }}>
                Bot akan otomatis mengirim pesan terima kasih kepada pelanggan.
              </p>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                <button
                  onClick={cancelConfirm}
                  style={{
                    flex: 1, padding: '10px 0', borderRadius: 8, border: '1px solid var(--border)',
                    background: 'transparent', color: 'var(--text)', cursor: 'pointer', fontSize: 14, fontWeight: 600
                  }}
                >
                  ✕ Batal
                </button>
                <button
                  onClick={() => { cancelConfirm(); doToggle(); }}
                  style={{
                    flex: 1, padding: '10px 0', borderRadius: 8, border: 'none',
                    background: 'linear-gradient(135deg, #10b981, #059669)', color: '#fff',
                    cursor: 'pointer', fontSize: 14, fontWeight: 600
                  }}
                >
                  ✓ Selesai Sekarang
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="messages-layout">
        <div className={'messages-list' + (selectedConvo ? ' hidden-mobile' : '')}>
          {convos.map((convo, i) => (
            <motion.div key={convo.id} className={'message-item' + (convo.unread > 0 ? ' is-unread' : '') + (selectedConvo?.id === convo.id ? ' is-selected' : '')}
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              onClick={() => loadConvoMessages(convo)}
            >
              <div className="message-item-avatar" style={{ background: convo.status === 'ai' ? '#10b981' : '#f59e0b' }}>
                {(convo.user_name || '?').charAt(0).toUpperCase()}
              </div>
              <div className="message-item-content">
                <div className="message-item-top">
                  <span className="message-item-name">{convo.user_name || 'Unknown'}</span>
                  <span className="message-item-time" style={{ fontSize: 11 }}>{convo.updated_at ? new Date(convo.updated_at + 'Z').toLocaleString() : ''}</span>
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 2 }}>
                  <span className="badge" style={{ background: convo.status === 'ai' ? '#10b98122' : '#f59e0b22', color: convo.status === 'ai' ? '#10b981' : '#f59e0b', fontSize: 10, padding: '1px 6px' }}>
                    {convo.status === 'ai' ? '🤖 AI' : '💬 Human'}
                  </span>
                  {convo.bot_name && <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>via {convo.bot_name}</span>}
                </div>
                <div className="message-item-preview">{convo.last_message?.substring(0, 60) || '...'}</div>
              </div>
              <div className="message-item-status">
                {convo.unread > 0 && <div className="unread-dot" />}
                <button className="btn-icon btn-icon-danger" onClick={(e) => handleDeleteConvo(convo, e)} title="Hapus sesi" style={{ fontSize: 12, opacity: 0.5 }}>🗑</button>
              </div>
            </motion.div>
          ))}
          {convos.length === 0 && (
            <div className="empty-state" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
              <HiChatAlt2 style={{ fontSize: 40, marginBottom: 12 }} />
              <p>No Telegram conversations yet. Send a message to the bot first.</p>
            </div>
          )}
        </div>

        <AnimatePresence>
          {selectedConvo ? (
            <motion.div className="message-detail-panel" key="telegram-detail"
              initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
              style={{ display: 'flex', flexDirection: 'column' }}
            >
              <div className="message-detail-header">
                <button className="btn-icon" onClick={() => setSelectedConvo(null)} title="Back"><HiArrowLeft /></button>
                <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                    {selectedConvo.user_name || 'Unknown'}
                    <span className={'status-pill ' + selectedConvo.status}>{selectedConvo.status === 'ai' ? '🤖 AI Auto' : '💬 Human'}</span>
                  </div>
                  {selectedConvo.bot_name && (
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                      via {selectedConvo.bot_name}
                      {botStatuses[selectedConvo.bot_id]?.ok
                        ? <><span style={{ color: '#10b981' }}>🟢</span> Online</>
                        : <><span style={{ color: '#ef4444' }}>🔴</span> Offline</>
                      }
                      <HiCog size={12} style={{ cursor: 'pointer', opacity: 0.5 }} onClick={() => window.location.href = '/admin/telegram-bots'} title="Edit Bot" />
                    </div>
                  )}
                </div>
                <div className="message-detail-actions">
                  <button className={'btn btn-sm ' + (selectedConvo.status === 'ai' ? 'btn-warning' : 'btn-success')} onClick={handleToggleMode} disabled={toggling} style={{ background: selectedConvo.status === 'ai' ? '#f59e0b' : '#10b981', color: '#fff' }}>
                    <HiChip /> {selectedConvo.status === 'ai' ? 'Switch to Human' : 'Switch to AI'}
                  </button>
                  <button className="btn btn-secondary btn-sm" title="Refresh" onClick={() => { fetchConvos(); loadConvoMessages(selectedConvo); }}><HiRefresh /></button>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)', opacity: 0.7 }}>Auto-refresh ✓</span>
                </div>
              </div>

              {/* Scrollable messages area */}
              <div ref={msgContainerRef} className="message-detail-body" style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '12px 24px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {convoMsgs.map((msg, i) => (
                  <div key={msg.id} style={{
                    alignSelf: msg.role === 'user' ? 'flex-start' : 'flex-end',
                    maxWidth: '90%',
                    background: msg.role === 'user' ? 'var(--bg-card)' : msg.role === 'agent' ? '#1e93de' : '#10b981',
                    color: msg.role === 'user' ? 'var(--text)' : '#fff',
                    padding: '10px 14px',
                    borderRadius: msg.role === 'user' ? '4px 16px 16px 4px' : '16px 4px 4px 16px',
                    fontSize: 14,
                    lineHeight: 1.5,
                    wordBreak: 'break-word'
                  }}>
                    <div style={{ fontSize: 10, opacity: 0.7, marginBottom: 4, display: 'flex', gap: 4 }}>
                      {msg.role === 'user' ? '👤 User' : msg.role === 'agent' ? '👨‍💼 CS' : '🤖 Bot'}
                      <span>{msg.created_at ? new Date(msg.created_at + 'Z').toLocaleTimeString() : ''}</span>
                    </div>
                    {msg.message}
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>

              {/* Reply box - always visible at bottom */}
              <div className="message-reply-box">
                <div style={{ display: 'flex', gap: 8 }}>
                  <textarea className="form-control" rows="2" value={convoReply} onChange={e => setConvoReply(e.target.value)}
                    placeholder={selectedConvo.status === 'ai' ? 'AI mode aktif. Switch ke Human untuk reply manual.' : 'Ketik balasan...'}
                    disabled={selectedConvo.status === 'ai'}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleConvoReply(); } }}
                    style={{ flex: 1 }} />
                  <button className="btn btn-primary" onClick={handleConvoReply}
                    disabled={convoSending || !convoReply.trim() || selectedConvo.status === 'ai'}
                    style={{ alignSelf: 'flex-end', height: 42 }}>
                    {convoSending ? '...' : 'Kirim'}
                  </button>
                </div>
                {selectedConvo.status === 'ai' && (
                  <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>ℹ️ AI auto-reply aktif. Klik "Switch to Human" untuk membalas manual.</p>
                )}
              </div>
            </motion.div>
          ) : (
            <motion.div className="message-detail-panel message-empty-state" key="telegram-empty"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            >
              <HiChatAlt2 className="empty-icon" />
              <h3>Select a conversation</h3>
              <p>Choose a Telegram conversation to view messages and reply</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

export default ContactMessages;
