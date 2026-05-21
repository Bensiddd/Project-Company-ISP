import React from 'react';
import { Link } from 'react-router-dom';
import { HiMail, HiPhone, HiLocationMarker, HiGlobe } from 'react-icons/hi';
import { FaFacebookF, FaTwitter, FaInstagram, FaLinkedinIn } from 'react-icons/fa';
import useWebsiteSettings from '../hooks/useWebsiteSettings';
import './Footer.css';

const Footer = () => {
  const { settings: s } = useWebsiteSettings();

  return (
    <footer className="footer">
      <div className="footer-gradient" />
      <div className="container">
        <div className="footer-grid">
          <div className="footer-brand">
            <div className="footer-logo">
              <div className="footer-logo-icon">
                <HiGlobe size={20} />
              </div>
              <span>{s.company_name || 'MAZNET'}</span>
            </div>
            <p className="footer-desc">{s.description}</p>
            <div className="footer-social">
              <a href={s.facebook_url} target="_blank" rel="noopener noreferrer" className="social-link" aria-label="Facebook"><FaFacebookF /></a>
              <a href={s.twitter_url} target="_blank" rel="noopener noreferrer" className="social-link" aria-label="Twitter"><FaTwitter /></a>
              <a href={s.instagram_url} target="_blank" rel="noopener noreferrer" className="social-link" aria-label="Instagram"><FaInstagram /></a>
              <a href={s.linkedin_url} target="_blank" rel="noopener noreferrer" className="social-link" aria-label="LinkedIn"><FaLinkedinIn /></a>
            </div>
          </div>

          <div className="footer-section">
            <h4>Quick Links</h4>
            <ul>
              <li><Link to="/">Home</Link></li>
              <li><Link to="/about">About</Link></li>
              <li><Link to="/services">Services</Link></li>
              <li><Link to="/blog">Blog</Link></li>
              <li><Link to="/contact">Contact</Link></li>
            </ul>
          </div>

          <div className="footer-section">
            <h4>Layanan</h4>
            <ul>
              <li><Link to="/services">Starter 10 Mbps</Link></li>
              <li><Link to="/services">Professional 50 Mbps</Link></li>
              <li><Link to="/services">Enterprise Dedicated</Link></li>
              <li><Link to="/services">Pasang Baru</Link></li>
            </ul>
          </div>

          <div className="footer-section">
            <h4>Kontak</h4>
            <div className="footer-contact-item">
              <HiLocationMarker />
              <span>{s.address}</span>
            </div>
            <div className="footer-contact-item">
              <HiMail />
              <span>{s.email}</span>
            </div>
            <div className="footer-contact-item">
              <HiPhone />
              <span>{s.phone}</span>
            </div>
          </div>
        </div>

        <div className="footer-bottom">
          <p>&copy; {new Date().getFullYear()} {s.company_name || 'MAZNET'}. All rights reserved.</p>
          <div className="footer-bottom-links">
            <Link to="#">Kebijakan Privasi</Link>
            <Link to="#">Syarat & Ketentuan</Link>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;