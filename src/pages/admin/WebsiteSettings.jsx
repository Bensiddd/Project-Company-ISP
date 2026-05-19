import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { HiSave, HiHome, HiPhone, HiMail, HiGlobe, HiLink, HiCheck } from 'react-icons/hi';
import { websiteSettingsAPI } from '../../services/api';

const initialSettings = {
  company_name: '', tagline: '', description: '', address: '', phone: '', email: '',
  facebook_url: '', twitter_url: '', instagram_url: '', linkedin_url: '', youtube_url: ''
};

const WebsiteSettings = () => {
  const [settings, setSettings] = useState(initialSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const fetch = async () => {
      try {
        const { data } = await websiteSettingsAPI.get();
        if (data && data.id) setSettings(data);
      } catch (err) {
        console.error('Failed to load settings:', err);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, []);

  const handleChange = (e) => setSettings({...settings, [e.target.name]: e.target.value});

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { data } = await websiteSettingsAPI.update(settings);
      setSettings(data);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error('Failed to save settings:', err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div>
        <div className="data-table-header"><h1>Website Settings</h1></div>
        <div className="data-table-skeleton">{[1,2,3,4].map(i => <div key={i} className="skeleton-row"><div className="skeleton-bar" style={{ height: 80 }} /></div>)}</div>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className="data-table-header">
        <div><h1>Website Settings</h1></div>
        <div className="header-actions">
          {saved && <span className="save-success"><HiCheck /> Settings saved!</span>}
          <button className="btn btn-primary" onClick={handleSubmit} disabled={saving}>
            <HiSave /> {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="settings-sections">
          <motion.div className="settings-section" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <div className="settings-section-header"><HiHome /> <h2>Company Information</h2></div>
            <div className="settings-section-body">
              <div className="form-row">
                <div className="form-group"><label>Company Name</label><input type="text" className="form-control" name="company_name" value={settings.company_name || ''} onChange={handleChange} /></div>
                <div className="form-group"><label>Tagline</label><input type="text" className="form-control" name="tagline" value={settings.tagline || ''} onChange={handleChange} /></div>
              </div>
              <div className="form-group"><label>Description</label><textarea className="form-control" rows="3" name="description" value={settings.description || ''} onChange={handleChange} /></div>
            </div>
          </motion.div>

          <motion.div className="settings-section" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <div className="settings-section-header"><HiPhone /> <h2>Contact Information</h2></div>
            <div className="settings-section-body">
              <div className="form-row">
                <div className="form-group"><label>Address</label><input type="text" className="form-control" name="address" value={settings.address || ''} onChange={handleChange} /></div>
                <div className="form-group"><label>Phone</label><input type="text" className="form-control" name="phone" value={settings.phone || ''} onChange={handleChange} /></div>
              </div>
              <div className="form-group"><label>Email</label><input type="email" className="form-control" name="email" value={settings.email || ''} onChange={handleChange} /></div>
            </div>
          </motion.div>

          <motion.div className="settings-section" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <div className="settings-section-header"><HiLink /> <h2>Social Media</h2></div>
            <div className="settings-section-body">
              <div className="form-row">
                <div className="form-group"><label>Facebook URL</label><input type="url" className="form-control" name="facebook_url" value={settings.facebook_url || ''} onChange={handleChange} /></div>
                <div className="form-group"><label>Twitter URL</label><input type="url" className="form-control" name="twitter_url" value={settings.twitter_url || ''} onChange={handleChange} /></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label>Instagram URL</label><input type="url" className="form-control" name="instagram_url" value={settings.instagram_url || ''} onChange={handleChange} /></div>
                <div className="form-group"><label>LinkedIn URL</label><input type="url" className="form-control" name="linkedin_url" value={settings.linkedin_url || ''} onChange={handleChange} /></div>
              </div>
              <div className="form-group"><label>YouTube URL</label><input type="url" className="form-control" name="youtube_url" value={settings.youtube_url || ''} onChange={handleChange} /></div>
            </div>
          </motion.div>
        </div>
      </form>
    </motion.div>
  );
};

export default WebsiteSettings;
