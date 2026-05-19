import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { HiCheck, HiArrowRight } from 'react-icons/hi';
import { Link } from 'react-router-dom';
import { servicePackagesAPI } from '../services/api';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.15 }
  }
};

const cardVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } }
};

const PricingSection = () => {
  const [isAnnual, setIsAnnual] = useState(false);
  const [packages, setPackages] = useState([]);

  useEffect(() => {
    servicePackagesAPI.getAll().then(({ data }) => {
      setPackages(data.filter(p => p.is_active));
    }).catch(console.error);
  }, []);

  return (
    <section className="section" id="pricing">
      <div className="container">
        <div className="section-header">
          <div className="section-label">
            <span>Pricing</span>
          </div>
          <h2 className="section-title">
            Pilih Paket <span className="highlight">Internet</span>
          </h2>
          <p className="section-subtitle">
            Pilih paket yang sesuai dengan kebutuhan internet Anda. Dari rumah tangga hingga perusahaan.
          </p>

          <div className="pricing-toggle">
            <span className={!isAnnual ? 'active' : ''}>Monthly</span>
            <button
              className={`toggle-switch ${isAnnual ? 'annual' : ''}`}
              onClick={() => setIsAnnual(!isAnnual)}
            >
              <div className="toggle-thumb" />
            </button>
            <span className={isAnnual ? 'active' : ''}>
              Annual
              <span className="save-badge">Save 20%</span>
            </span>
          </div>
        </div>

        <motion.div
          className="pricing-grid"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-50px' }}
        >
          {packages.map(pkg => {
            return (
              <motion.div
                key={pkg.id}
                className={`pricing-card ${pkg.popular ? 'popular' : ''}`}
                variants={cardVariants}
                whileHover={{ y: -8 }}
              >
                {!!pkg.popular && <div className="popular-badge">Paling Populer</div>}
                <div className="pricing-header">
                  <h3>{pkg.name}</h3>
                  <div className="pricing-amount">
                    {pkg.price ? (
                      <>
                        <span className="currency">Rp</span>
                        <span className="amount">{pkg.price.toLocaleString('id-ID')}</span>
                        <span className="period">/bln</span>
                      </>
                    ) : (
                      <span className="amount" style={{ fontSize: '1.8rem' }}>Custom</span>
                    )}
                  </div>
                  <p className="pricing-desc">{pkg.description}</p>
                </div>
                <div className="pricing-features">
                  <div className="feature-group">
                    <span className="feature-label">Kecepatan</span>
                    <span className="feature-value">{pkg.bandwidth}</span>
                  </div>
                  {pkg.features.map((f, i) => (
                    <div key={i} className="pricing-feature">
                      <HiCheck className="check-icon" />
                      <span>{f}</span>
                    </div>
                  ))}
                </div>
                {pkg.price ? (
                  <a href="#contact" className={`btn ${pkg.popular ? 'btn-primary' : 'btn-secondary'} btn-lg`} style={{ width: '100%', textAlign: 'center' }}>
                    Langganan <HiArrowRight />
                  </a>
                ) : (
                  <a href="#contact" className="btn btn-primary btn-lg" style={{ width: '100%', textAlign: 'center' }}>
                    Hubungi Kami <HiArrowRight />
                  </a>
                )}
              </motion.div>
            );
          })}
        </motion.div>
      </div>

      <style>{`
        .pricing-toggle {
          display: inline-flex;
          align-items: center;
          gap: 12px;
          margin-top: 32px;
          padding: 8px 16px;
          background: var(--bg-card);
          border-radius: 9999px;
          border: 1px solid var(--border);
        }
        .pricing-toggle span { font-size: 14px; font-weight: 500; color: var(--text-muted); transition: var(--transition); cursor: pointer; }
        .pricing-toggle span.active { color: var(--text-primary); }
        .toggle-switch {
          width: 48px;
          height: 26px;
          border-radius: 13px;
          background: var(--bg-elevated);
          border: 1px solid var(--border);
          cursor: pointer;
          position: relative;
          transition: var(--transition);
        }
        .toggle-switch.annual { background: rgba(99, 102, 241, 0.2); border-color: var(--primary); }
        .toggle-thumb {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: var(--text-primary);
          position: absolute;
          top: 2px;
          left: 2px;
          transition: var(--transition);
        }
        .toggle-switch.annual .toggle-thumb { left: 24px; background: var(--primary); }
        .save-badge {
          padding: 2px 8px;
          background: rgba(16, 185, 129, 0.15);
          color: var(--success);
          border-radius: 4px;
          font-size: 11px;
          font-weight: 600;
          margin-left: 4px;
        }
        .pricing-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; align-items: start; }
        .pricing-card {
          background: var(--bg-card);
          border-radius: var(--radius-2xl);
          border: 1px solid var(--border);
          padding: 40px 32px;
          display: flex;
          flex-direction: column;
          position: relative;
          transition: var(--transition);
        }
        .pricing-card.popular { border-color: var(--primary); background: var(--gradient-card); }
        .popular-badge {
          position: absolute;
          top: -12px;
          left: 50%;
          transform: translateX(-50%);
          padding: 6px 20px;
          background: var(--gradient-primary);
          color: white;
          border-radius: 9999px;
          font-size: 12px;
          font-weight: 700;
          white-space: nowrap;
        }
        .pricing-header { text-align: center; margin-bottom: 24px; padding-bottom: 24px; border-bottom: 1px solid var(--border); }
        .pricing-header h3 { font-size: 1.5rem; font-weight: 700; margin-bottom: 16px; }
        .pricing-amount { margin-bottom: 12px; }
        .currency { font-size: 1.25rem; font-weight: 600; vertical-align: top; color: var(--text-muted); }
        .amount { font-size: 3rem; font-weight: 800; line-height: 1; }
        .period { font-size: 1rem; color: var(--text-muted); }
        .pricing-desc { font-size: 14px; color: var(--text-secondary); line-height: 1.6; }
        .pricing-features { flex: 1; margin-bottom: 32px; }
        .feature-group {
          display: flex;
          justify-content: space-between;
          padding: 12px 0;
          border-bottom: 1px solid var(--border);
          margin-bottom: 16px;
        }
        .feature-label { font-size: 13px; color: var(--text-muted); }
        .feature-value { font-size: 13px; font-weight: 600; color: var(--text-primary); }
        .pricing-feature { display: flex; align-items: center; gap: 10px; padding: 8px 0; font-size: 14px; color: var(--text-secondary); }
        .check-icon { color: var(--success); flex-shrink: 0; font-size: 16px; }
        @media (max-width: 1024px) { .pricing-grid { grid-template-columns: 1fr; max-width: 480px; margin: 0 auto; } }
      `}</style>
    </section>
  );
};

export default PricingSection;