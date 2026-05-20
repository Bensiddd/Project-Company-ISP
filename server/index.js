import { fileURLToPath } from 'url';
import { dirname, resolve, join } from 'path';
import dotenv from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '.env') });

import express from 'express';
import cors from 'cors';
import db from './db.js';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import blogRoutes from './routes/blog.js';
import serviceRoutes from './routes/services.js';
import coverageRoutes from './routes/coverage.js';
import clientRoutes from './routes/clients.js';
import testimonialRoutes from './routes/testimonials.js';
import messageRoutes from './routes/messages.js';
import ticketRoutes from './routes/tickets.js';
import telegramRoutes, { initPolling } from './routes/telegram.js';
import telegramConversationsRoutes from './routes/telegram-conversations.js';
import botSettingsRoutes from './routes/bot-settings.js';
import settingsRoutes from './routes/settings.js';
import dashboardRoutes from './routes/dashboard.js';
import mikrotikRoutes from './routes/mikrotik.js';
import uploadRoutes from './routes/upload.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(join(__dirname, '../uploads')));

app.use('/api/auth', authRoutes);
app.use('/api/admin-users', userRoutes);
app.use('/api/blog-posts', blogRoutes);
app.use('/api/service-packages', serviceRoutes);
app.use('/api/coverage-areas', coverageRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/testimonials', testimonialRoutes);
app.use('/api/contact-messages', messageRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/telegram', telegramRoutes);
app.use('/api/telegram-conversations', telegramConversationsRoutes);
app.use('/api/telegram-bots', botSettingsRoutes);
app.use('/api/website-settings', settingsRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/mikrotik', mikrotikRoutes);
app.use('/api/upload', uploadRoutes);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

db.init().then(() => {
  console.log('Database ready');
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    initPolling().catch(err => console.error('Failed to start polling:', err));
  });
}).catch(err => {
  console.error('Failed to initialize database:', err);
  process.exit(1);
});
