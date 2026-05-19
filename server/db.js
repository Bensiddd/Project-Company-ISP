import initSqlJs from 'sql.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, 'data', 'database.sqlite');

let _db = null;
let _SQL = null;

function save() {
  const data = _db.export();
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

function paramArr(params) {
  return params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
}

const api = {
  async init() {
    _SQL = await initSqlJs();
    if (fs.existsSync(DB_PATH)) {
      _db = new _SQL.Database(fs.readFileSync(DB_PATH));
    } else {
      _db = new _SQL.Database();
      const dir = path.dirname(DB_PATH);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    }
    _db.run('PRAGMA foreign_keys = ON');
  },

  run(sql, params = []) {
    _db.run(sql, params);
    save();
  },

  get(sql, params = []) {
    const stmt = _db.prepare(sql);
    stmt.bind(paramArr([params]));
    let row = null;
    if (stmt.step()) {
      const cols = stmt.getColumnNames();
      const vals = stmt.get();
      row = {};
      cols.forEach((c, i) => { row[c] = vals[i]; });
    }
    stmt.free();
    return row;
  },

  all(sql, params = []) {
    const stmt = _db.prepare(sql);
    stmt.bind(paramArr([params]));
    const rows = [];
    while (stmt.step()) {
      const cols = stmt.getColumnNames();
      const vals = stmt.get();
      const row = {};
      cols.forEach((c, i) => { row[c] = vals[i]; });
      rows.push(row);
    }
    stmt.free();
    return rows;
  },

  insert(sql, params = []) {
    _db.run(sql, params);
    const id = _db.exec("SELECT last_insert_rowid() as id");
    const lastId = id?.[0]?.values?.[0]?.[0] ?? null;
    save();
    return lastId;
  },

  exec(sql) {
    _db.run(sql);
    save();
  },

  logActivity(type, action, detail, userId) {
    this.insert('INSERT INTO activity_logs (type, action, detail, user_id) VALUES (?, ?, ?, ?)', [type, action, detail || '', userId || null]);
  }
};

export default api;
