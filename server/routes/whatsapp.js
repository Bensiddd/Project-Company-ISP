import { Router } from 'express';
import db from '../db.js';
import { authenticate } from '../middleware/auth.js';
import { getProvider } from '../services/whatsapp/provider-factory.js';
import { callAI } from '../services/ai-providers.js';
import { decrypt } from '../utils/encryption.js';

const router = Router();

// Connect bot
router.post('/connect', authenticate, async (req, res) => {
  try {
    const { bot_id } = req.body;
    if (!bot_id) {
      return res.status(400).json({ message: 'bot_id is required' });
    }

    const bot = await db.get('SELECT * FROM whatsapp_bots WHERE id=?', [bot_id]);
    if (!bot) {
      return res.status(404).json({ message: 'Bot not found' });
    }

    const provider = getProvider(bot.provider);
    await provider.connect(bot);

    const status = await provider.getStatus(bot_id);
    const message = status === 'connected' ? 'Bot connected successfully' : 'Bot connecting...';

    await db.logActivity('whatsapp', 'Bot connect initiated', `#${bot_id} ${bot.name}`, req.user.id);

    res.json({ message, status });
  } catch (error) {
    console.error('Connect WhatsApp bot error:', error);
    res.status(500).json({ message: error.message || 'Failed to connect bot' });
  }
});

// Disconnect bot
router.post('/disconnect', authenticate, async (req, res) => {
  try {
    const { bot_id } = req.body;
    if (!bot_id) {
      return res.status(400).json({ message: 'bot_id is required' });
    }

    const bot = await db.get('SELECT * FROM whatsapp_bots WHERE id=?', [bot_id]);
    if (!bot) {
      return res.status(404).json({ message: 'Bot not found' });
    }

    const provider = getProvider(bot.provider);
    await provider.disconnect(bot_id);

    await db.logActivity('whatsapp', 'Bot disconnected', `#${bot_id} ${bot.name}`, req.user.id);

    res.json({ message: 'Bot disconnected successfully' });
  } catch (error) {
    console.error('Disconnect WhatsApp bot error:', error);
    res.status(500).json({ message: error.message || 'Failed to disconnect bot' });
  }
});

// Get bot status
router.get('/bots/:id/status', authenticate, async (req, res) => {
  try {
    const bot = await db.get('SELECT * FROM whatsapp_bots WHERE id=?', [req.params.id]);
    if (!bot) {
      return res.status(404).json({ message: 'Bot not found' });
    }

    const provider = getProvider(bot.provider);
    const status = await provider.getStatus(bot.id);
    const qr = bot.provider === 'baileys' ? await provider.getQRCode(bot.id) : null;

    res.json({ status, qr_code: qr });
  } catch (error) {
    console.error('Get WhatsApp bot status error:', error);
    res.status(500).json({ message: 'Failed to get status' });
  }
});

// Get QR code (Baileys only)
router.get('/bots/:id/qr', authenticate, async (req, res) => {
  try {
    const bot = await db.get('SELECT * FROM whatsapp_bots WHERE id=?', [req.params.id]);
    if (!bot) {
      return res.status(404).json({ message: 'Bot not found' });
    }

    if (bot.provider !== 'baileys') {
      return res.status(400).json({ message: 'QR code only available for Baileys provider' });
    }

    const provider = getProvider(bot.provider);
    const qr = await provider.getQRCode(bot.id);

    res.json({ qr_code: qr });
  } catch (error) {
    console.error('Get QR code error:', error);
    res.status(500).json({ message: 'Failed to get QR code' });
  }
});

