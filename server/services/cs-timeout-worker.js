import { getProvider } from './whatsapp/provider-factory.js';

async function sendBotMessage(botToken, chatId, text) {
  try {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text })
    });
  } catch (e) {
    console.error('[CS Timeout Worker] Telegram send error:', e.message);
  }
}

export function startCSTimeoutWorker(db) {
  console.log('🤖 Proactive CS Timeout Background Worker started...');
  
  setInterval(async () => {
    try {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString().replace('T', ' ').replace('Z', '');
      const autoSwitchNotice = '🤖 Layanan dialihkan kembali ke AI karena CS kami sedang sibuk/belum merespon selama 5 menit.';

      // ==========================================
      // 1. MONITOR WHATSAPP CONVERSATIONS
      // ==========================================
      const activeWABots = await db.all('SELECT * FROM whatsapp_bots WHERE is_active = 1');
      for (const bot of activeWABots) {
        const conversations = await db.all(
          "SELECT * FROM whatsapp_conversations WHERE bot_id = ? AND status = 'human'",
          [bot.id]
        );

        for (const convo of conversations) {
          const lastBotMessage = await db.get(
            'SELECT created_at FROM whatsapp_messages WHERE conversation_id = ? AND role = ? ORDER BY created_at DESC LIMIT 1',
            [convo.id, 'bot']
          );

          if (lastBotMessage && lastBotMessage.created_at < fiveMinutesAgo) {
            console.log(`[CS Timeout] WhatsApp convo #${convo.id} timed out. Switching to AI...`);
            
            await db.run("UPDATE whatsapp_conversations SET status = 'ai', updated_at = CURRENT_TIMESTAMP WHERE id = ?", [convo.id]);

            try {
              const provider = getProvider(bot.provider);
              await provider.sendMessage(bot.id, convo.chat_id, autoSwitchNotice);
              
              await db.insert(
                'INSERT INTO whatsapp_messages (conversation_id, bot_id, chat_id, role, message) VALUES (?, ?, ?, ?, ?)',
                [convo.id, bot.id, convo.chat_id, 'bot', autoSwitchNotice]
              );
            } catch (err) {
              console.error(`[CS Timeout] Failed to send WA notification to ${convo.chat_id}:`, err.message);
            }
          }
        }
      }

      // ==========================================
      // 2. MONITOR TELEGRAM CONVERSATIONS
      // ==========================================
      const activeTeleBots = await db.all('SELECT * FROM telegram_bots WHERE is_active = 1');
      for (const bot of activeTeleBots) {
        const conversations = await db.all(
          "SELECT * FROM telegram_conversations WHERE bot_id = ? AND status = 'human'",
          [bot.id]
        );

        for (const convo of conversations) {
          const lastBotMessage = await db.get(
            'SELECT created_at FROM telegram_messages WHERE conversation_id = ? AND role = ? ORDER BY created_at DESC LIMIT 1',
            [convo.id, 'bot']
          );

          if (lastBotMessage && lastBotMessage.created_at < fiveMinutesAgo) {
            console.log(`[CS Timeout] Telegram convo #${convo.id} timed out. Switching to AI...`);
            
            await db.run("UPDATE telegram_conversations SET status = 'ai', updated_at = CURRENT_TIMESTAMP WHERE id = ?", [convo.id]);

            await sendBotMessage(bot.bot_token, String(convo.chat_id), autoSwitchNotice);
            
            await db.insert(
              'INSERT INTO telegram_messages (conversation_id, bot_id, chat_id, role, message) VALUES (?, ?, ?, ?, ?)',
              [convo.id, bot.id, convo.chat_id, 'bot', autoSwitchNotice]
            );
          }
        }
      }

    } catch (error) {
      console.error('[CS Timeout Worker] Polling error:', error);
    }
  }, 30000); // Poll every 30 seconds
}
