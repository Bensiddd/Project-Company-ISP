import 'dotenv/config';
import db from './db.js';
import { encrypt, isEncrypted } from './utils/encryption.js';

const sqls = [
  `CREATE TABLE IF NOT EXISTS coverage_areas (id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(100) NOT NULL, description TEXT, is_active TINYINT(1) DEFAULT 1, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB`,
  `CREATE TABLE IF NOT EXISTS service_packages (id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(100) NOT NULL, description TEXT, type VARCHAR(50) DEFAULT 'monthly', price DECIMAL(10,2) DEFAULT 0, bandwidth VARCHAR(50), features TEXT, is_active TINYINT(1) DEFAULT 1, popular TINYINT(1) DEFAULT 0, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB`,
  `CREATE TABLE IF NOT EXISTS website_settings (id INT AUTO_INCREMENT PRIMARY KEY, company_name VARCHAR(100), tagline VARCHAR(150), description TEXT, address TEXT, phone VARCHAR(20), email VARCHAR(100), logo_url VARCHAR(255), favicon_url VARCHAR(255), facebook_url VARCHAR(255), twitter_url VARCHAR(255), instagram_url VARCHAR(255), linkedin_url VARCHAR(255), youtube_url VARCHAR(255), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB`,
  `CREATE TABLE IF NOT EXISTS admin_users (id INT AUTO_INCREMENT PRIMARY KEY, username VARCHAR(50) UNIQUE NOT NULL, password_hash VARCHAR(255) NOT NULL, email VARCHAR(100) UNIQUE NOT NULL, full_name VARCHAR(100), role VARCHAR(20) DEFAULT 'admin', is_active TINYINT(1) DEFAULT 1, last_login TIMESTAMP, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB`,
  `CREATE TABLE IF NOT EXISTS clients (id INT AUTO_INCREMENT PRIMARY KEY, company_name VARCHAR(100) NOT NULL, contact_person VARCHAR(100), email VARCHAR(100), phone VARCHAR(20), address TEXT, website VARCHAR(255), logo_url VARCHAR(255), industry VARCHAR(50), is_active TINYINT(1) DEFAULT 1, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB`,
  `CREATE TABLE IF NOT EXISTS testimonials (id INT AUTO_INCREMENT PRIMARY KEY, client_id INT, author_name VARCHAR(100) NOT NULL, author_position VARCHAR(100), content TEXT NOT NULL, rating INT CHECK(rating >= 1 AND rating <= 5), is_approved TINYINT(1) DEFAULT 0, published_at TIMESTAMP, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL) ENGINE=InnoDB`,
  `CREATE TABLE IF NOT EXISTS blog_posts (id INT AUTO_INCREMENT PRIMARY KEY, title VARCHAR(200) NOT NULL, slug VARCHAR(200) UNIQUE NOT NULL, excerpt TEXT, content TEXT, category VARCHAR(100), author_id INT, status VARCHAR(20) DEFAULT 'draft', published_at TIMESTAMP, featured_image_url VARCHAR(255), meta_description VARCHAR(255), read_time VARCHAR(20), tags TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (author_id) REFERENCES admin_users(id) ON DELETE SET NULL) ENGINE=InnoDB`,
  `CREATE TABLE IF NOT EXISTS contact_messages (id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(100) NOT NULL, email VARCHAR(100) NOT NULL, phone VARCHAR(20), whatsapp VARCHAR(20), telegram_chat_id VARCHAR(100), subject VARCHAR(150), message TEXT NOT NULL, status VARCHAR(20) DEFAULT 'unread', assigned_to INT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (assigned_to) REFERENCES admin_users(id) ON DELETE SET NULL) ENGINE=InnoDB`,
  `CREATE TABLE IF NOT EXISTS telegram_bots (id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(100) NOT NULL, bot_token VARCHAR(255) NOT NULL, admin_chat_id VARCHAR(100), is_active TINYINT(1) DEFAULT 1, role VARCHAR(20) DEFAULT 'admin', ai_enabled TINYINT(1) DEFAULT 0, ai_provider VARCHAR(50), ai_model VARCHAR(100), ai_api_key VARCHAR(255), ai_url VARCHAR(255), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB`,
  `CREATE TABLE IF NOT EXISTS tickets (id INT AUTO_INCREMENT PRIMARY KEY, contact_message_id INT, telegram_conversation_id INT, type VARCHAR(50) NOT NULL DEFAULT 'maintenance', status VARCHAR(20) DEFAULT 'open' CHECK(status IN ('open', 'in_progress', 'resolved', 'closed')), priority VARCHAR(20) DEFAULT 'checking' CHECK(priority IN ('low', 'medium', 'high', 'checking')), title VARCHAR(200) NOT NULL, description TEXT, assigned_to INT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (contact_message_id) REFERENCES contact_messages(id) ON DELETE SET NULL, FOREIGN KEY (assigned_to) REFERENCES admin_users(id) ON DELETE SET NULL) ENGINE=InnoDB`,
  `CREATE TABLE IF NOT EXISTS ticket_replies (id INT AUTO_INCREMENT PRIMARY KEY, ticket_id INT NOT NULL, admin_id INT, message TEXT NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE, FOREIGN KEY (admin_id) REFERENCES admin_users(id) ON DELETE SET NULL) ENGINE=InnoDB`,
  `CREATE TABLE IF NOT EXISTS telegram_conversations (id INT AUTO_INCREMENT PRIMARY KEY, bot_id INT, chat_id TEXT NOT NULL, user_name TEXT, last_message TEXT, status VARCHAR(20) DEFAULT 'ai', unread INT DEFAULT 0, telegram_username TEXT, user_phone TEXT, state VARCHAR(50) DEFAULT 'idle', pending_data TEXT, cooldown_until TIMESTAMP NULL DEFAULT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, UNIQUE INDEX idx_telegram_convs_unique (bot_id, chat_id(100))) ENGINE=InnoDB`,
  `CREATE TABLE IF NOT EXISTS telegram_messages (id INT AUTO_INCREMENT PRIMARY KEY, conversation_id INT, bot_id INT, chat_id TEXT NOT NULL, role TEXT NOT NULL, message TEXT NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB`,
  `CREATE TABLE IF NOT EXISTS mikrotik_settings (id INT AUTO_INCREMENT PRIMARY KEY, host VARCHAR(100) NOT NULL DEFAULT '', username VARCHAR(100) NOT NULL DEFAULT '', password VARCHAR(500) NOT NULL DEFAULT '', port INT DEFAULT 8728, is_active TINYINT(1) DEFAULT 0, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB`,
  `CREATE TABLE IF NOT EXISTS traffic_history (id INT AUTO_INCREMENT PRIMARY KEY, interface VARCHAR(100) NOT NULL, rx BIGINT DEFAULT 0, tx BIGINT DEFAULT 0, sampled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB`,
  `CREATE TABLE IF NOT EXISTS activity_logs (id INT AUTO_INCREMENT PRIMARY KEY, type VARCHAR(50) NOT NULL, action VARCHAR(200) NOT NULL, detail TEXT, user_id INT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB`,
  `CREATE TABLE IF NOT EXISTS whatsapp_bots (id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(100) NOT NULL, phone_number VARCHAR(20) NOT NULL, provider VARCHAR(20) DEFAULT 'baileys', is_active TINYINT(1) DEFAULT 1, role VARCHAR(20) DEFAULT 'customer_service', ai_enabled TINYINT(1) DEFAULT 0, ai_provider VARCHAR(50), ai_model VARCHAR(100), ai_api_key VARCHAR(1024), ai_url VARCHAR(255), system_prompt TEXT, session_data TEXT, qr_code TEXT, status VARCHAR(20) DEFAULT 'disconnected', webhook_url VARCHAR(255), api_key VARCHAR(255), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB`,
  `CREATE TABLE IF NOT EXISTS whatsapp_conversations (id INT AUTO_INCREMENT PRIMARY KEY, bot_id INT, chat_id VARCHAR(100) NOT NULL, user_name TEXT, last_message TEXT, status VARCHAR(20) DEFAULT 'ai', unread INT DEFAULT 0, user_phone TEXT, state VARCHAR(50) DEFAULT 'idle', pending_data TEXT, cooldown_until TIMESTAMP NULL DEFAULT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, UNIQUE INDEX idx_whatsapp_convs_unique (bot_id, chat_id)) ENGINE=InnoDB`,
  `CREATE TABLE IF NOT EXISTS whatsapp_messages (id INT AUTO_INCREMENT PRIMARY KEY, conversation_id INT, bot_id INT, chat_id VARCHAR(100) NOT NULL, role TEXT NOT NULL, message TEXT NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB`
];

