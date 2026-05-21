import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const KEY_HEX_LENGTH = 64;
const PREFIX = 'enc:';

let cachedKey = null;

function getKey() {
  if (cachedKey) return cachedKey;
  const keyHex = process.env.ENCRYPTION_KEY;
  if (!keyHex) {
    throw new Error(
      'ENCRYPTION_KEY not set in environment. Generate one with:\n' +
      '  node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"\n' +
      'then add it to server/.env as ENCRYPTION_KEY=<hex>'
    );
  }
  if (keyHex.length !== KEY_HEX_LENGTH) {
    throw new Error(`ENCRYPTION_KEY must be ${KEY_HEX_LENGTH} hex characters (32 bytes). Got ${keyHex.length} chars.`);
  }
  cachedKey = Buffer.from(keyHex, 'hex');
  return cachedKey;
}

export function isEncrypted(value) {
  return typeof value === 'string' && value.startsWith(PREFIX);
}

export function encrypt(plaintext) {
  if (plaintext === null || plaintext === undefined || plaintext === '') return '';
  if (isEncrypted(plaintext)) return plaintext;
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return PREFIX + iv.toString('base64') + ':' + tag.toString('base64') + ':' + ciphertext.toString('base64');
}

export function decrypt(value) {
  if (value === null || value === undefined || value === '') return '';
  if (!isEncrypted(value)) return value;
  const parts = value.slice(PREFIX.length).split(':');
  if (parts.length !== 3) throw new Error('Invalid encrypted value format');
  const [ivB64, tagB64, ctB64] = parts;
  const iv = Buffer.from(ivB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');
  const ct = Buffer.from(ctB64, 'base64');
  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(ct), decipher.final()]);
  return plaintext.toString('utf8');
}

export function maskSecret(value) {
  if (!value) return '';
  const s = String(value);
  if (s.length <= 4) return '••••';
  return '••••' + s.slice(-4);
}
