import React, { useEffect, useState, useRef } from 'react';
import { motion, useInView } from 'framer-motion';

const CountUp = ({ end, duration = 2, suffix = '' }) => {
  const [count, setCount] = useState(0);
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });

  useEffect(() => {
    if (!isInView) return;
    let startTime;
    let animationId;

    const animate = (timestamp) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / (duration * 1000), 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.floor(eased * end));

      if (progress < 1) {
        animationId = requestAnimationFrame(animate);
      }
    };

    animationId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationId);
  }, [isInView, end, duration]);

  return <span ref={ref}>{count}{suffix}</span>;
};

const StatsCounter = ({ stats }) => {
  return (
    <div className="stats-grid">
      {stats.map((stat, i) => (
        <motion.div
          key={stat.label}
          className="stat-item"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.1, duration: 0.5 }}
        >
          <div className="stat-value">
            {stat.value.includes('+') ? (
              <>
                <CountUp end={parseInt(stat.value)} suffix="+" />
              </>
            ) : stat.value.includes('%') ? (
              <>
                <CountUp end={parseInt(stat.value)} suffix="%" />
              </>
            ) : (
              <span>{stat.value}</span>
            )}
          </div>
          <div className="stat-label">{stat.label}</div>
        </motion.div>
      ))}
    </div>
  );
};

export default StatsCounter;