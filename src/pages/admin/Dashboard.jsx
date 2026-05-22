import React, { useState, useEffect, useRef } from 'react';
import { Routes, Route, Link, useLocation, useNavigate, Navigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { HiChartBar, HiUsers, HiPencilAlt, HiChip, HiGlobe, HiBriefcase, HiCog, HiMail, HiGlobe as HiGlobeLogo, HiClipboardList, HiChatAlt2, HiLogout, HiChevronDown, HiShieldCheck, HiInbox, HiServer } from 'react-icons/hi';
import AdminOverview from './AdminOverview';
import AdminUsers from './AdminUsers';
import BlogPosts from './BlogPosts';
import BlogEditor from './BlogEditor';
import ServicePackages from './ServicePackages';
import CoverageAreas from './CoverageAreas';
import ClientsTestimonials from './ClientsTestimonials';
import WebsiteSettings from './WebsiteSettings';
import ContactMessages from './ContactMessages';
import TicketManagement from './TicketManagement';
import IncomingRequests from './IncomingRequests';
import TelegramBots from './TelegramBots';
import WhatsAppBots from './WhatsAppBots';
import WhatsAppMessages from './WhatsAppMessages';
import MikrotikMonitor from './MikrotikMonitor';

const routeRoles = {
  '/admin': ['administrator', 'admin', 'teknisi'],
  '/admin/requests': ['administrator', 'admin'],
  '/admin/users': ['administrator'],
  '/admin/blog': ['administrator', 'admin', 'marketing', 'editor'],
  '/admin/services': ['administrator', 'marketing'],
  '/admin/coverage': ['administrator', 'admin', 'marketing'],
  '/admin/clients': ['administrator', 'admin'],
  '/admin/tickets': ['administrator', 'admin', 'cs', 'teknisi'],
  '/admin/messages': ['administrator', 'cs'],
  '/admin/telegram-bots': ['administrator'],
  '/admin/whatsapp-bots': ['administrator'],
  '/admin/whatsapp-messages': ['administrator', 'cs'],
  '/admin/settings': ['administrator', 'admin'],
  '/admin/network': ['administrator']
};

const allNavItems = [
  { path: '/admin', label: 'Overview', icon: HiChartBar, roles: ['administrator'] },
  { path: '/admin/requests', label: 'Request Masuk', icon: HiInbox, roles: ['administrator', 'admin'] },
  { path: '/admin/users', label: 'Admin Users', icon: HiUsers, roles: ['administrator'] },
  { path: '/admin/blog', label: 'Blog Posts', icon: HiPencilAlt, roles: ['administrator', 'admin', 'marketing', 'editor'] },
  { path: '/admin/services', label: 'Service Packages', icon: HiChip, roles: ['administrator', 'marketing'] },
  { path: '/admin/coverage', label: 'Coverage Areas', icon: HiGlobe, roles: ['administrator', 'admin', 'marketing'] },
  { path: '/admin/clients', label: 'Clients & Testimonials', icon: HiBriefcase, roles: ['administrator', 'admin'] },
  { path: '/admin/tickets', label: 'Ticketing', icon: HiClipboardList, roles: ['administrator', 'admin', 'cs', 'teknisi'] },
  { path: '/admin/messages', label: 'Contact Messages', icon: HiMail, roles: ['administrator', 'cs'] },
  { path: '/admin/telegram-bots', label: 'Telegram Bots', icon: HiChatAlt2, roles: ['administrator'] },
  { path: '/admin/whatsapp-bots', label: 'WhatsApp Bots', icon: HiChatAlt2, roles: ['administrator'] },
  { path: '/admin/whatsapp-messages', label: 'WhatsApp Messages', icon: HiMail, roles: ['administrator', 'cs'] },
  { path: '/admin/settings', label: 'Website Settings', icon: HiCog, roles: ['administrator', 'admin'] },
  { path: '/admin/network', label: 'Network Monitor', icon: HiServer, roles: ['administrator'] }
];

const roleConfig = {
  administrator: { label: 'Administrator', color: '#ef4444', bg: 'rgba(239,68,68,0.15)' },
  admin: { label: 'Admin', color: '#6366f1', bg: 'rgba(99,102,241,0.15)' },
  editor: { label: 'Editor', color: '#10b981', bg: 'rgba(16,185,129,0.15)' },
  teknisi: { label: 'Teknisi', color: '#f59e0b', bg: 'rgba(245,158,11,0.15)' },
  cs: { label: 'CS', color: '#8b5cf6', bg: 'rgba(139,92,246,0.15)' },
  marketing: { label: 'Marketing', color: '#06b6d4', bg: 'rgba(6,182,212,0.15)' }
};

const AdminDashboard = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  let currentUser = {};
  try { currentUser = JSON.parse(localStorage.getItem('admin_user') || '{}'); } catch {}
  const userRole = currentUser.role || 'admin';
  const userName = currentUser.full_name || currentUser.username || currentUser.email || 'Admin';
  const userInitial = userName.charAt(0).toUpperCase();
  const roleInfo = roleConfig[userRole] || roleConfig.admin;
  const navItems = allNavItems.filter(item => item.roles.includes(userRole));
  const allowedRoles = routeRoles[location.pathname] || routeRoles['/admin'];
  const isAllowed = allowedRoles.includes(userRole);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_user');
    navigate('/login');
  };

  if (!isAllowed) {
    const fallback = navItems[0]?.path || '/admin';
    return <Navigate to={fallback} replace />;
  }

  return (
    <div className="admin-dashboard">
      <div className="admin-container">
        <aside className="admin-sidebar">
          <div className="admin-sidebar-header">
            <div className="admin-sidebar-logo">
              <HiGlobeLogo size={20} />
            </div>
            <h2>Admin Panel</h2>
          </div>
          <nav>
            <ul>
              {navItems.map(item => {
                const isActive = location.pathname === item.path;
                const Icon = item.icon;
                return (
                  <li key={item.path}>
                    <Link to={item.path} className={isActive ? 'active' : ''}>
                      <Icon />
                      <span>{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        </aside>

        <main className="admin-main">
          <div className="admin-topbar">
            <div className="admin-topbar-left">
              <HiShieldCheck size={18} style={{ color: 'var(--primary)', opacity: 0.6 }} />
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                {location.pathname === '/admin' ? 'Overview' : location.pathname === '/admin/messages' ? 'Telegram Messages' : location.pathname.replace('/admin/', '').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
              </span>
            </div>
            <div className="admin-topbar-right" ref={dropdownRef}>
              <div className="admin-user-trigger" onClick={() => setDropdownOpen(!dropdownOpen)}>
                <div className="admin-user-avatar" style={{ background: 'var(--gradient-primary)' }}>
                  {userInitial}
                </div>
                <div className="admin-user-info">
                  <div className="admin-user-name">{userName}</div>
                  <div className="admin-user-meta">
                    <span className="online-dot" />
                    <span className="admin-user-role" style={{ background: roleInfo.bg, color: roleInfo.color }}>
                      {roleInfo.label}
                    </span>
                  </div>
                </div>
                <HiChevronDown size={14} className={`admin-chevron ${dropdownOpen ? 'open' : ''}`} />
              </div>

              <AnimatePresence>
                {dropdownOpen && (
                  <motion.div
                    className="admin-dropdown-menu"
                    initial={{ opacity: 0, y: -8, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -8, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                  >
                    <div className="dropdown-user-info">
                      <div className="dropdown-user-avatar" style={{ background: 'var(--gradient-primary)' }}>
                        {userInitial}
                      </div>
                      <div>
                        <div className="dropdown-user-name">{userName}</div>
                        <div className="dropdown-user-email">{currentUser.email || ''}</div>
                        <span className="admin-user-role" style={{ background: roleInfo.bg, color: roleInfo.color, marginTop: 6, display: 'inline-block' }}>
                          {roleInfo.label}
                        </span>
                      </div>
                    </div>
                    <div className="dropdown-divider" />
                    <button className="dropdown-logout" onClick={handleLogout}>
                      <HiLogout size={16} />
                      Logout
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          <Routes>
            <Route path="" element={<AdminOverview />} />
            <Route path="users" element={<AdminUsers />} />
            <Route path="blog" element={<BlogPosts />} />
            <Route path="blog/editor" element={<BlogEditor />} />
            <Route path="blog/editor/:id" element={<BlogEditor />} />
            <Route path="services" element={<ServicePackages />} />
            <Route path="coverage" element={<CoverageAreas />} />
            <Route path="clients" element={<ClientsTestimonials />} />
            <Route path="settings" element={<WebsiteSettings />} />
            <Route path="messages" element={<ContactMessages />} />
            <Route path="tickets" element={<TicketManagement />} />
            <Route path="requests" element={<IncomingRequests />} />
            <Route path="telegram-bots" element={<TelegramBots />} />
            <Route path="whatsapp-bots" element={<WhatsAppBots />} />
            <Route path="whatsapp-messages" element={<WhatsAppMessages />} />
            <Route path="network" element={<MikrotikMonitor />} />
          </Routes>
        </main>
      </div>
    </div>
  );
};

export default AdminDashboard;