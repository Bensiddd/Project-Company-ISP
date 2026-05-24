import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HiArrowLeft, HiChatAlt2, HiChip, HiRefresh, HiTrash, HiCog } from 'react-icons/hi';
import { telegramConversationsAPI, telegramAPI } from '../../services/api';
import { useToast } from '../../components/Toast';
import { shouldNotify } from '../../hooks/useNotificationGuard';
import useNotificationSound from '../../hooks/useNotificationSound';

const TelegramMessages = () => {
  const { showToast } = useToast();


  const [convos, setConvos] = useState([]);
  const totalUnread = convos.reduce((sum, c) => sum + (c.unread || 0), 0);
  const [selectedConvo, setSelectedConvo] = useState(null);
  const [convoMsgs, setConvoMsgs] = useState([]);
  const [convoReply, setConvoReply] = useState('');
  const [convoSending, setConvoSending] = useState(false);
  const [convosLoading, setConvosLoading] = useState(true);
  const [botStatuses, setBotStatuses] = useState({});
  const [toggling, setToggling] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const [countdown, setCountdown] = useState(3);
  const countdownRef = useRef(null);

  const chatEndRef = useRef(null);
  const msgContainerRef = useRef(null);
  const selectedConvoRef = useRef(null);
  const toastRef = useRef({});
  const notifiedConvosRef = useRef({});

  // shared notification sound
  const { playNotificationSound } = useNotificationSound();

  useEffect(() => { selectedConvoRef.current = selectedConvo; }, [selectedConvo]);

  const scrollToBottomIfNear = useCallback(() => {
    const el = msgContainerRef.current;
    if (!el) return;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (distFromBottom < 120) el.scrollTop = el.scrollHeight;
  }, []);

  const fetchConvos = useCallback(async () => {
    try {
      const { data } = await telegramConversationsAPI.getAll();
      data.forEach(convo => {
        if (shouldNotify(convo, notifiedConvosRef, toastRef)) {
          playNotificationSound();
          showToast({
            type: 'info',
            title: `💬 CS Chat dari ${convo.user_name || 'Pelanggan'}`,
            subtitle: convo.last_message || 'Ada pesan baru masuk.'
          });
        }
        // cache handled by shouldNotify
      });
      setConvos(data);
      if (selectedConvoRef.current) {
        const fresh = data.find(c => c.id === selectedConvoRef.current.id);
        if (fresh) setSelectedConvo(fresh);
      }
    } catch (e) { console.error(e); }
  }, [showToast]);

  const refreshOpenChat = useCallback(async () => {
    const convo = selectedConvoRef.current;
    if (!convo) return;
    try {
      const { data } = await telegramConversationsAPI.getMessages(convo.id);
      setConvoMsgs(prev => {
        if (data.length !== prev.length) return data;
        if (data.length && prev.length && data[data.length-1].id !== prev[prev.length-1].id) return data;
        return prev;
      });
    } catch (_) {}
  }, []);

  const loadConvoMessages = async (convo) => {
    setSelectedConvo(convo);
    try {
      const { data } = await telegramConversationsAPI.getMessages(convo.id);
      setConvoMsgs(data);
      setConvos(prev => prev.map(c => c.id === convo.id ? { ...c, unread: 0 } : c));
      setTimeout(() => msgContainerRef.current && (msgContainerRef.current.scrollTop = msgContainerRef.current.scrollHeight), 50);
    } catch (e) { console.error(e); }
    if (convo.bot_id) {
      telegramAPI.getStatus(convo.bot_id).then(r => setBotStatuses(prev => ({...prev, [convo.bot_id]: r.data}))).catch(()=>{});
    }
  };

  useEffect(() => {
    setConvosLoading(true);
    fetchConvos().finally(() => setConvosLoading(false));
    const ci = setInterval(fetchConvos, 5000);
    const mi = setInterval(refreshOpenChat, 3000);
    return () => { clearInterval(ci); clearInterval(mi); };
  }, [fetchConvos, refreshOpenChat]);

  useEffect(() => scrollToBottomIfNear(), [convoMsgs, scrollToBottomIfNear]);

  const handleDeleteConvo = async (convo, e) => {
    e?.stopPropagation();
    if (!window.confirm(`Hapus sesi dengan ${convo.user_name || 'Unknown'}? Semua pesan akan dihapus.`)) return;
    try {
      await telegramConversationsAPI.delete(convo.id);
      if (selectedConvo?.id===convo.id) setSelectedConvo(null);
      setConvos(prev=>prev.filter(c=>c.id!==convo.id));
    } catch (err) { alert('❌ Gagal hapus: '+(err.response?.data?.message||err.message)); }
  };

  const handleConvoReply = async () => {
    if (!convoReply.trim()||!selectedConvo) return;
    setConvoSending(true);
    try {
      await telegramConversationsAPI.reply(selectedConvo.id, convoReply);
      setConvoReply('');
      refreshOpenChat();
      fetchConvos();
      setTimeout(()=>msgContainerRef.current && (msgContainerRef.current.scrollTop=msgContainerRef.current.scrollHeight),50);
    } catch (e) { alert('❌ Gagal kirim: '+(e.response?.data?.message||e.message)); }
    finally { setConvoSending(false); }
  };

  const handleToggleMode = () => {
    if (!selectedConvo) return;
    if (selectedConvo.status === 'ai') { doToggle(); return; }
    setCountdown(3);
    setConfirmClose(true);
    countdownRef.current = setInterval(() => {
      setCountdown(p=>{
        if (p<=1) { clearInterval(countdownRef.current); setConfirmClose(false); doToggle(); return 0; }
        return p-1;
      });
    },1000);
  };

  const cancelConfirm = () => { clearInterval(countdownRef.current); setConfirmClose(false); setCountdown(3); };

  const doToggle = async () => {
    if (!selectedConvoRef.current) return;
    setToggling(true);
    try {
      const { data } = await telegramConversationsAPI.toggle(selectedConvoRef.current.id);
      setSelectedConvo(data);
      setConvos(prev=>prev.map(c=>c.id===data.id?data:c));
      setTimeout(refreshOpenChat,800);
    } catch(e){ console.error(e); } finally { setToggling(false); }
  };

  if (convosLoading && !convos.length) return (
    <div>
        <div className="data-table-header"><h1>Telegram Messages</h1>{totalUnread > 0 && <span style={{marginLeft:8,background:'#10b981',color:'#fff',borderRadius:12,padding:'2px 8px',fontSize:12,fontWeight:'600'}}>📨 {totalUnread}</span>}</div>
      <div className="data-table-skeleton">
        {[1,2,3].map(i=> <div key={i} className="skeleton-row"><div className="skeleton-bar" style={{height:60}}/></div>)}
      </div>
    </div>
  );

  return (
    <motion.div className="messages-page" initial={{opacity:0}} animate={{opacity:1}}>
      {/* UI similar to WhatsAppMessages, omitted for brevity – copy structure, replace API calls above */}
      {/* ... */}
    </motion.div>
  );
};

export default TelegramMessages;
