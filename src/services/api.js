import axios from 'axios';

// Create an axios instance
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 60000,
  headers: {
    'Content-Type': 'application/json',
  }
});


// Request interceptor
api.interceptors.request.use(
  (config) => {
    // Get token from localStorage or sessionStorage
    const token = localStorage.getItem('admin_token');
    
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('admin_token');
      localStorage.removeItem('admin_user');
      window.location.href = '/login';
    }
    
    return Promise.reject(error);
  }
);

// Auth endpoints
export const authAPI = {
  login: (credentials) => api.post('/auth/login', credentials),
  register: (userData) => api.post('/auth/register', userData),
  logout: () => api.post('/auth/logout'),
  getCurrentUser: () => api.get('/auth/me')
};

// Admin Users endpoints
export const adminUsersAPI = {
  getAll: () => api.get('/admin-users'),
  getById: (id) => api.get(`/admin-users/${id}`),
  create: (userData) => api.post('/admin-users', userData),
  update: (id, userData) => api.put(`/admin-users/${id}`, userData),
  delete: (id) => api.delete(`/admin-users/${id}`)
};

// Blog Posts endpoints
export const blogPostsAPI = {
  getAll: () => api.get('/blog-posts'),
  getById: (id) => api.get(`/blog-posts/${id}`),
  getBySlug: (slug) => api.get(`/blog-posts/slug/${slug}`),
  create: (postData) => api.post('/blog-posts', postData),
  update: (id, postData) => api.put(`/blog-posts/${id}`, postData),
  delete: (id) => api.delete(`/blog-posts/${id}`)
};

// Service Packages endpoints
export const servicePackagesAPI = {
  getAll: () => api.get('/service-packages'),
  getById: (id) => api.get(`/service-packages/${id}`),
  create: (packageData) => api.post('/service-packages', packageData),
  update: (id, packageData) => api.put(`/service-packages/${id}`, packageData),
  delete: (id) => api.delete(`/service-packages/${id}`)
};

// Coverage Areas endpoints
export const coverageAreasAPI = {
  getAll: () => api.get('/coverage-areas'),
  getById: (id) => api.get(`/coverage-areas/${id}`),
  create: (areaData) => api.post('/coverage-areas', areaData),
  update: (id, areaData) => api.put(`/coverage-areas/${id}`, areaData),
  delete: (id) => api.delete(`/coverage-areas/${id}`)
};

// Clients endpoints
export const clientsAPI = {
  getAll: () => api.get('/clients'),
  getById: (id) => api.get(`/clients/${id}`),
  create: (clientData) => api.post('/clients', clientData),
  update: (id, clientData) => api.put(`/clients/${id}`, clientData),
  delete: (id) => api.delete(`/clients/${id}`)
};

// Testimonials endpoints
export const testimonialsAPI = {
  getAll: () => api.get('/testimonials'),
  getById: (id) => api.get(`/testimonials/${id}`),
  create: (testimonialData) => api.post('/testimonials', testimonialData),
  update: (id, testimonialData) => api.put(`/testimonials/${id}`, testimonialData),
  delete: (id) => api.delete(`/testimonials/${id}`)
};

// Website Settings endpoints
export const websiteSettingsAPI = {
  get: () => api.get('/website-settings'),
  update: (settingsData) => api.put('/website-settings', settingsData)
};

// Contact Messages endpoints
export const contactMessagesAPI = {
  getAll: () => api.get('/contact-messages'),
  getById: (id) => api.get(`/contact-messages/${id}`),
  create: (messageData) => api.post('/contact-messages', messageData),
  update: (id, messageData) => api.put(`/contact-messages/${id}`, messageData),
  delete: (id) => api.delete(`/contact-messages/${id}`)
};

// Tickets endpoints
export const ticketsAPI = {
  getAll: () => api.get('/tickets'),
  getById: (id) => api.get(`/tickets/${id}`),
  create: (ticketData) => api.post('/tickets', ticketData),
  update: (id, ticketData) => api.put(`/tickets/${id}`, ticketData),
  delete: (id) => api.delete(`/tickets/${id}`),
  deleteAll: () => api.delete('/tickets'),
  reply: (id, message) => api.post(`/tickets/${id}/reply`, { message })
};

