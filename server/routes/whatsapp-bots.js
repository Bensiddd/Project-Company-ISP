import { Router } from 'express';
import path from 'path';
import { existsSync, rmSync } from 'fs';
import { fileURLToPath } from 'url';
import db from '../db.js';
import { authenticate } from '../middleware/auth.js';
import { encrypt, decrypt, maskSecret } from '../utils/encryption.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const router = Router();

// Get all WhatsApp bots
router.get('/', authenticate, async (req, res) => {
  try {
    const bots = await db.all('SELECT * FROM whatsapp_bots ORDER BY created_at DESC');
    
    // Mask sensitive data
    const masked = bots.map(bot => ({
      ...bot,
      ai_api_key: bot.ai_api_key ? maskSecret(decrypt(bot.ai_api_key)) : null,
      api_key: bot.api_key ? maskSecret(decrypt(bot.api_key)) : null,
      qr_code: bot.status === 'qr' ? bot.qr_code : null, // Only send QR when needed
      session_data: undefined // Never send session data to frontend
    }));

    res.json(masked);
  } catch (error) {
    console.error('Get WhatsApp bots error:', error);
    res.status(500).json({ message: 'Failed to fetch bots' });
  }
});

// Get single bot
router.get('/:id', authenticate, async (req, res) => {
  try {
    const bot = await db.get('SELECT * FROM whatsapp_bots WHERE id=?', [req.params.id]);
    if (!bot) return res.status(404).json({ message: 'Bot not found' });

    res.json({
      ...bot,
      ai_api_key: bot.ai_api_key ? maskSecret(decrypt(bot.ai_api_key)) : null,
      api_key: bot.api_key ? maskSecret(decrypt(bot.api_key)) : null,
      qr_code: bot.status === 'qr' ? bot.qr_code : null,
      session_data: undefined
    });
  } catch (error) {
    console.error('Get WhatsApp bot error:', error);
    res.status(500).json({ message: 'Failed to fetch bot' });
  }
});

// Create bot
router.post('/', authenticate, async (req, res) => {
  try {
    const { name, phone_number, provider, role, ai_enabled, ai_provider, ai_model, ai_api_key, ai_url, api_key, webhook_url, system_prompt } = req.body;

    if (!name || !phone_number) {
      return res.status(400).json({ message: 'Name and phone number are required' });
    }

    // Encrypt sensitive keys
    const encryptedAIKey = ai_api_key ? encrypt(ai_api_key) : null;
    const encryptedAPIKey = api_key ? encrypt(api_key) : null;

    // Find smallest available ID (reuse gaps from deleted bots)
    const gap = await db.get(
      `SELECT COALESCE(MIN(t.id + 1), 1) AS next_id
       FROM (SELECT id FROM whatsapp_bots UNION SELECT 0) t
       WHERE t.id + 1 NOT IN (SELECT id FROM whatsapp_bots)`
    );
    const id = gap.next_id;

    const is_active = req.body.is_active !== undefined ? req.body.is_active : true;

    await db.run(
      `INSERT INTO whatsapp_bots (id, name, phone_number, provider, role, ai_enabled, ai_provider, ai_model, ai_api_key, ai_url, api_key, webhook_url, system_prompt, is_active, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, name, phone_number, provider || 'baileys', role || 'customer_service', ai_enabled ? 1 : 0, ai_provider, ai_model, encryptedAIKey, ai_url, encryptedAPIKey, webhook_url, system_prompt, is_active ? 1 : 0, 'disconnected']
    );

    await db.logActivity('whatsapp_bot', 'Bot WhatsApp dibuat', `#${id} ${name}`, req.user.id);

    // Auto-connect if active
    if (is_active) {
      const { getProvider } = await import('../services/whatsapp/provider-factory.js');
      const freshBot = await db.get('SELECT * FROM whatsapp_bots WHERE id=?', [id]);
      try {
        const providerInstance = getProvider(freshBot.provider);
        await providerInstance.connect(freshBot);
      } catch (err) {
        console.error('Auto-connect failed:', err);
      }
    }

    res.json({ id, message: 'Bot created successfully' });
  } catch (error) {
    console.error('Create WhatsApp bot error:', error);
    res.status(500).json({ message: 'Failed to create bot' });
  }
});

// Update bot
router.put('/:id', authenticate, async (req, res) => {
  try {
    const { name, phone_number, provider, is_active, role, ai_enabled, ai_provider, ai_model, ai_api_key, ai_url, api_key, webhook_url, system_prompt } = req.body;

    const existing = await db.get('SELECT * FROM whatsapp_bots WHERE id=?', [req.params.id]);
    if (!existing) return res.status(404).json({ message: 'Bot not found' });

    // Only encrypt if new key provided (not masked)
    let encryptedAIKey = existing.ai_api_key;
    if (ai_api_key && !ai_api_key.includes('••••')) {
      encryptedAIKey = encrypt(ai_api_key);
    }

    let encryptedAPIKey = existing.api_key;
    if (api_key && !api_key.includes('••••')) {
      encryptedAPIKey = encrypt(api_key);
    }

    await db.run(
      `UPDATE whatsapp_bots SET name=?, phone_number=?, provider=?, is_active=?, role=?, ai_enabled=?, ai_provider=?, ai_model=?, ai_api_key=?, ai_url=?, api_key=?, webhook_url=?, system_prompt=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`,
      [name, phone_number, provider, is_active ? 1 : 0, role, ai_enabled ? 1 : 0, ai_provider, ai_model, encryptedAIKey, ai_url, encryptedAPIKey, webhook_url, system_prompt, req.params.id]
    );

    await db.logActivity('whatsapp_bot', 'Bot WhatsApp diupdate', `#${req.params.id} ${name}`, req.user.id);

    // Reconnect if provider changed or activated
    if (is_active) {
      const { getProvider } = await import('../services/whatsapp/provider-factory.js');
      const bot = await db.get('SELECT * FROM whatsapp_bots WHERE id=?', [req.params.id]);
      try {
        const providerInstance = getProvider(bot.provider);
        await providerInstance.disconnect(bot.id);
        await providerInstance.connect(bot);
      } catch (err) {
        console.error('Reconnect failed:', err);
      }
    }

    res.json({ message: 'Bot updated successfully' });
  } catch (error) {
    console.error('Update WhatsApp bot error:', error);
    res.status(500).json({ message: 'Failed to update bot' });
  }
});

// Delete bot
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const bot = await db.get('SELECT * FROM whatsapp_bots WHERE id=?', [req.params.id]);
    if (!bot) return res.status(404).json({ message: 'Bot not found' });

    // Disconnect first (full logout to invalidate session)
    const { getProvider } = await import('../services/whatsapp/provider-factory.js');
    try {
      const providerInstance = getProvider(bot.provider);
      await providerInstance.logout(bot.id);
    } catch (err) {
      console.error('Logout failed:', err);
    }

    // Clean up session folder
    const sessionDir = path.join(__dirname, '../data/whatsapp-sessions', `bot-${req.params.id}`);
    if (existsSync(sessionDir)) {
      rmSync(sessionDir, { recursive: true, force: true });
    }

    await db.run('DELETE FROM whatsapp_bots WHERE id=?', [req.params.id]);
    await db.logActivity('whatsapp_bot', 'Bot WhatsApp dihapus', `#${req.params.id} ${bot.name}`, req.user.id);

    res.json({ message: 'Bot deleted successfully' });
  } catch (error) {
    console.error('Delete WhatsApp bot error:', error);
    res.status(500).json({ message: 'Failed to delete bot' });
  }
});

export default router;