// Test send message
router.post('/test', authenticate, async (req, res) => {
  try {
    const { bot_id, chat_id, message } = req.body;
    if (!bot_id || !chat_id) {
      return res.status(400).json({ message: 'bot_id and chat_id are required' });
    }

    const bot = await db.get('SELECT * FROM whatsapp_bots WHERE id=?', [bot_id]);
    if (!bot) {
      return res.status(404).json({ message: 'Bot not found' });
    }

    const provider = getProvider(bot.provider);
    const result = await provider.sendMessage(bot_id, chat_id, message || 'Test message from MAZNET');

    await db.logActivity('whatsapp', 'Test message sent', `Bot #${bot_id} to ${chat_id}`, req.user.id);

    res.json({ success: true, result });
  } catch (error) {
    console.error('Test WhatsApp message error:', error);
    res.status(500).json({ message: error.message || 'Failed to send test message' });
  }
});

// Set webhook (Business API only)
router.post('/set-webhook', authenticate, async (req, res) => {
  try {
    const { bot_id, webhook_url } = req.body;
    if (!bot_id || !webhook_url) {
      return res.status(400).json({ message: 'bot_id and webhook_url are required' });
    }

    const bot = await db.get('SELECT * FROM whatsapp_bots WHERE id=?', [bot_id]);
    if (!bot) {
      return res.status(404).json({ message: 'Bot not found' });
    }

    if (bot.provider !== 'business-api') {
      return res.status(400).json({ message: 'Webhook only available for Business API provider' });
    }

    const provider = getProvider(bot.provider);
    const result = await provider.setWebhook(bot_id, webhook_url);

    await db.logActivity('whatsapp', 'Webhook set', `Bot #${bot_id}: ${webhook_url}`, req.user.id);

    res.json(result);
  } catch (error) {
    console.error('Set webhook error:', error);
    res.status(500).json({ message: error.message || 'Failed to set webhook' });
  }
});

// Webhook endpoint (Business API)
router.post('/webhook/:bot_id', async (req, res) => {
  try {
    const bot = await db.get('SELECT * FROM whatsapp_bots WHERE id=?', [req.params.bot_id]);
    if (!bot || bot.provider !== 'business-api') {
      return res.status(404).json({ message: 'Bot not found or not Business API' });
    }

    const provider = getProvider(bot.provider);
    await provider.handleWebhook(req.body);

    res.json({ success: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ message: 'Webhook processing failed' });
  }
});

// Webhook verification (Meta Cloud API)
router.get('/webhook/:bot_id', async (req, res) => {
  try {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    // Verify token (you should set this in bot config)
    if (mode === 'subscribe' && token === process.env.WEBHOOK_VERIFY_TOKEN) {
      res.status(200).send(challenge);
    } else {
      res.status(403).send('Forbidden');
    }
  } catch (error) {
    console.error('Webhook verification error:', error);
    res.status(500).send('Error');
  }
});

// Check AI (test AI response without sending)
router.post('/check-ai', authenticate, async (req, res) => {
  try {
    const { bot_id, ai_provider, ai_model, ai_api_key, ai_url, test_message } = req.body;

    if (!bot_id) {
      return res.status(400).json({ message: 'bot_id is required' });
    }

    const bot = await db.get('SELECT * FROM whatsapp_bots WHERE id=?', [bot_id]);
    if (!bot) {
      return res.status(404).json({ message: 'Bot not found' });
    }

    // Use provided values or bot's config
    const provider = ai_provider || bot.ai_provider || 'openai';
    const model = ai_model || bot.ai_model || 'gpt-4o-mini';
    const apiKey = ai_api_key || (bot.ai_api_key ? decrypt(bot.ai_api_key) : null);
    const url = ai_url || bot.ai_url;
    const message = test_message || 'Halo, saya ingin tanya tentang paket internet';

    if (!apiKey) {
      return res.status(400).json({ message: 'AI API key not configured' });
    }

    const result = await callAI(provider, model, apiKey, message, url, [], bot.system_prompt);

    res.json({
      success: result.ok,
      response: result.text,
      error: result.error,
      provider,
      model
    });
  } catch (error) {
    console.error('Check AI error:', error);
    res.status(500).json({ message: error.message || 'Failed to check AI' });
  }
});

export default router;
