import { BaileysProvider } from './baileys-provider.js';
import { BusinessAPIProvider } from './business-api-provider.js';

const providers = {
  baileys: new BaileysProvider(),
  'business-api': new BusinessAPIProvider()
};

/**
 * Get WhatsApp provider instance
 * @param {string} providerType - 'baileys' or 'business-api'
 * @returns {WhatsAppProvider}
 */
export function getProvider(providerType = 'baileys') {
  const provider = providers[providerType];
  if (!provider) {
    throw new Error(`Unknown WhatsApp provider: ${providerType}`);
  }
  return provider;
}

/**
 * Initialize all active WhatsApp bots
 */
export async function initializeWhatsAppBots(db) {
  const bots = await db.all('SELECT * FROM whatsapp_bots WHERE is_active=1');
  
  for (const bot of bots) {
    try {
      const provider = getProvider(bot.provider);
      await provider.connect(bot);
      console.log(`[WhatsApp] Bot ${bot.id} (${bot.name}) initialized with ${bot.provider}`);
    } catch (error) {
      console.error(`[WhatsApp] Failed to initialize bot ${bot.id}:`, error.message);
    }
  }
}
