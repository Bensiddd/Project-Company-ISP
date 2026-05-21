import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { HiMenu, HiX, HiGlobe } from 'react-icons/hi';
import useWebsiteSettings from '../hooks/useWebsiteSettings';
import './Header.css';

const Header = () => {
  const { settings } = useWebsiteSettings();
  const companyName = settings.company_name || 'MAZNET';
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => { setIsMenuOpen(false); }, [location]);

  const isHome = location.pathname === '/';

  const navItems = [
    { path: '/', label: 'Home', anchor: '#home' },
    { path: '/about', label: 'About', anchor: '#about' },
    { path: '/services', label: 'Services', anchor: '#services' },
    { path: '/blog', label: 'Blog', anchor: '#blog' },
    { path: '/contact', label: 'Contact', anchor: '#contact' },
  ];

  const currentHash = location.hash;

  const isActive = (item) => {
    if (isHome) {
      if (item.path === '/') return currentHash === '' || currentHash === '#home';
      return currentHash === item.anchor;
    }
    return location.pathname === item.path;
  };

  const renderNavLink = (item) => {
    const cls = `nav-link ${isActive(item) ? 'active' : ''}`;
    if (isHome) {
      return <a href={item.anchor} className={cls}>{item.label}</a>;
    }
    return <Link to={item.path} className={cls}>{item.label}</Link>;
  };

  const renderMobileNavLink = (item, i) => {
    const cls = `mobile-nav-link ${isActive(item) ? 'active' : ''}`;
    const link = isHome
      ? <a href={item.anchor} className={cls} onClick={() => setIsMenuOpen(false)}>{item.label}</a>
      : <Link to={item.path} className={cls} onClick={() => setIsMenuOpen(false)}>{item.label}</Link>;
    return (
      <motion.li
        key={item.path}
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: i * 0.05 }}
      >
        {link}
      </motion.li>
    );
  };

  return (
    <header className={`header ${isScrolled ? 'scrolled' : ''}`}>
      <nav className="navbar container">
        <Link to="/" className="logo">
          <div className="logo-icon">
            <HiGlobe size={20} />
          </div>
            <span className="logo-text">{companyName}</span>
        </Link>

        <ul className="nav-links">
          {navItems.map(item => (
            <li key={item.path}>{renderNavLink(item)}</li>
          ))}
        </ul>

        <div className="nav-actions">
          <Link to="/login" className="btn btn-ghost">Masuk</Link>
          <Link to="/register" className="btn btn-primary">Daftar</Link>
          <button
            className="hamburger"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            aria-label="Toggle menu"
          >
            {isMenuOpen ? <HiX size={22} /> : <HiMenu size={22} />}
          </button>
        </div>
      </nav>

      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            className="mobile-drawer"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.2 }}
          >
            <ul className="mobile-nav-links">
              {navItems.map((item, i) => renderMobileNavLink(item, i))}
            </ul>
            <div className="mobile-auth">
              <Link to="/login" className="btn btn-ghost" style={{ width: '100%' }}>Masuk</Link>
              <Link to="/register" className="btn btn-primary" style={{ width: '100%' }}>Daftar</Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
};

export default Header;