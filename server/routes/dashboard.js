import { Router } from 'express';
import db from '../db.js';

const router = Router();

router.get('/stats', (_req, res) => {
  const userCount = db.get('SELECT COUNT(*) as count FROM admin_users').count;
  const blogCount = db.get('SELECT COUNT(*) as count FROM blog_posts').count;
  const serviceCount = db.get('SELECT COUNT(*) as count FROM service_packages WHERE is_active = 1').count;
  const messageCount = db.get('SELECT COUNT(*) as count FROM contact_messages').count;
  const clientCount = db.get('SELECT COUNT(*) as count FROM clients WHERE is_active = 1').count;
  const requestCount = db.get("SELECT COUNT(*) as count FROM tickets WHERE type = 'request'").count;
  const avgRating = db.get('SELECT ROUND(AVG(rating), 1) as avg FROM testimonials WHERE is_approved = 1').avg || 0;

  const recentActivity = db.all('SELECT type, action, detail, created_at as time FROM activity_logs ORDER BY created_at DESC LIMIT 20');

  res.json({
    stats: [
      { title: 'Total Users', value: String(userCount), change: '+12%', color: '#6366f1' },
      { title: 'Blog Posts', value: String(blogCount), change: '+4%', color: '#10b981' },
      { title: 'Services', value: String(serviceCount), change: '0%', color: '#f59e0b' },
      { title: 'Request Masuk', value: String(requestCount), change: '-', color: '#3b82f6' },
      { title: 'Messages', value: String(messageCount), change: '+18%', color: '#ef4444' },
      { title: 'Clients', value: String(clientCount), change: '+8%', color: '#8b5cf6' },
      { title: 'Avg. Rating', value: String(avgRating), change: '+2%', color: '#06b6d4' }
    ],
    recentActivity
  });
});

export default router;
