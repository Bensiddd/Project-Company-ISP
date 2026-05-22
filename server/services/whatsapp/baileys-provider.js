import makeWASocket, { fetchLatestBaileysVersion } from '@whiskeysockets/baileys';
import { WhatsAppProvider } from './whatsapp-provider.js';
import { useSingleFileAuthState } from './single-file-auth.js';
import db from '../../db.js';
import { handleIncomingMessage } from './message-handler.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { existsSync, rmSync } from 'fs';
import qrcode from 'qrcode';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Baileys WhatsApp Provider
 * For development/testing - uses WhatsApp Web protocol
 */
export class BaileysProvider extends WhatsAppProvider {
  constructor() {
    super();
    this.connections = new Map(); // botId -> { sock, qr, status }
  }

  async connect(bot, forceReconnect = false) {
    const existing = this.connections.get(bot.id);
    if (existing && !forceReconnect) {
      console.log(`[Baileys] Bot ${bot.id} already connected`);
      return;
    }
    if (existing) {
      existing.sock?.ev?.removeAllListeners?.();
      existing.sock?.end?.();
      this.connections.delete(bot.id);
    }

    const authDir = path.join(__dirname, '../../data/whatsapp-sessions', `bot-${bot.id}`);
    const { state, saveCreds } = await useSingleFileAuthState(authDir);
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
      version,
      auth: state,
      printQRInTerminal: false,
      browser: ['MAZNET ISP', 'Chrome', '10.0'],
      getMessage: async () => ({ conversation: '' })
    });

    const connData = {
      sock,
      qr: null,
      status: 'connecting',
      retryCount: 0
    };

    this.connections.set(bot.id, connData);

    // QR Code event
    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        const qrDataUrl = await qrcode.toDataURL(qr);
        connData.qr = qrDataUrl;
        connData.status = 'qr';
        await db.run('UPDATE whatsapp_bots SET status=?, qr_code=? WHERE id=?', ['qr', qrDataUrl, bot.id]);
        console.log(`[Baileys] QR Code generated for bot ${bot.id}`);
      }

      if (connection === 'close') {
        const isLoggedOut = lastDisconnect?.error?.output?.statusCode === 401;

        if (isLoggedOut) {
          // Session invalid → hapus session files agar bisa scan QR baru
          console.log(`[Baileys] Bot ${bot.id} logged out from device, cleaning session...`);
          const authDir = path.join(__dirname, '../../data/whatsapp-sessions', `bot-${bot.id}`);
          try {
            if (existsSync(authDir)) {
              rmSync(authDir, { recursive: true, force: true });
            }
          } catch (e) {
            console.error(`[Baileys] Failed to clean session for bot ${bot.id}:`, e.message);
          }
          connData.status = 'disconnected';
          await db.run('UPDATE whatsapp_bots SET status=?, qr_code=NULL WHERE id=?', ['disconnected', bot.id]);
          this.connections.delete(bot.id);
        } else if (connData.retryCount < 10) {
          connData.retryCount++;
          const delay = 3000 * connData.retryCount;
          console.log(`[Baileys] Bot ${bot.id} disconnected (attempt ${connData.retryCount}), reconnecting in ${delay}ms...`);
          connData.status = 'connecting';
          setTimeout(() => this.connect(bot, true), delay);
        } else {
          console.log(`[Baileys] Bot ${bot.id} max reconnection attempts reached`);
          connData.status = 'disconnected';
          await db.run('UPDATE whatsapp_bots SET status=?, qr_code=NULL WHERE id=?', ['disconnected', bot.id]);
          this.connections.delete(bot.id);
        }
      } else if (connection === 'open') {
        connData.retryCount = 0;
        connData.status = 'connected';
        connData.qr = null;
        await db.run('UPDATE whatsapp_bots SET status=?, qr_code=NULL WHERE id=?', ['connected', bot.id]);
        console.log(`[Baileys] Bot ${bot.id} connected successfully`);
      }
    });

    // Save credentials
    sock.ev.on('creds.update', saveCreds);

    // Incoming messages
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
      if (type !== 'notify') return;

      for (const msg of messages) {
        if (msg.key.fromMe) continue; // Skip own messages

        let chatId = msg.key.remoteJid;
        if (!chatId || chatId.includes('@g.us')) continue; // Ignore groups for now

        // Normalize device suffix: "628123456789:1@s.whatsapp.net" -> "628123456789"
        if (chatId.includes(':')) {
          chatId = chatId.substring(0, chatId.indexOf(':'));
        } else {
          chatId = chatId.replace('@s.whatsapp.net', '');
        }

        const messageText = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
        const locationMsg = msg.message?.locationMessage;
        const userName = msg.pushName || chatId;

        if (messageText) {
          await handleIncomingMessage(bot.id, chatId, messageText, userName, 'whatsapp');
        } else if (locationMsg) {
          const lat = locationMsg.degreesLatitude;
          const lng = locationMsg.degreesLongitude;
          const locationText = `📍 https://maps.google.com/?q=${lat},${lng}`;
          await handleIncomingMessage(bot.id, chatId, locationText, userName, 'whatsapp');
        }
      }
    });
  }

  async disconnect(botId) {
    const conn = this.connections.get(botId);
    if (conn?.sock) {
      conn.sock?.ev?.removeAllListeners?.();
      conn.sock.end();
      this.connections.delete(botId);
    }
    // Session files tetap ada → reconnect tanpa scan QR ulang
    await db.run('UPDATE whatsapp_bots SET status=?, qr_code=NULL WHERE id=?', ['disconnected', botId]);
    console.log(`[Baileys] Bot ${botId} disconnected (session preserved)`);
  }

  async logout(botId) {
    const conn = this.connections.get(botId);
    if (conn?.sock) {
      try {
        await conn.sock.logout();
      } catch (e) {
        console.log(`[Baileys] Bot ${botId} logout error (ignored):`, e.message);
      }
      conn.sock?.ev?.removeAllListeners?.();
      conn.sock?.end?.();
      this.connections.delete(botId);
    }
    // Hapus session files agar login berikutnya perlu scan QR baru
    const authDir = path.join(__dirname, '../../data/whatsapp-sessions', `bot-${botId}`);
    try {
      if (existsSync(authDir)) {
        rmSync(authDir, { recursive: true, force: true });
        console.log(`[Baileys] Bot ${botId} session files removed`);
      }
    } catch (e) {
      console.error(`[Baileys] Failed to remove session for bot ${botId}:`, e.message);
    }
    await db.run('UPDATE whatsapp_bots SET status=?, qr_code=NULL WHERE id=?', ['disconnected', botId]);
    console.log(`[Baileys] Bot ${botId} logged out`);
  }

  async sendMessage(botId, chatId, message) {
    const conn = this.connections.get(botId);
    if (!conn?.sock) {
      throw new Error('Bot not connected');
    }

    const jid = chatId.includes('@') ? chatId : `${chatId}@s.whatsapp.net`;
    await conn.sock.sendMessage(jid, { text: message });
    return { success: true };
  }

  async getStatus(botId) {
    const conn = this.connections.get(botId);
    return conn?.status || 'disconnected';
  }

  async getQRCode(botId) {
    const conn = this.connections.get(botId);
    return conn?.qr || null;
  }
}
