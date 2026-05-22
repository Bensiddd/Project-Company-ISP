import React from 'react';
import { motion } from 'framer-motion';
import { HiLightningBolt, HiGlobe, HiShieldCheck, HiUserGroup } from 'react-icons/hi';
import Particles from '../components/Particles';
import './About.css';

export const aboutValues = [
  { icon: <HiLightningBolt />, title: 'Cepat', desc: 'Koneksi fiber optik super cepat untuk streaming, gaming, dan WFH tanpa hambatan.' },
  { icon: <HiShieldCheck />, title: 'Terpercaya', desc: 'Jaringan stabil dengan uptime 98% dan dukungan teknis 24/7.' },
  { icon: <HiGlobe />, title: 'Terjangkau', desc: 'Harga bersahabat dengan kualitas terbaik. Internet cepat tidak harus mahal.' },
  { icon: <HiUserGroup />, title: 'Komunitas', desc: 'RT RW NET yang peduli dengan kebutuhan internet warga sekitar.' }
];

const About = () => {
  return (
    <div className="about">
      <section className="page-header">
        <Particles count={40} speed={0.3} />
        <div className="container">
          <h1>About Us</h1>
          <p>Learn more about our company and mission</p>
        </div>
      </section>

      <section className="page-content">
        <div className="container">
          <motion.div
            className="about-story-grid"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="about-story-card">
              <div className="story-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
                </svg>
              </div>
              <h2>Tentang Kami</h2>
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
              {aboutValues.map((v, i) => (
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
    </div>
  );
};

export default About;