// Telegram Bots endpoints
export const telegramBotsAPI = {
  getAll: () => api.get('/telegram-bots'),
  getById: (id) => api.get(`/telegram-bots/${id}`),
  create: (botData) => api.post('/telegram-bots', botData),
  update: (id, botData) => api.put(`/telegram-bots/${id}`, botData),
  delete: (id) => api.delete(`/telegram-bots/${id}`)
};

// Telegram actions endpoints
export const telegramAPI = {
  send: (bot_id, chat_id, message) => api.post('/telegram/send', { bot_id, chat_id, message }),
  test: (bot_id) => api.post('/telegram/test', { bot_id }),
  getStatus: (id) => api.get(`/telegram/bots/${id}/status`),
  setWebhook: (bot_id, base_url) => api.post('/telegram/set-webhook', { bot_id, base_url }),
  checkAI: (bot_id) => api.post('/telegram/check-ai', { bot_id }),
  checkAIWithValues: (bot_id, overrides) => api.post('/telegram/check-ai', { bot_id, ...overrides }),
  startPolling: (bot_id) => api.post('/telegram/start-polling', { bot_id }),
  stopPolling: (bot_id) => api.post('/telegram/stop-polling', { bot_id })
};

// Dashboard endpoints
export const dashboardAPI = {
  getStats: () => api.get('/dashboard/stats')
};

// Telegram Conversations endpoints
export const telegramConversationsAPI = {
  getAll: () => api.get('/telegram-conversations'),
  getMessages: (id) => api.get(`/telegram-conversations/${id}/messages`),
  reply: (id, message) => api.post(`/telegram-conversations/${id}/reply`, { message }),
  toggle: (id) => api.post(`/telegram-conversations/${id}/toggle`),
  delete: (id) => api.delete(`/telegram-conversations/${id}`)
};

// Mikrotik endpoints
export const mikrotikAPI = {
  getSettings: () => api.get('/mikrotik/settings'),
  saveSettings: (data) => api.post('/mikrotik/settings', data),
  getStatus: () => api.get('/mikrotik/status'),
  getInterfaces: () => api.get('/mikrotik/interfaces'),
  getTraffic: (iface) => api.get(`/mikrotik/traffic/${encodeURIComponent(iface)}`),
  getLogs: () => api.get('/mikrotik/logs'),
  getPppoe: () => api.get('/mikrotik/pppoe'),
  saveTraffic: (iface, rx, tx) => api.post('/mikrotik/traffic/save', { interface: iface, rx, tx }),
  getTrafficHistory: (iface, range) => api.get(`/mikrotik/traffic/history/${encodeURIComponent(iface)}?range=${range}`)
};

// WhatsApp Bots endpoints
export const whatsappBotsAPI = {
  getAll: () => api.get('/whatsapp-bots'),
  getById: (id) => api.get(`/whatsapp-bots/${id}`),
  create: (botData) => api.post('/whatsapp-bots', botData),
  update: (id, botData) => api.put(`/whatsapp-bots/${id}`, botData),
  delete: (id) => api.delete(`/whatsapp-bots/${id}`),
  toggle: (id) => api.post(`/whatsapp-bots/${id}/toggle`)
};

// WhatsApp actions endpoints
export const whatsappAPI = {
  connect: (bot_id) => api.post('/whatsapp/connect', { bot_id }),
  disconnect: (bot_id) => api.post('/whatsapp/disconnect', { bot_id }),
  getStatus: (id) => api.get(`/whatsapp/bots/${id}/status`),
  getQR: (id) => api.get(`/whatsapp/bots/${id}/qr`),
  test: (bot_id, chat_id, message) => api.post('/whatsapp/test', { bot_id, chat_id, message }),
  setWebhook: (bot_id, webhook_url) => api.post('/whatsapp/set-webhook', { bot_id, webhook_url }),
  checkAI: (bot_id) => api.post('/whatsapp/check-ai', { bot_id }),
  checkAIWithValues: (bot_id, overrides) => api.post('/whatsapp/check-ai', { bot_id, ...overrides })
};

// WhatsApp Conversations endpoints
export const whatsappConversationsAPI = {
  getAll: () => api.get('/whatsapp-conversations'),
  getMessages: (id) => api.get(`/whatsapp-conversations/${id}/messages`),
  reply: (id, message) => api.post(`/whatsapp-conversations/${id}/reply`, { message }),
  toggle: (id) => api.post(`/whatsapp-conversations/${id}/toggle`),
  delete: (id) => api.delete(`/whatsapp-conversations/${id}`)
};

export default api;