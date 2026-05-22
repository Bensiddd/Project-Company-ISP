import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import path from 'path';
import { BufferJSON, initAuthCreds } from '@whiskeysockets/baileys';

export async function useSingleFileAuthState(authDir) {
  const filePath = path.join(authDir, 'auth-state.json');
  mkdirSync(authDir, { recursive: true });

  let data;
  if (existsSync(filePath)) {
    data = JSON.parse(readFileSync(filePath, 'utf-8'), BufferJSON.reviver);
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
        writeFileSync(filePath, JSON.stringify(data, BufferJSON.replacer, 2));
      }
    }
  };
}