await db.init();
console.log('Running migrations...');
for (const sql of sqls) {
  await db.run(sql);
}

// Add ai_enabled column if it doesn't exist (MySQL 8 compatible)
try {
  await db.run('ALTER TABLE telegram_bots ADD COLUMN ai_enabled TINYINT(1) DEFAULT 0 AFTER role');
} catch (e) {
  if (!e.message.includes('Duplicate column')) console.error('Migration note:', e.message);
}

// Resize state column in telegram_conversations (VARCHAR(20) → VARCHAR(50))
try {
  await db.run('ALTER TABLE telegram_conversations MODIFY COLUMN state VARCHAR(50) DEFAULT \'idle\'');
} catch (e) {
  if (!e.message.includes('Duplicate')) console.error('Migration note:', e.message);
}

// Add cooldown_until column if not exists
try {
  await db.run('ALTER TABLE telegram_conversations ADD COLUMN cooldown_until TIMESTAMP NULL DEFAULT NULL AFTER pending_data');
} catch (e) {
  if (!e.message.includes('Duplicate column')) console.error('Migration note:', e.message);
}

// Add telegram_conversation_id column to tickets if not exists
try {
  await db.run('ALTER TABLE tickets ADD COLUMN telegram_conversation_id INT NULL AFTER contact_message_id');
} catch (e) {
  if (!e.message.includes('Duplicate column')) console.error('Migration note:', e.message);
}

