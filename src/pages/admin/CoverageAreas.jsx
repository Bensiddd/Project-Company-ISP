import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import FormModal from '../../components/FormModal';
import { HiGlobe, HiTrash, HiPencil } from 'react-icons/hi';
import { coverageAreasAPI } from '../../services/api';

const initialForm = { name: '', description: '', is_active: true };

const CoverageAreas = () => {
  const [areas, setAreas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [saving, setSaving] = useState(false);

  const fetchAreas = async () => {
    try {
      const { data } = await coverageAreasAPI.getAll();
      setAreas(data);
    } catch (err) {
      console.error('Failed to fetch areas:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAreas(); }, []);

  const handleToggle = async (id) => { try { const a = areas.find(a => a.id === id); const { data } = await coverageAreasAPI.update(id, { ...a, is_active: !a.is_active }); setAreas(prev => prev.map(a => a.id === id ? data : a)); } catch (e) { console.error(e); } };
  const handleDelete = async (id) => { try { await coverageAreasAPI.delete(id); setAreas(prev => prev.filter(a => a.id !== id)); } catch (e) { console.error(e); } };

  const handleSubmit = async () => {
    setSaving(true);
    try {
      if (editing) {
        const { data } = await coverageAreasAPI.update(editing.id, form);
        setAreas(prev => prev.map(a => a.id === editing.id ? data : a));
      } else {
        const { data } = await coverageAreasAPI.create(form);
        setAreas(prev => [...prev, data]);
      }
      setShowForm(false); setEditing(null); setForm(initialForm);
    } catch (e) { console.error(e); } finally { setSaving(false); }
  };

  if (loading) {
    return (
      <div>
        <div className="data-table-header"><h1>Coverage Areas</h1></div>
        <div className="data-table-skeleton">{[1,2,3].map(i => <div key={i} className="skeleton-row"><div className="skeleton-bar" style={{ height: 100 }} /></div>)}</div>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className="data-table-header">
        <div><h1>Coverage Areas</h1><span className="data-table-count">{areas.length} areas</span></div>
        <button className="btn btn-primary" onClick={() => { setEditing(null); setForm(initialForm); setShowForm(true); }}>+ Add Area</button>
      </div>

      <div className="coverage-grid">
        {areas.map((area, i) => (
          <motion.div key={area.id} className={`coverage-card ${!area.is_active ? 'inactive' : ''}`}
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
          >
            <div className="coverage-icon"><HiGlobe /></div>
            <div className="coverage-content">
              <div className="coverage-top">
                <h3>{area.name}</h3>
                <div className={`toggle-switch sm ${area.is_active ? 'on' : 'off'}`} onClick={() => handleToggle(area.id)}><div className="toggle-thumb" /></div>
              </div>
              <p>{area.description}</p>
            </div>
            <div className="coverage-actions">
              <button className="btn-icon" onClick={() => { setEditing(area); setForm({ name: area.name, description: area.description, is_active: area.is_active }); setShowForm(true); }}><HiPencil /></button>
              <button className="btn-icon btn-icon-danger" onClick={() => handleDelete(area.id)}><HiTrash /></button>
            </div>
          </motion.div>
        ))}
      </div>

      <FormModal isOpen={showForm} onClose={() => { setShowForm(false); setEditing(null); setForm(initialForm); }} title={editing ? 'Edit Area' : 'Add Coverage Area'} onSubmit={handleSubmit} loading={saving}>
        <div className="form-group"><label>Area Name</label><input type="text" className="form-control" value={form.name} onChange={e => setForm({...form, name: e.target.value})} required /></div>
        <div className="form-group"><label>Description</label><textarea className="form-control" rows="3" value={form.description} onChange={e => setForm({...form, description: e.target.value})} /></div>
      </FormModal>
    </motion.div>
  );
};

export default CoverageAreas;
