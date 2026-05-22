import mysql from 'mysql2/promise';

let pool;

const api = {
  async init() {
    pool = mysql.createPool({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'maznet',
      port: parseInt(process.env.DB_PORT || '3306'),
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      timezone: 'Z'
    });
    await pool.execute('SET FOREIGN_KEY_CHECKS = 1');
    await pool.execute("SET time_zone = '+00:00'");
  },

  async run(sql, params = []) {
    await pool.execute(sql, params);
  },

  async get(sql, params = []) {
    const [rows] = await pool.execute(sql, params);
    return rows[0] || null;
  },

  async all(sql, params = []) {
    const [rows] = await pool.execute(sql, params);
    return rows;
  },

  async insert(sql, params = []) {
    const [result] = await pool.execute(sql, params);
    return result.insertId;
  },

  async exec(sql) {
    const statements = sql.split(';').map(s => s.trim()).filter(s => s);
    for (const stmt of statements) {
      await pool.execute(stmt);
    }
  },

  async logActivity(type, action, detail, userId) {
    await this.insert('INSERT INTO activity_logs (type, action, detail, user_id) VALUES (?, ?, ?, ?)',
      [type, action, detail || '', userId || null]);
  }
};

export default api;