// Add whatsapp_conversation_id column to tickets if not exists
try {
  await db.run('ALTER TABLE tickets ADD COLUMN whatsapp_conversation_id INT NULL AFTER telegram_conversation_id');
} catch (e) {
  if (!e.message.includes('Duplicate column')) console.error('Migration note:', e.message);
}

// Add source column to tickets (telegram/whatsapp)
try {
  await db.run("ALTER TABLE tickets ADD COLUMN source VARCHAR(20) DEFAULT 'manual' AFTER whatsapp_conversation_id");
} catch (e) {
  if (!e.message.includes('Duplicate column')) console.error('Migration note:', e.message);
}

// Add tags column to blog_posts if not exists
try {
  await db.run('ALTER TABLE blog_posts ADD COLUMN tags TEXT AFTER read_time');
} catch (e) {
  if (!e.message.includes('Duplicate column')) console.error('Migration note:', e.message);
}

// Clean up invalid tags (double-stringified or non-JSON values)
try {
  await db.run("UPDATE blog_posts SET tags = NULL WHERE tags IS NOT NULL AND tags != '' AND LEFT(tags, 1) != '['");
} catch (e) {
  console.error('Migration note:', e.message);
}

// Resize ai_api_key to fit AES-GCM ciphertext (base64 IV + tag + content)
try {
  await db.run('ALTER TABLE telegram_bots MODIFY COLUMN ai_api_key VARCHAR(1024)');
} catch (e) {
  console.error('Migration note (ai_api_key resize):', e.message);
}

