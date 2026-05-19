import db from './db.js';

const sqls = [
  `CREATE TABLE IF NOT EXISTS coverage_areas (id INTEGER PRIMARY KEY AUTOINCREMENT, name VARCHAR(100) NOT NULL, description TEXT, is_active BOOLEAN DEFAULT 1, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE TABLE IF NOT EXISTS service_packages (id INTEGER PRIMARY KEY AUTOINCREMENT, name VARCHAR(100) NOT NULL, description TEXT, type VARCHAR(50) DEFAULT 'monthly', price DECIMAL(10,2) DEFAULT 0, bandwidth VARCHAR(50), features TEXT DEFAULT '[]', is_active BOOLEAN DEFAULT 1, popular BOOLEAN DEFAULT 0, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE TABLE IF NOT EXISTS website_settings (id INTEGER PRIMARY KEY AUTOINCREMENT, company_name VARCHAR(100), tagline VARCHAR(150), description TEXT, address TEXT, phone VARCHAR(20), email VARCHAR(100), logo_url VARCHAR(255), favicon_url VARCHAR(255), facebook_url VARCHAR(255), twitter_url VARCHAR(255), instagram_url VARCHAR(255), linkedin_url VARCHAR(255), youtube_url VARCHAR(255), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE TABLE IF NOT EXISTS admin_users (id INTEGER PRIMARY KEY AUTOINCREMENT, username VARCHAR(50) UNIQUE NOT NULL, password_hash VARCHAR(255) NOT NULL, email VARCHAR(100) UNIQUE NOT NULL, full_name VARCHAR(100), role VARCHAR(20) DEFAULT 'admin', is_active BOOLEAN DEFAULT 1, last_login TIMESTAMP, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE TABLE IF NOT EXISTS clients (id INTEGER PRIMARY KEY AUTOINCREMENT, company_name VARCHAR(100) NOT NULL, contact_person VARCHAR(100), email VARCHAR(100), phone VARCHAR(20), address TEXT, website VARCHAR(255), logo_url VARCHAR(255), industry VARCHAR(50), is_active BOOLEAN DEFAULT 1, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE TABLE IF NOT EXISTS testimonials (id INTEGER PRIMARY KEY AUTOINCREMENT, client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL, author_name VARCHAR(100) NOT NULL, author_position VARCHAR(100), content TEXT NOT NULL, rating INTEGER CHECK(rating >= 1 AND rating <= 5), is_approved BOOLEAN DEFAULT 0, published_at TIMESTAMP, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE TABLE IF NOT EXISTS blog_posts (id INTEGER PRIMARY KEY AUTOINCREMENT, title VARCHAR(200) NOT NULL, slug VARCHAR(200) UNIQUE NOT NULL, excerpt TEXT, content TEXT, category VARCHAR(100), author_id INTEGER REFERENCES admin_users(id) ON DELETE SET NULL, status VARCHAR(20) DEFAULT 'draft', published_at TIMESTAMP, featured_image_url VARCHAR(255), meta_description VARCHAR(255), read_time VARCHAR(20), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE TABLE IF NOT EXISTS contact_messages (id INTEGER PRIMARY KEY AUTOINCREMENT, name VARCHAR(100) NOT NULL, email VARCHAR(100) NOT NULL, phone VARCHAR(20), whatsapp VARCHAR(20), subject VARCHAR(150), message TEXT NOT NULL, status VARCHAR(20) DEFAULT 'unread', assigned_to INTEGER REFERENCES admin_users(id) ON DELETE SET NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE TABLE IF NOT EXISTS telegram_bots (id INTEGER PRIMARY KEY AUTOINCREMENT, name VARCHAR(100) NOT NULL, bot_token VARCHAR(255) NOT NULL, admin_chat_id VARCHAR(100), is_active BOOLEAN DEFAULT 1, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE TABLE IF NOT EXISTS tickets (id INTEGER PRIMARY KEY AUTOINCREMENT, contact_message_id INTEGER REFERENCES contact_messages(id) ON DELETE SET NULL, type VARCHAR(50) NOT NULL DEFAULT 'maintenance', status VARCHAR(20) DEFAULT 'open' CHECK(status IN ('open', 'in_progress', 'resolved', 'closed')), priority VARCHAR(20) DEFAULT 'checking' CHECK(priority IN ('low', 'medium', 'high', 'checking')), title VARCHAR(200) NOT NULL, description TEXT, assigned_to INTEGER REFERENCES admin_users(id) ON DELETE SET NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE TABLE IF NOT EXISTS ticket_replies (id INTEGER PRIMARY KEY AUTOINCREMENT, ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE, admin_id INTEGER REFERENCES admin_users(id) ON DELETE SET NULL, message TEXT NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE TABLE IF NOT EXISTS telegram_conversations (id INTEGER PRIMARY KEY AUTOINCREMENT, bot_id INTEGER, chat_id TEXT NOT NULL, user_name TEXT DEFAULT '', last_message TEXT DEFAULT '', status TEXT DEFAULT 'ai', unread INTEGER DEFAULT 0, telegram_username TEXT DEFAULT '', user_phone TEXT DEFAULT '', created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE TABLE IF NOT EXISTS telegram_messages (id INTEGER PRIMARY KEY AUTOINCREMENT, conversation_id INTEGER, bot_id INTEGER, chat_id TEXT NOT NULL, role TEXT NOT NULL, message TEXT NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE TABLE IF NOT EXISTS mikrotik_settings (id INTEGER PRIMARY KEY AUTOINCREMENT, host VARCHAR(100) NOT NULL DEFAULT '', username VARCHAR(100) NOT NULL DEFAULT '', password TEXT NOT NULL DEFAULT '', port INTEGER DEFAULT 8728, is_active BOOLEAN DEFAULT 0, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE TABLE IF NOT EXISTS traffic_history (id INTEGER PRIMARY KEY AUTOINCREMENT, interface VARCHAR(100) NOT NULL, rx BIGINT DEFAULT 0, tx BIGINT DEFAULT 0, sampled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE TABLE IF NOT EXISTS activity_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, type VARCHAR(50) NOT NULL, action VARCHAR(200) NOT NULL, detail TEXT DEFAULT '', user_id INTEGER, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`
];

