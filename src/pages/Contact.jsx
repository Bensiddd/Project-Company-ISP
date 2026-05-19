import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { HiMail, HiPhone, HiLocationMarker, HiCheckCircle } from 'react-icons/hi';
import { contactMessagesAPI } from '../services/api';
import './Contact.css';

const Contact = () => {
  const [formData, setFormData] = useState({ name: '', email: '', whatsapp: '', subject: '', message: '' });
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);

  const handleChange = e => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleSubmit = async e => {
    e.preventDefault();
    setSending(true);
    try {
      await contactMessagesAPI.create(formData);
      setSubmitted(true);
      setFormData({ name: '', email: '', whatsapp: '', subject: '', message: '' });
    } catch (err) {
      console.error('Failed to send message:', err);
      alert('Gagal mengirim pesan. Silakan coba lagi.');
    } finally {
      setSending(false);
    }
  };

  if (submitted) {
    return (
      <div className="contact">
        <section className="page-header">
          <div className="container">
            <h1>Contact Us</h1>
            <p>We'd love to hear from you</p>
          </div>
        </section>
        <section className="page-content">
          <div className="container">
            <motion.div
              className="contact-success"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              <HiCheckCircle className="success-icon" />
              <h2>Thank You!</h2>
              <p>Your message has been sent successfully. We'll get back to you within 24 hours.</p>
              <button className="btn btn-primary" onClick={() => setSubmitted(false)}>
                Send Another Message
              </button>
            </motion.div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="contact">
      <section className="page-header">
        <div className="container">
          <h1>Contact Us</h1>
          <p>We'd love to hear from you</p>
        </div>
      </section>

      <section className="page-content">
        <div className="container">
          <div className="contact-grid">
            <motion.div
              className="contact-info"
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5 }}
            >
              <h2>Get In Touch</h2>
              <p>Have questions about our services or want to schedule a consultation? We're here to help.</p>
              <div className="contact-items">
                <div className="contact-info-item">
                  <div className="contact-info-icon"><HiLocationMarker /></div>
                  <div>
                    <h4>Visit Us</h4>
                    <p>Perumahan Grand Wisata, Kab. Bekasi</p>
                  </div>
                </div>
                <div className="contact-info-item">
                  <div className="contact-info-icon"><HiMail /></div>
                  <div>
                    <h4>Email Us</h4>
                    <p>info@maznet.id</p>
                  </div>
                </div>
                <div className="contact-info-item">
                  <div className="contact-info-icon"><HiPhone /></div>
                  <div>
                    <h4>Call Us</h4>
                    <p>(021) 1234-5678</p>
                  </div>
                </div>
              </div>
            </motion.div>

            <motion.div
              className="contact-form-wrap"
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
            >
              <h2>Send us a Message</h2>
              <form onSubmit={handleSubmit}>
                <div className="form-group">
                  <label className="form-label">Your Name</label>
                  <input type="text" name="name" className="form-control" placeholder="John Doe" value={formData.name} onChange={handleChange} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Email Address</label>
                  <input type="email" name="email" className="form-control" placeholder="you@example.com" value={formData.email} onChange={handleChange} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Subject</label>
                  <input type="text" name="subject" className="form-control" placeholder="How can we help?" value={formData.subject} onChange={handleChange} required />
                </div>
                <div className="form-group">
                  <label className="form-label">No. WhatsApp</label>
                  <input type="text" name="whatsapp" className="form-control" placeholder="0812-xxxx-xxxx (opsional)" value={formData.whatsapp} onChange={handleChange} />
                </div>
                <div className="form-group">
                  <label className="form-label">Message</label>
                  <textarea name="message" className="form-control" rows={5} placeholder="Tell us more about your project..." value={formData.message} onChange={handleChange} required />
                </div>
                <button type="submit" className="btn btn-primary btn-lg" style={{ width: '100%' }} disabled={sending}>
                  {sending ? 'Mengirim...' : 'Send Message'}
                </button>
              </form>
            </motion.div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Contact;