// Add per-bot system_prompt (editable, falls back to default when empty)
try {
  await db.run('ALTER TABLE telegram_bots ADD COLUMN system_prompt TEXT AFTER ai_url');
} catch (e) {
  if (!e.message.includes('Duplicate column')) console.error('Migration note (system_prompt):', e.message);
}

// Speed up range queries on traffic_history (filter by interface + time)
try {
  await db.run('CREATE INDEX idx_traffic_iface_time ON traffic_history (interface, sampled_at)');
} catch (e) {
  if (!e.message.includes('Duplicate key name')) console.error('Migration note (traffic index):', e.message);
}

// Encrypt existing plaintext ai_api_key values (idempotent: skip if already encrypted)
if (process.env.ENCRYPTION_KEY) {
  try {
    const bots = await db.all('SELECT id, ai_api_key FROM telegram_bots WHERE ai_api_key IS NOT NULL AND ai_api_key != ""');
    let migrated = 0;
    for (const bot of bots) {
      if (!isEncrypted(bot.ai_api_key)) {
        await db.run('UPDATE telegram_bots SET ai_api_key=? WHERE id=?', [encrypt(bot.ai_api_key), bot.id]);
        migrated++;
      }
    }
    if (migrated > 0) console.log(`Encrypted ${migrated} ai_api_key value(s) in telegram_bots.`);
  } catch (e) {
    console.error('AI key encryption migration:', e.message);
  }

  // Re-encrypt mikrotik passwords (current format: base64 → AES-GCM)
  try {
    const settings = await db.all('SELECT id, password FROM mikrotik_settings WHERE password IS NOT NULL AND password != ""');
    let migrated = 0;
    for (const row of settings) {
      if (!isEncrypted(row.password)) {
        const decoded = Buffer.from(row.password, 'base64').toString('utf-8');
        await db.run('UPDATE mikrotik_settings SET password=? WHERE id=?', [encrypt(decoded), row.id]);
        migrated++;
      }
    }
    if (migrated > 0) console.log(`Encrypted ${migrated} password(s) in mikrotik_settings.`);
  } catch (e) {
    console.error('Mikrotik password encryption migration:', e.message);
  }

  // Encrypt existing plaintext ai_api_key values in whatsapp_bots
  try {
    const bots = await db.all('SELECT id, ai_api_key FROM whatsapp_bots WHERE ai_api_key IS NOT NULL AND ai_api_key != ""');
    let migrated = 0;
    for (const bot of bots) {
      if (!isEncrypted(bot.ai_api_key)) {
        await db.run('UPDATE whatsapp_bots SET ai_api_key=? WHERE id=?', [encrypt(bot.ai_api_key), bot.id]);
        migrated++;
      }
    }
    if (migrated > 0) console.log(`Encrypted ${migrated} ai_api_key value(s) in whatsapp_bots.`);
  } catch (e) {
    console.error('WhatsApp AI key encryption migration:', e.message);
  }

  // Encrypt existing plaintext api_key values in whatsapp_bots (for Business API)
  try {
    const bots = await db.all('SELECT id, api_key FROM whatsapp_bots WHERE api_key IS NOT NULL AND api_key != ""');
    let migrated = 0;
    for (const bot of bots) {
      if (!isEncrypted(bot.api_key)) {
        await db.run('UPDATE whatsapp_bots SET api_key=? WHERE id=?', [encrypt(bot.api_key), bot.id]);
        migrated++;
      }
    }
    if (migrated > 0) console.log(`Encrypted ${migrated} api_key value(s) in whatsapp_bots.`);
  } catch (e) {
    console.error('WhatsApp API key encryption migration:', e.message);
  }
} else {
  console.warn('⚠️  ENCRYPTION_KEY not set — skipping encryption migration for ai_api_key and mikrotik password.');
  console.warn('   Add ENCRYPTION_KEY to server/.env then re-run: node migrate.js');
}

console.log('All tables created successfully.');
process.exit(0);
