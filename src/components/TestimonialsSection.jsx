import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HiStar, HiChevronLeft, HiChevronRight } from 'react-icons/hi';
import { testimonialsAPI } from '../services/api';

const TestimonialsSection = () => {
  const [testimonials, setTestimonials] = useState([]);
  const [current, setCurrent] = useState(0);
  const [direction, setDirection] = useState(0);

  useEffect(() => {
    testimonialsAPI.getAll().then(({ data }) => {
      setTestimonials(data.filter(t => t.is_approved));
    }).catch(console.error);
  }, []);

  const next = useCallback(() => {
    if (!testimonials.length) return;
    setDirection(1);
    setCurrent(c => (c + 1) % testimonials.length);
  }, [testimonials.length]);

  const prev = useCallback(() => {
    if (!testimonials.length) return;
    setDirection(-1);
    setCurrent(c => (c - 1 + testimonials.length) % testimonials.length);
  }, [testimonials.length]);

  useEffect(() => {
    if (testimonials.length <= 1) return;
    const timer = setInterval(next, 5000);
    return () => clearInterval(timer);
  }, [next, testimonials.length]);

  const t = testimonials[current] || testimonials[0];

  const variants = {
    enter: d => ({ x: d > 0 ? 200 : -200, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: d => ({ x: d > 0 ? -200 : 200, opacity: 0 }),
  };

  return (
    <section className="section" style={{ background: 'var(--bg-secondary)' }}>
      <div className="container">
        <div className="section-header">
          <div className="section-label">
            <span>Testimonials</span>
          </div>
          <h2 className="section-title">
            Trusted by <span className="highlight">Industry Leaders</span>
          </h2>
          <p className="section-subtitle">
            Apa kata mereka tentang layanan internet MAZNET? Kepuasan pelanggan adalah prioritas kami.
          </p>
        </div>

        {testimonials.length === 0 ? <p style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No testimonials yet.</p> : <div className="testimonial-carousel">
          <button className="carousel-btn prev" onClick={prev}>
            <HiChevronLeft />
          </button>

          <div className="testimonial-card-wrapper">
            <AnimatePresence mode="wait" custom={direction}>
              <motion.div
                key={current}
                className="testimonial-card"
                custom={direction}
                variants={variants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.3, ease: 'easeInOut' }}
              >
                <div className="testimonial-stars">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <HiStar key={i} className={i < t.rating ? 'star-filled' : 'star-empty'} />
                  ))}
                </div>
                <p className="testimonial-content">"{t.content}"</p>
                <div className="testimonial-author">
                  <div className="author-avatar">
                    {t.author_name.split(' ').map(n => n[0]).join('')}
                  </div>
                  <div>
                    <div className="author-name">{t.author_name}</div>
                    <div className="author-position">{t.author_position}</div>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          <button className="carousel-btn next" onClick={next}>
            <HiChevronRight />
          </button>
        </div>}

        <div className="carousel-dots">
          {testimonials.map((_, i) => (
            <button
              key={i}
              className={`dot ${i === current ? 'active' : ''}`}
              onClick={() => { setDirection(i > current ? 1 : -1); setCurrent(i); }}
            />
          ))}
        </div>
      </div>

      <style>{`
        .testimonial-carousel {
          display: flex;
          align-items: center;
          gap: 24px;
          max-width: 720px;
          margin: 0 auto;
        }
        .carousel-btn {
          flex-shrink: 0;
          width: 48px;
          height: 48px;
          border-radius: 50%;
          border: 1px solid var(--border);
          background: var(--bg-card);
          color: var(--text-primary);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: var(--transition);
        }
        .carousel-btn:hover { background: var(--bg-elevated); border-color: var(--border-hover); }
        .testimonial-card-wrapper { flex: 1; overflow: hidden; min-height: 280px; }
        .testimonial-card {
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: var(--radius-2xl);
          padding: 40px;
          text-align: center;
        }
        .testimonial-stars { display: flex; justify-content: center; gap: 4px; margin-bottom: 20px; }
        .star-filled { color: #f59e0b; font-size: 20px; }
        .star-empty { color: var(--bg-elevated); font-size: 20px; }
        .testimonial-content {
          font-size: 1.125rem;
          line-height: 1.8;
          color: var(--text-secondary);
          margin-bottom: 24px;
          font-style: italic;
        }
        .testimonial-author { display: flex; align-items: center; justify-content: center; gap: 16px; }
        .author-avatar {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          background: var(--gradient-primary);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: 700;
          font-size: 14px;
        }
        .author-name { font-weight: 600; font-size: 15px; color: var(--text-primary); }
        .author-position { font-size: 13px; color: var(--text-muted); }
        .carousel-dots { display: flex; justify-content: center; gap: 8px; margin-top: 32px; }
        .dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          border: none;
          background: var(--bg-elevated);
          cursor: pointer;
          transition: var(--transition);
        }
        .dot.active { background: var(--primary); width: 24px; border-radius: 4px; }
        @media (max-width: 768px) {
          .testimonial-carousel { gap: 12px; }
          .testimonial-card { padding: 24px; }
          .carousel-btn { width: 36px; height: 36px; }
        }
      `}</style>
    </section>
  );
};

export default TestimonialsSection;