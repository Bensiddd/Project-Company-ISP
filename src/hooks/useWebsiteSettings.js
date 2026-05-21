import { useState, useEffect } from 'react';
import { websiteSettingsAPI } from '../services/api';

let cachedSettings = null;
let cachedPromise = null;

export default function useWebsiteSettings() {
  const [settings, setSettings] = useState(cachedSettings || {});
  const [loading, setLoading] = useState(!cachedSettings);

  useEffect(() => {
    if (cachedSettings) return;
    if (cachedPromise) {
      cachedPromise.then(data => { setSettings(data); setLoading(false); });
      return;
    }
    cachedPromise = websiteSettingsAPI.get().then(({ data }) => {
      const s = data && data.id ? data : {};
      cachedSettings = s;
      setSettings(s);
      setLoading(false);
      return s;
    }).catch(() => {
      setLoading(false);
    });
  }, []);

  return { settings, loading };
}
