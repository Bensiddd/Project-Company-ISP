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
    const masked = bots.map(bot => {
      let maskedAiKey = null;
      let maskedApiKey = null;
      try { maskedAiKey = bot.ai_api_key ? maskSecret(decrypt(bot.ai_api_key)) : null; } catch { maskedAiKey = bot.ai_api_key ? '•••• (decrypt error)' : null; }
      try { maskedApiKey = bot.api_key ? maskSecret(decrypt(bot.api_key)) : null; } catch { maskedApiKey = bot.api_key ? '•••• (decrypt error)' : null; }
      return {
        ...bot,
        ai_api_key: maskedAiKey,
        api_key: maskedApiKey,
        qr_code: bot.status === 'qr' ? bot.qr_code : null,
        session_data: undefined
      };
    });

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

    let maskedAiKey = null;
    let maskedApiKey = null;
    try { maskedAiKey = bot.ai_api_key ? maskSecret(decrypt(bot.ai_api_key)) : null; } catch { maskedAiKey = bot.ai_api_key ? '•••• (decrypt error)' : null; }
    try { maskedApiKey = bot.api_key ? maskSecret(decrypt(bot.api_key)) : null; } catch { maskedApiKey = bot.api_key ? '•••• (decrypt error)' : null; }

    res.json({
      ...bot,
      ai_api_key: maskedAiKey,
      api_key: maskedApiKey,
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

    // Send response FIRST — don't block on Baileys connect (can take 10-30s)
    res.json({ id, message: 'Bot created successfully' });

    // THEN auto-connect in background (fire-and-forget)
    if (is_active) {
      setImmediate(async () => {
        try {
          const { getProvider } = await import('../services/whatsapp/provider-factory.js');
          const freshBot = await db.get('SELECT * FROM whatsapp_bots WHERE id=?', [id]);
          const providerInstance = getProvider(freshBot.provider);
          await providerInstance.connect(freshBot);
        } catch (err) {
          console.error('Auto-connect failed:', err);
        }
      });
    }
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

    // Reconnect ONLY if critical connection parameters changed or bot was just enabled
    const providerChanged = provider !== existing.provider;
    const phoneChanged = phone_number !== existing.phone_number;
    const activated = is_active && !existing.is_active;
    const deactivated = !is_active && existing.is_active;

    if (deactivated) {
      const { getProvider } = await import('../services/whatsapp/provider-factory.js');
      const providerInstance = getProvider(existing.provider);
      try {
        await providerInstance.disconnect(req.params.id);
      } catch (err) {
        console.error('Disconnect failed:', err);
      }
    } else if (is_active && (providerChanged || phoneChanged || activated)) {
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

// Toggle bot active/inactive status without fully updating config
router.post('/:id/toggle', authenticate, async (req, res) => {
  try {
    const bot = await db.get('SELECT * FROM whatsapp_bots WHERE id=?', [req.params.id]);
    if (!bot) return res.status(404).json({ message: 'Bot not found' });

    const newActive = bot.is_active ? 0 : 1;
    await db.run(
      'UPDATE whatsapp_bots SET is_active=?, updated_at=CURRENT_TIMESTAMP WHERE id=?',
      [newActive, req.params.id]
    );

    const { getProvider } = await import('../services/whatsapp/provider-factory.js');
    const providerInstance = getProvider(bot.provider);

    if (newActive === 1) {
      // Connect bot (Baileys: session-based connect)
      const freshBot = await db.get('SELECT * FROM whatsapp_bots WHERE id=?', [req.params.id]);
      await providerInstance.connect(freshBot);
    } else {
      // Disconnect bot (preserve session data)
      await providerInstance.disconnect(bot.id);
    }

    await db.logActivity(
      'whatsapp_bot',
      newActive === 1 ? 'Bot WhatsApp diaktifkan' : 'Bot WhatsApp dimatikan',
      `#${req.params.id} ${bot.name}`,
      req.user.id
    );

    res.json({ id: bot.id, is_active: newActive === 1, message: newActive === 1 ? 'Bot diaktifkan' : 'Bot dimatikan' });
  } catch (error) {
    console.error('Toggle WhatsApp bot error:', error);
    res.status(500).json({ message: error.message || 'Failed to toggle bot status' });
  }
});

export default router;
