import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { HiUsers, HiPencilAlt, HiChip, HiMail, HiTrendingUp, HiCalendar, HiCheckCircle, HiClock, HiInbox, HiClipboardList, HiChatAlt2, HiShieldCheck } from 'react-icons/hi';
import { dashboardAPI } from '../../services/api';

const AdminOverview = () => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);

  useEffect(() => {
    const fetch = async () => {
      try {
        const { data } = await dashboardAPI.getStats();
        setStats(data.stats);
        setRecentActivity(data.recentActivity);
      } catch (err) {
        console.error('Failed to load dashboard stats:', err);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, []);

  if (loading) {
    return (
      <div className="admin-overview">
        <div className="admin-header"><h1>Dashboard Overview</h1></div>
        <div className="admin-stats-skeleton">
          {[1,2,3,4,5,6].map(i => <div key={i} className="skeleton-stat"><div className="skeleton-bar" style={{ height: 80 }} /></div>)}
        </div>
      </div>
    );
  }

  return (
    <motion.div className="admin-overview" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className="admin-header">
        <div>
          <h1>Dashboard Overview</h1>
          <p className="admin-header-sub">Welcome back! Here's what's happening today.</p>
        </div>
        <div className="admin-header-date">
          <HiCalendar />
          <span>{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</span>
        </div>
      </div>

      <div className="admin-stats">
        {stats.map((stat, i) => {
          const Icon = stat.icon ? React.createElement(stat.icon) : null;
          const icons = [HiUsers, HiPencilAlt, HiChip, HiInbox, HiMail, HiUsers, HiTrendingUp];
          const IconComp = icons[i] || HiTrendingUp;
          return (
            <motion.div key={i} className="stat-card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}>
              <div className="stat-icon" style={{ background: stat.color }}><IconComp /></div>
              <div className="stat-info">
                <h3>{stat.value}</h3>
                <p>{stat.title}</p>
              </div>
              <span className="stat-change" style={{ background: `${stat.color}20`, color: stat.color }}>{stat.change}</span>
            </motion.div>
          );
        })}
      </div>

      <div className="admin-charts">
        <motion.div className="chart-card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <div className="chart-card-header">
            <h2>Recent Activity</h2>
          </div>
          <div className="activity-list">
            {recentActivity.map((act, i) => (
              <motion.div key={i} className="activity-item" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 + i * 0.1 }}>
                <div className={`activity-icon activity-${act.type}`}>
                  {act.type === 'post' ? <HiPencilAlt /> : act.type === 'client' ? <HiUsers /> : act.type === 'testimonial' ? <HiCheckCircle /> : act.type === 'message' ? <HiMail /> : act.type === 'ticket' ? <HiClipboardList /> : act.type === 'telegram' ? <HiChatAlt2 /> : act.type === 'login' ? <HiShieldCheck /> : <HiChip />}
                </div>
                <div className="activity-info">
                  <p className="activity-action">{act.action}</p>
                  <p className="activity-detail">{act.detail}</p>
                </div>
                <span className="activity-time"><HiClock /> {act.time ? new Date(act.time + 'Z').toLocaleDateString() : 'Today'}</span>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
};

export default AdminOverview;
