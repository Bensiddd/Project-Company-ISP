import { Router } from 'express';
import db from '../db.js';
import { authenticate, optionalAuth } from '../middleware/auth.js';

const router = Router();

router.get('/', optionalAuth, (_req, res) => {
  const settings = db.get('SELECT * FROM website_settings WHERE id = 1');
  res.json(settings || {});
});

router.put('/', authenticate, (req, res) => {
  const { company_name, tagline, description, address, phone, email, logo_url, favicon_url, facebook_url, twitter_url, instagram_url, linkedin_url, youtube_url } = req.body;
  const existing = db.get('SELECT id FROM website_settings WHERE id = 1');
  if (existing) {
    db.run(
      'UPDATE website_settings SET company_name=?, tagline=?, description=?, address=?, phone=?, email=?, logo_url=?, favicon_url=?, facebook_url=?, twitter_url=?, instagram_url=?, linkedin_url=?, youtube_url=?, updated_at=CURRENT_TIMESTAMP WHERE id=1',
      [company_name || '', tagline || '', description || '', address || '', phone || '', email || '', logo_url || '', favicon_url || '', facebook_url || '', twitter_url || '', instagram_url || '', linkedin_url || '', youtube_url || '']
    );
  } else {
    db.insert(
      'INSERT INTO website_settings (company_name, tagline, description, address, phone, email, logo_url, favicon_url, facebook_url, twitter_url, instagram_url, linkedin_url, youtube_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [company_name || '', tagline || '', description || '', address || '', phone || '', email || '', logo_url || '', favicon_url || '', facebook_url || '', twitter_url || '', instagram_url || '', linkedin_url || '', youtube_url || '']
    );
  }
  res.json(db.get('SELECT * FROM website_settings WHERE id = 1'));
});

export default router;
