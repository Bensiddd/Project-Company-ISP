import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { HiArrowRight, HiLightningBolt, HiGlobe, HiShieldCheck, HiUserGroup, HiMail, HiPhone, HiLocationMarker } from 'react-icons/hi';
import { statsData } from '../data/mockData';
import { blogPostsAPI, coverageAreasAPI, websiteSettingsAPI } from '../services/api';
import Particles from '../components/Particles';
import StatsCounter from '../components/StatsCounter';
import PricingSection from '../components/PricingSection';
import TestimonialsSection from '../components/TestimonialsSection';
import './Home.css';
import './About.css';
import './Contact.css';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
};

const itemVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } }
};

const Home = () => {
  const [blogPosts, setBlogPosts] = useState([]);
  const [coverageAreas, setCoverageAreas] = useState([]);
  const [contactForm, setContactForm] = useState({ name: '', email: '', whatsapp: '', subject: '', message: '' });
  const [contactSent, setContactSent] = useState(false);
  const [contactSending, setContactSending] = useState(false);
  const [homeContact, setHomeContact] = useState({});

  useEffect(() => {
    websiteSettingsAPI.get().then(({ data }) => {
      setHomeContact(data || {});
    }).catch(err => console.error('Home: failed to load settings', err));
  }, []);

  useEffect(() => {
    blogPostsAPI.getAll().then(({ data }) => {
      setBlogPosts(data.filter(p => p.status === 'published').slice(0, 3));
    }).catch(console.error);
    coverageAreasAPI.getAll().then(({ data }) => {
      setCoverageAreas(data.filter(a => a.is_active));
    }).catch(console.error);
  }, []);

  return (
    <div className="home">
      <section id="home" className="hero-section">
        <Particles count={60} speed={0.3} />
        <div className="hero-bg-gradient" />
        <div className="hero-content container">
          <motion.div
            className="hero-badge"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <span className="hero-badge-dot" />
            RT RW NET Terbaik se-Kabupaten Bekasi
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}
          >
            Internet Cepat untuk{' '}
            <span className="text-gradient">Rumah & Bisnis</span>
          </motion.h1>

          <motion.p
            className="hero-description"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.5 }}
          >
            Nikmati koneksi internet fiber optik super cepat dengan harga terjangkau. 
            Dari streaming, gaming, hingga WFH — semua lancar tanpa hambatan. 
            Tersedia di 10+ wilayah Kabupaten Bekasi.
          </motion.p>

          <motion.div
            className="hero-actions"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.5 }}
          >
            <Link to="/register" className="btn btn-primary btn-lg">
              Daftar Sekarang <HiArrowRight />
            </Link>
            <a href="#services" className="btn btn-secondary btn-lg">
              Lihat Paket
            </a>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7, duration: 0.5 }}
          >
            <StatsCounter stats={statsData} />
          </motion.div>
        </div>
      </section>

      <section id="about" className="section about-section-home">
        <div className="container">
          <motion.div
            className="about-story-grid"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <div className="about-story-card">
              <div className="story-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
                </svg>
              </div>
              <h2>Tentang MAZNET</h2>
              <p>
                Berdiri sejak 2020, MAZNET hadir sebagai penyedia layanan internet RT RW NET 
                terpercaya di Kabupaten Bekasi. Kami berkomitmen menghadirkan koneksi internet 
                fiber optik cepat dan stabil dengan harga yang terjangkau untuk rumah, bisnis, 
                dan komunitas.
              </p>
            </div>

            <div className="about-story-card">
              <div className="story-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
                </svg>
              </div>
              <h2>Misi Kami</h2>
              <p>
                Menyediakan akses internet cepat dan andal untuk seluruh masyarakat Kabupaten 
                Bekasi. Kami percaya bahwa internet berkualitas adalah kebutuhan dasar yang 
                harus terjangkau oleh semua kalangan, dari rumah tangga hingga usaha mikro.
              </p>
            </div>
          </motion.div>

          <div className="values-section">
            <div className="section-header">
              <div className="section-label">
                <span>Nilai Kami</span>
              </div>
              <h2 className="section-title">
                Yang Kami <span className="highlight">Utamakan</span>
              </h2>
            </div>

            <motion.div
              className="values-grid"
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ staggerChildren: 0.1 }}
            >
              {[
                { icon: <HiLightningBolt />, title: 'Cepat', desc: 'Koneksi fiber optik super cepat untuk streaming, gaming, dan WFH tanpa hambatan.' },
                { icon: <HiShieldCheck />, title: 'Terpercaya', desc: 'Jaringan stabil dengan uptime 98% dan dukungan teknis 24/7.' },
                { icon: <HiGlobe />, title: 'Terjangkau', desc: 'Harga bersahabat dengan kualitas terbaik. Internet cepat tidak harus mahal.' },
                { icon: <HiUserGroup />, title: 'Komunitas', desc: 'RT RW NET yang peduli dengan kebutuhan internet warga sekitar.' }
              ].map((v, i) => (
                <motion.div
                  key={i}
                  className="value-card"
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  whileHover={{ y: -6 }}
                >
                  <div className="value-card-icon">{v.icon}</div>
                  <h3>{v.title}</h3>
                  <p>{v.desc}</p>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </div>
      </section>

      <section id="coverage" className="section coverage-section">
        <div className="container">
          <div className="section-header">
            <div className="section-label">
              <span>Cakupan Wilayah</span>
            </div>
            <h2 className="section-title">
              Layanan <span className="highlight">Fiber Optik</span>
            </h2>
            <p className="section-subtitle">
              Kami melayani 10+ wilayah di Kabupaten Bekasi dengan jaringan fiber optik berkualitas tinggi.
            </p>
          </div>

          <motion.div
            className="coverage-grid"
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-50px' }}
          >
            {coverageAreas.map(area => (
              <motion.div
                key={area.id}
                className="coverage-card"
                variants={itemVariants}
                whileHover={{ y: -6, scale: 1.02 }}
              >
                <div className="coverage-icon">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/>
                    <path d="M12 2a4 4 0 014 4c0 2-2 3-4 5-2-2-4-3-4-5a4 4 0 014-4z"/>
                    <path d="M12 12v8"/><path d="M8 20h8"/>
                  </svg>
                </div>
                <h3>{area.name}</h3>
                <p>{area.description}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      <section id="services">
        <PricingSection />
      </section>
      <TestimonialsSection />

      <section id="blog" className="section blog-preview-section">
        <div className="container">
          <div className="section-header">
            <div className="section-label">
              <span>Blog</span>
            </div>
            <h2 className="section-title">
              Artikel <span className="highlight">Terbaru</span>
            </h2>
            <p className="section-subtitle">
              Tips, trik, dan informasi seputar internet dan teknologi dari tim MAZNET.
            </p>
          </div>

          <motion.div
            className="blog-grid"
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-50px' }}
          >
            {blogPosts.map(post => (
              <Link key={post.id} to={`/blog/${post.slug}`} style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
                <motion.article
                  className="blog-card"
                  variants={itemVariants}
                  whileHover={{ y: -6 }}
                >
                  <div className="blog-card-image">
                    {post.featured_image_url ? (
                      <img src={post.featured_image_url} alt={post.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <div className="blog-img-placeholder">
                        <span>{post.category[0]}</span>
                      </div>
                    )}
                  </div>
                  <div className="blog-card-content">
                    <div className="blog-meta">
                      <span className="blog-category-badge">{post.category}</span>
                      <span className="blog-read-time">{post.read_time}</span>
                    </div>
                    <h3>{post.title}</h3>
                    <p>{post.excerpt}</p>
                    <div className="blog-card-footer">
                      <span className="btn btn-ghost" style={{ cursor: 'pointer' }}>
                        Baca <HiArrowRight />
                      </span>
                    </div>
                  </div>
                </motion.article>
              </Link>
            ))}
          </motion.div>
        </div>
      </section>

      <section id="contact" className="section contact-section-home">
        <div className="container">
          <div className="section-header">
            <div className="section-label">
              <span>Hubungi Kami</span>
            </div>
            <h2 className="section-title">
              Siap Pasang <span className="highlight">Internet?</span>
            </h2>
            <p className="section-subtitle">
              Tim kami siap membantu Anda dari pukul 08.00 - 20.00. Isi form di bawah atau hubungi kami langsung.
            </p>
          </div>

          <div className="contact-grid">
            <motion.div
              className="contact-info"
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
            >
              <h3 style={{ fontSize: 20, marginBottom: 12 }}>Informasi Kontak</h3>
              <div className="contact-items">
                <div className="contact-info-item">
                  <div className="contact-info-icon"><HiLocationMarker /></div>
                  <div>
                    <h4>Alamat</h4>
                    <p>{homeContact.address || 'Perumahan Grand Wisata, Kab. Bekasi'}</p>
                  </div>
                </div>
                <div className="contact-info-item">
                  <div className="contact-info-icon"><HiMail /></div>
                  <div>
                    <h4>Email</h4>
                    <p>{homeContact.email || 'info@maznet.id'}</p>
                  </div>
                </div>
                <div className="contact-info-item">
                  <div className="contact-info-icon"><HiPhone /></div>
                  <div>
                    <h4>Telepon</h4>
                    <p>{homeContact.phone || '(021) 1234-5678'}</p>
                  </div>
                </div>
              </div>
            </motion.div>

            <motion.div
              className="contact-form-wrap"
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.1 }}
            >
              <h3 style={{ fontSize: 20, marginBottom: 12 }}>Kirim Pesan</h3>
              <form onSubmit={async e => {
                e.preventDefault();
                setContactSending(true);
                try {
                  const { contactMessagesAPI } = await import('../services/api');
                  await contactMessagesAPI.create(contactForm);
                  setContactSent(true);
                  setContactForm({ name: '', email: '', whatsapp: '', subject: '', message: '' });
                } catch (err) { alert('Gagal mengirim. Coba lagi.'); }
                finally { setContactSending(false); }
              }}>
                <div className="form-group">
                  <label className="form-label">Nama</label>
                  <input type="text" name="name" className="form-control" placeholder="Nama Anda" value={contactForm.name} onChange={e => setContactForm({...contactForm, name: e.target.value})} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input type="email" name="email" className="form-control" placeholder="email@anda.com" value={contactForm.email} onChange={e => setContactForm({...contactForm, email: e.target.value})} required />
                </div>
                <div className="form-group">
                  <label className="form-label">No. WhatsApp</label>
                  <input type="text" name="whatsapp" className="form-control" placeholder="0812-xxxx-xxxx (opsional)" value={contactForm.whatsapp} onChange={e => setContactForm({...contactForm, whatsapp: e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label">Subjek</label>
                  <input type="text" name="subject" className="form-control" placeholder="Subjek pesan" value={contactForm.subject} onChange={e => setContactForm({...contactForm, subject: e.target.value})} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Pesan</label>
                  <textarea name="message" className="form-control" rows={4} placeholder="Tulis pesan Anda..." value={contactForm.message} onChange={e => setContactForm({...contactForm, message: e.target.value})} required />
                </div>
                <button type="submit" className="btn btn-primary btn-lg" style={{ width: '100%' }} disabled={contactSending}>
                  {contactSending ? 'Mengirim...' : contactSent ? 'Pesan Terkirim ✓' : 'Kirim Pesan'}
                </button>
              </form>
            </motion.div>
          </div>
        </div>
      </section>


    </div>
  );
};

export default Home;