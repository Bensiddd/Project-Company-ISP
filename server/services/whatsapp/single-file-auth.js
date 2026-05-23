import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import path from 'path';
import { BufferJSON, initAuthCreds } from '@whiskeysockets/baileys';

export async function useSingleFileAuthState(authDir) {
  const filePath = path.join(authDir, 'auth-state.json');
  mkdirSync(authDir, { recursive: true });

  let data;
  if (existsSync(filePath)) {
    const raw = JSON.parse(readFileSync(filePath, 'utf-8'), BufferJSON.reviver);
    // If wrapping in _summary layout, extract original data structures
    if (raw.creds && raw.keys) {
      data = { creds: raw.creds, keys: raw.keys };
    } else {
      data = raw;
    }
  } else {
    // Migrate from old multi-file format if exists
    const oldCredsPath = path.join(authDir, 'creds.json');
    if (existsSync(oldCredsPath)) {
      data = { creds: JSON.parse(readFileSync(oldCredsPath, 'utf-8'), BufferJSON.reviver), keys: {} };
    } else {
      data = { creds: initAuthCreds(), keys: {} };
    }
  }

  return {
    state: {
      creds: data.creds,
      keys: {
        get: async (type, ids) => {
          const result = {};
          for (const id of ids) {
            result[id] = data.keys[`${type}:${id}`] || null;
          }
          return result;
        },
        set: async (entries) => {
          for (const category in entries) {
            for (const id in entries[category]) {
              const value = entries[category][id];
              const key = `${category}:${id}`;
              if (value === null) {
                delete data.keys[key];
              } else {
                data.keys[key] = value;
              }
            }
          }
        }
      }
    },
    saveCreds: () => {
      if (data.creds) {
        const summary = {
          _note: 'Auto-generated. Do not edit manually.',
          phone: data.creds.me?.id?.split(':')[0]?.split('@')[0] || null,
          name: data.creds.me?.name || null,
          platform: data.creds.platform || null,
          registered: data.creds.registered || false,
          registrationId: data.creds.registrationId || null,
          preKeysCount: Object.keys(data.keys || {}).filter(k => k.startsWith('pre-key:')).length,
          lastSync: data.creds.lastAccountSyncTimestamp
            ? new Date(data.creds.lastAccountSyncTimestamp * 1000).toISOString()
            : null,
          updatedAt: new Date().toISOString()
        };
        const output = { _summary: summary, creds: data.creds, keys: data.keys || {} };
        writeFileSync(filePath, JSON.stringify(output, BufferJSON.replacer, 2));
      }
    }
  };
}
