import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { HiCheck, HiChip, HiCode, HiCollection, HiChartBar, HiLightningBolt, HiArrowRight } from 'react-icons/hi';
import { servicePackagesAPI } from '../services/api';
import Particles from '../components/Particles';
import './Services.css';

const iconMap = [HiChip, HiCode, HiChartBar, HiCollection, HiLightningBolt];
const formatPrice = (num) => 'Rp' + Math.round(num).toLocaleString('id-ID');

const Services = () => {
  const [packages, setPackages] = useState([]);

  useEffect(() => {
    servicePackagesAPI.getAll().then(({ data }) => {
      setPackages(data.filter(p => p.is_active));
    }).catch(console.error);
  }, []);

  return (
    <div className="services">
      <section className="page-header">
        <Particles count={40} speed={0.3} />
        <div className="container">
          <h1>Paket Internet MAZNET</h1>
          <p>Pilih paket internet yang sesuai dengan kebutuhan Anda. Dari rumah tangga hingga perusahaan.</p>
        </div>
      </section>

      <section className="page-content">
        <div className="container">
          <motion.div
            className="services-grid"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ staggerChildren: 0.1 }}
          >
            {packages.map(pkg => {
              const Icon = iconMap[pkg.id % iconMap.length];
              return (
                <motion.div
                  key={pkg.id}
                  className={`service-card ${pkg.popular ? 'popular' : ''}`}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4 }}
                  whileHover={{ y: -8 }}
                >
                  {!!pkg.popular && <div className="service-popular-badge">Most Popular</div>}
                  <div className="service-icon-wrap">
                    <Icon />
                  </div>
                  <h3>{pkg.name}</h3>
                  <p className="service-desc">{pkg.description}</p>
                  <div className="service-price">
                    {pkg.type !== 'dedicated' && pkg.price ? (
                      <><span className="price-amount">{formatPrice(pkg.price)}</span>
                      <span className="price-period">/bln</span></>
                    ) : (
                      <span className="price-amount">Hubungi Kami</span>
                    )}
                  </div>
                  <ul className="service-features">
                    <li className="feature-highlight">
                      <HiCheck />
                      <span>Kecepatan: <strong>{pkg.bandwidth}</strong></span>
                    </li>
                    {pkg.features.slice(0, 4).map((f, i) => (
                      <li key={i}>
                        <HiCheck />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                  {pkg.type !== 'dedicated' && pkg.price ? (
                    <Link to="/contact" className={`btn ${pkg.popular ? 'btn-primary' : 'btn-secondary'}`} style={{ width: '100%', textAlign: 'center' }}>
                      Langganan Sekarang <HiArrowRight />
                    </Link>
                  ) : (
                    <Link to="/contact" className="btn btn-primary" style={{ width: '100%', textAlign: 'center' }}>
                      Hubungi Kami <HiArrowRight />
                    </Link>
                  )}
                </motion.div>
              );
            })}
          </motion.div>
        </div>
      </section>
    </div>
  );
};

export default Services;