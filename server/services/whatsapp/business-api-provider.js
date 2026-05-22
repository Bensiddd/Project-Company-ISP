import { WhatsAppProvider } from './whatsapp-provider.js';
import { decrypt } from '../../utils/encryption.js';
import { handleIncomingMessage } from './message-handler.js';
import db from '../../db.js';

/**
 * WhatsApp Business API Provider
 * Supports: Twilio, 360dialog, Meta Cloud API, MessageBird
 * 
 * Configuration in whatsapp_bots table:
 * - provider: 'business-api'
 * - api_key: encrypted API key/token
 * - webhook_url: your webhook endpoint
 * - phone_number: WhatsApp Business phone number ID
 */
export class BusinessAPIProvider extends WhatsAppProvider {
  constructor() {
    super();
  }

  async connect(bot) {
    // Business API doesn't need persistent connection
    // Just validate credentials
    try {
      const apiKey = bot.api_key ? decrypt(bot.api_key) : null;
      if (!apiKey) {
        throw new Error('API key not configured');
      }

      // Update status to connected
      await db.run('UPDATE whatsapp_bots SET status=? WHERE id=?', ['connected', bot.id]);
      console.log(`[Business API] Bot ${bot.id} configured successfully`);
    } catch (err) {
      await db.run('UPDATE whatsapp_bots SET status=? WHERE id=?', ['disconnected', bot.id]);
      throw err;
    }
  }

  async disconnect(botId) {
    await db.run('UPDATE whatsapp_bots SET status=? WHERE id=?', ['disconnected', botId]);
    console.log(`[Business API] Bot ${botId} disconnected`);
  }

  async sendMessage(botId, chatId, message) {
    const bot = await db.get('SELECT * FROM whatsapp_bots WHERE id=?', [botId]);
    if (!bot) throw new Error('Bot not found');

    const apiKey = bot.api_key ? decrypt(bot.api_key) : null;
    if (!apiKey) throw new Error('API key not configured');

    // Detect provider type from webhook_url or use Meta Cloud API as default
    const provider = this._detectProvider(bot);

    switch (provider) {
      case 'meta':
        return await this._sendMetaCloudAPI(bot, chatId, message, apiKey);
      case 'twilio':
        return await this._sendTwilio(bot, chatId, message, apiKey);
      case '360dialog':
        return await this._send360Dialog(bot, chatId, message, apiKey);
      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }
  }

  async getStatus(botId) {
    const bot = await db.get('SELECT status FROM whatsapp_bots WHERE id=?', [botId]);
    return bot?.status || 'disconnected';
  }

  async setWebhook(botId, webhookUrl) {
    const bot = await db.get('SELECT * FROM whatsapp_bots WHERE id=?', [botId]);
    if (!bot) throw new Error('Bot not found');

    await db.run('UPDATE whatsapp_bots SET webhook_url=? WHERE id=?', [webhookUrl, botId]);
    
    // Note: Actual webhook registration depends on provider
    // For Meta Cloud API, you set it in Meta Developer Console
    // For Twilio, you set it in Twilio Console
    
    return { success: true, webhook_url: webhookUrl };
  }

  async handleWebhook(payload) {
    // Generic webhook handler - adapt based on provider
    const provider = this._detectProviderFromPayload(payload);

    switch (provider) {
      case 'meta':
        return await this._handleMetaWebhook(payload);
      case 'twilio':
        return await this._handleTwilioWebhook(payload);
      case '360dialog':
        return await this._handle360DialogWebhook(payload);
      default:
        console.error('Unknown webhook provider:', payload);
    }
  }

  // ─── Private Methods ───────────────────────────────────────────────────

  _detectProvider(bot) {
    if (bot.webhook_url?.includes('twilio.com')) return 'twilio';
    if (bot.webhook_url?.includes('360dialog')) return '360dialog';
    return 'meta'; // Default to Meta Cloud API
  }

  _detectProviderFromPayload(payload) {
    if (payload.MessagingServiceSid) return 'twilio';
    if (payload.messages?.[0]?.from?.includes('360dialog')) return '360dialog';
    if (payload.object === 'whatsapp_business_account') return 'meta';
    return 'meta';
  }

  // ─── Meta Cloud API ────────────────────────────────────────────────────

  async _sendMetaCloudAPI(bot, chatId, message, apiKey) {
    const url = `https://graph.facebook.com/v18.0/${bot.phone_number}/messages`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: chatId,
        type: 'text',
        text: { body: message }
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Meta API error: ${error}`);
    }

    return await response.json();
  }

  async _handleMetaWebhook(payload) {
    // Webhook verification
    if (payload.hub?.mode === 'subscribe') {
      return { 'hub.challenge': payload.hub.challenge };
    }

    // Message handling
    const entry = payload.entry?.[0];
    const change = entry?.changes?.[0];
    const message = change?.value?.messages?.[0];

    if (!message) return;

    const chatId = message.from;
    const messageText = message.text?.body || '';
    const userName = change?.value?.contacts?.[0]?.profile?.name || chatId;

    // Find bot by phone_number_id
    const phoneNumberId = change?.value?.metadata?.phone_number_id;
    const bot = await db.get('SELECT id FROM whatsapp_bots WHERE phone_number=? AND provider=?', [phoneNumberId, 'business-api']);

    if (bot && messageText) {
      await handleIncomingMessage(bot.id, chatId, messageText, userName, 'whatsapp');
    }
  }

  // ─── Twilio ────────────────────────────────────────────────────────────

  async _sendTwilio(bot, chatId, message, apiKey) {
    // Twilio format: AccountSID:AuthToken in api_key
    const [accountSid, authToken] = apiKey.split(':');
    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;

    const params = new URLSearchParams({
      From: `whatsapp:${bot.phone_number}`,
      To: `whatsapp:${chatId}`,
      Body: message
    });

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Twilio error: ${error}`);
    }

    return await response.json();
  }

  async _handleTwilioWebhook(payload) {
    const chatId = payload.From?.replace('whatsapp:', '');
    const messageText = payload.Body || '';
    const userName = payload.ProfileName || chatId;

    // Find bot by phone number
    const phoneNumber = payload.To?.replace('whatsapp:', '');
    const bot = await db.get('SELECT id FROM whatsapp_bots WHERE phone_number=? AND provider=?', [phoneNumber, 'business-api']);

    if (bot && messageText) {
      await handleIncomingMessage(bot.id, chatId, messageText, userName, 'whatsapp');
    }
  }

  // ─── 360dialog ─────────────────────────────────────────────────────────

  async _send360Dialog(bot, chatId, message, apiKey) {
    const url = `https://waba.360dialog.io/v1/messages`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'D360-API-KEY': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        to: chatId,
        type: 'text',
        text: { body: message }
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`360dialog error: ${error}`);
    }

    return await response.json();
  }

  async _handle360DialogWebhook(payload) {
    const message = payload.messages?.[0];
    if (!message) return;

    const chatId = message.from;
    const messageText = message.text?.body || '';
    const userName = payload.contacts?.[0]?.profile?.name || chatId;

    // Find bot by webhook or phone
    const bot = await db.get('SELECT id FROM whatsapp_bots WHERE provider=? AND is_active=1 LIMIT 1', ['business-api']);

    if (bot && messageText) {
      await handleIncomingMessage(bot.id, chatId, messageText, userName, 'whatsapp');
    }
  }
}
