/**
 * Abstract WhatsApp Provider Interface
 * Implementasi: BaileysProvider, BusinessAPIProvider
 */

export class WhatsAppProvider {
  /**
   * Initialize connection
   * @param {Object} bot - Bot configuration from database
   * @returns {Promise<void>}
   */
  async connect(bot) {
    throw new Error('connect() must be implemented');
  }

  /**
   * Disconnect
   * @param {number} botId
   * @returns {Promise<void>}
   */
  async disconnect(botId) {
    throw new Error('disconnect() must be implemented');
  }

  /**
   * Full logout (permanently invalidate session, Baileys only)
   * @param {number} botId
   * @returns {Promise<void>}
   */
  async logout(botId) {
    await this.disconnect(botId);
  }

  /**
   * Send message
   * @param {number} botId
   * @param {string} chatId - Phone number with country code (e.g., 628123456789)
   * @param {string} message
   * @returns {Promise<Object>}
   */
  async sendMessage(botId, chatId, message) {
    throw new Error('sendMessage() must be implemented');
  }

  /**
   * Get connection status
   * @param {number} botId
   * @returns {Promise<string>} - 'connected', 'disconnected', 'connecting', 'qr'
   */
  async getStatus(botId) {
    throw new Error('getStatus() must be implemented');
  }

  /**
   * Get QR code for scanning (Baileys only)
   * @param {number} botId
   * @returns {Promise<string|null>} - Base64 QR code or null
   */
  async getQRCode(botId) {
    return null; // Optional, only for Baileys
  }

  /**
   * Set webhook (Business API only)
   * @param {number} botId
   * @param {string} webhookUrl
   * @returns {Promise<Object>}
   */
  async setWebhook(botId, webhookUrl) {
    throw new Error('setWebhook() not supported for this provider');
  }

  /**
   * Handle incoming webhook (Business API only)
   * @param {Object} payload
   * @returns {Promise<void>}
   */
  async handleWebhook(payload) {
    throw new Error('handleWebhook() not supported for this provider');
  }
}