db.init().then(() => {
  console.log('Running migrations...');
  sqls.forEach(sql => db.exec(sql));

  // Add whatsapp and telegram_chat_id columns if not exists (safe for existing DBs)
  try { db.run('ALTER TABLE contact_messages ADD COLUMN whatsapp VARCHAR(20)'); } catch (e) {}
  try { db.run('ALTER TABLE contact_messages ADD COLUMN telegram_chat_id VARCHAR(100)'); } catch (e) {}
  // Add bot role columns
  try { db.run("ALTER TABLE telegram_bots ADD COLUMN role VARCHAR(20) DEFAULT 'admin'"); } catch (e) {}
  try { db.run('ALTER TABLE telegram_bots ADD COLUMN ai_provider VARCHAR(50)'); } catch (e) {}
  try { db.run('ALTER TABLE telegram_bots ADD COLUMN ai_model VARCHAR(100)'); } catch (e) {}
  try { db.run('ALTER TABLE telegram_bots ADD COLUMN ai_api_key VARCHAR(255)'); } catch (e) {}
  try { db.run('ALTER TABLE telegram_bots ADD COLUMN ai_url VARCHAR(255)'); } catch (e) {}
  // Add state machine columns for telegram conversations
  try { db.run("ALTER TABLE telegram_conversations ADD COLUMN state TEXT DEFAULT 'idle'"); } catch (e) {}
  try { db.run('ALTER TABLE telegram_conversations ADD COLUMN pending_data TEXT DEFAULT ""'); } catch (e) {}
  // Migration: remove CHECK constraint on tickets.type to allow 'request' (SQLite cannot ALTER CHECK)
  try { db.exec("CREATE TABLE tickets_new (id INTEGER PRIMARY KEY AUTOINCREMENT, contact_message_id INTEGER REFERENCES contact_messages(id) ON DELETE SET NULL, type VARCHAR(50) NOT NULL DEFAULT 'maintenance', status VARCHAR(20) DEFAULT 'open' CHECK(status IN ('open', 'in_progress', 'resolved', 'closed')), priority VARCHAR(20) DEFAULT 'checking' CHECK(priority IN ('low', 'medium', 'high', 'checking')), title VARCHAR(200) NOT NULL, description TEXT, assigned_to INTEGER REFERENCES admin_users(id) ON DELETE SET NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)"); db.exec("INSERT INTO tickets_new SELECT * FROM tickets"); db.exec("DROP TABLE tickets"); db.exec("ALTER TABLE tickets_new RENAME TO tickets"); } catch (e) {}

  // Clean up duplicate conversations before adding unique index
  try { db.exec("DELETE FROM telegram_conversations WHERE id NOT IN (SELECT MIN(id) FROM telegram_conversations GROUP BY bot_id, chat_id)"); } catch (e) {}
  // Unique index to prevent duplicate telegram conversations for same bot+user
  try { db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_telegram_convs_unique ON telegram_conversations(bot_id, chat_id)'); } catch (e) {}

  // Add index for traffic_history queries
  try { db.exec('CREATE INDEX IF NOT EXISTS idx_traffic_history_lookup ON traffic_history(interface, sampled_at)'); } catch (e) {}

  console.log('All tables created successfully.');
  process.exit(0);
});
