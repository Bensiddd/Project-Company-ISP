import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import FormModal from '../../components/FormModal';
import { HiCheck } from 'react-icons/hi';
import { servicePackagesAPI } from '../../services/api';

const formatIDR = (num) => `Rp${Number(num).toLocaleString('id-ID')}`;

const initialForm = { name: '', description: '', type: 'monthly', price: '', bandwidth: '', features: '', is_active: true, popular: false, is_hidden_price: false };

const ServicePackages = () => {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [saving, setSaving] = useState(false);

  const fetchServices = async () => {
    try {
      const { data } = await servicePackagesAPI.getAll();
      setServices(data);
    } catch (err) {
      console.error('Failed to fetch services:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchServices(); }, []);

  const handleToggle = async (id) => {
    try { const s = services.find(s => s.id === id); const { data } = await servicePackagesAPI.update(id, { ...s, is_active: !s.is_active }); setServices(prev => prev.map(s => s.id === id ? data : s)); } catch (e) { console.error(e); }
  };

  const handleDelete = async (id) => { try { await servicePackagesAPI.delete(id); setServices(prev => prev.filter(s => s.id !== id)); } catch (e) { console.error(e); } };

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const featuresArray = form.features.split(',').map(f => f.trim()).filter(Boolean);
      const payload = { ...form, price: form.is_hidden_price ? 0 : parseFloat(form.price), features: featuresArray, is_active: form.is_active };
      if (editing) {
        const { data } = await servicePackagesAPI.update(editing.id, payload);
        setServices(prev => prev.map(s => s.id === editing.id ? data : s));
      } else {
        const { data } = await servicePackagesAPI.create(payload);
        setServices(prev => [...prev, data]);
      }
      setShowForm(false); setEditing(null); setForm(initialForm);
    } catch (e) { console.error(e); } finally { setSaving(false); }
  };

  if (loading) {
    return (
      <div>
        <div className="data-table-header"><h1>Service Packages</h1></div>
        <div className="data-table-skeleton">{[1,2,3].map(i => <div key={i} className="skeleton-row"><div className="skeleton-bar" style={{ height: 160 }} /></div>)}</div>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className="data-table-header">
        <div><h1>Service Packages</h1><span className="data-table-count">{services.length} packages</span></div>
        <button className="btn btn-primary" onClick={() => { setEditing(null); setForm(initialForm); setShowForm(true); }}>+ Add Package</button>
      </div>

      <div className="service-grid">
        {services.map((svc, i) => (
          <motion.div key={svc.id} className={`service-card ${svc.popular ? 'popular' : ''} ${!svc.is_active ? 'inactive' : ''}`}
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
          >
            {!!svc.popular && <div className="service-popular-badge">Popular</div>}
            <div className="service-card-header">
              <h3>{svc.name}</h3>
              <div className={`toggle-switch ${svc.is_active ? 'on' : 'off'}`} onClick={() => handleToggle(svc.id)}><div className="toggle-thumb" /></div>
            </div>
            <p className="service-card-desc">{svc.description}</p>
            <div className="service-price">
              {svc.price > 0 ? (
                <><span className="price-amount">{formatIDR(svc.price)}</span><span className="price-period">/{svc.type}</span></>
              ) : (
                <span className="price-amount price-hidden">Hubungi Kami</span>
              )}
            </div>
            <div className="service-bandwidth">{svc.bandwidth} bandwidth</div>
            <div className="service-features">
              {(svc.features || []).map((f, j) => (
                <div key={j} className="service-feature"><HiCheck className="feature-icon" />{f}</div>
              ))}
            </div>
            <div className="service-card-actions">
              <button className="btn btn-secondary" onClick={() => { setEditing(svc); setForm({ name: svc.name, description: svc.description, type: svc.type, price: svc.price > 0 ? svc.price.toString() : '', bandwidth: svc.bandwidth, features: (svc.features || []).join(', '), is_active: svc.is_active, popular: svc.popular, is_hidden_price: !svc.price }); setShowForm(true); }}>Edit</button>
              <button className="btn btn-danger" onClick={() => handleDelete(svc.id)}>Delete</button>
            </div>
          </motion.div>
        ))}
      </div>

      <FormModal isOpen={showForm} onClose={() => { setShowForm(false); setEditing(null); setForm(initialForm); }} title={editing ? 'Edit Package' : 'Add Package'} onSubmit={handleSubmit} loading={saving}>
        <div className="form-row">
          <div className="form-group"><label>Package Name</label><input type="text" className="form-control" value={form.name} onChange={e => setForm({...form, name: e.target.value})} required /></div>
          <div className="form-group"><label>Type</label>
            <select className="form-control" value={form.type} onChange={e => setForm({...form, type: e.target.value, is_hidden_price: e.target.value === 'dedicated' ? true : form.is_hidden_price})}>
              <option value="monthly">Monthly</option><option value="yearly">Yearly</option><option value="one-time">One Time</option>
              <option value="dedicated">Dedicated</option>
            </select>
          </div>
        </div>
        <div className="form-group"><label className="checkbox-label"><input type="checkbox" checked={form.is_hidden_price} onChange={e => setForm({...form, is_hidden_price: e.target.checked, price: e.target.checked ? '' : form.price})} /> Rahasiakan Harga (Enterprise/Dedicated)</label></div>
        {!form.is_hidden_price && (
        <div className="form-row">
          <div className="form-group"><label>Price (Rp)</label><input type="number" className="form-control" value={form.price} onChange={e => setForm({...form, price: e.target.value})} required /></div>
          <div className="form-group"><label>Bandwidth</label><input type="text" className="form-control" value={form.bandwidth} onChange={e => setForm({...form, bandwidth: e.target.value})} /></div>
        </div>
        )}
        {form.is_hidden_price && (
        <div className="form-row">
          <div className="form-group" style={{ flex: 1 }}>
            <label>Price</label>
            <p className="form-help-text" style={{ color: 'var(--text-muted)', fontSize: 14, marginTop: 4 }}>Harga akan ditampilkan sebagai <strong>"Hubungi Kami"</strong> di halaman publik.</p>
          </div>
          <div className="form-group"><label>Bandwidth</label><input type="text" className="form-control" value={form.bandwidth} onChange={e => setForm({...form, bandwidth: e.target.value})} /></div>
        </div>
        )}
        <div className="form-group"><label>Description</label><textarea className="form-control" rows="2" value={form.description} onChange={e => setForm({...form, description: e.target.value})} /></div>
        <div className="form-group"><label>Features (comma separated)</label><textarea className="form-control" rows="3" value={form.features} onChange={e => setForm({...form, features: e.target.value})} placeholder="e.g. Basic Analytics, 1 AI Model, Email Support" /></div>
        <div className="form-group"><label className="checkbox-label"><input type="checkbox" checked={form.popular} onChange={e => setForm({...form, popular: e.target.checked})} /> Mark as Popular</label></div>
      </FormModal>
    </motion.div>
  );
};

export default ServicePackages;
