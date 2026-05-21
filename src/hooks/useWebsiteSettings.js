import { useState, useEffect } from 'react';
import { websiteSettingsAPI } from '../services/api';

let inFlightPromise = null;

export default function useWebsiteSettings() {
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const doFetch = async () => {
      if (!inFlightPromise) {
        inFlightPromise = websiteSettingsAPI.get()
          .then(({ data }) => data && data.id ? data : {})
          .catch((err) => { console.error('useWebsiteSettings fetch failed:', err); return {}; })
          .finally(() => { inFlightPromise = null; });
      }
      const result = await inFlightPromise;
      if (!cancelled) {
        setSettings(result);
        setLoading(false);
      }
    };
    doFetch();
    return () => { cancelled = true; };
  }, []);

  return { settings, loading };
}
