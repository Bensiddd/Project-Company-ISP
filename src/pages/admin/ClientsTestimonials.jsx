import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import DataTable from '../../components/DataTable';
import FormModal from '../../components/FormModal';
import { HiStar, HiBriefcase, HiChat } from 'react-icons/hi';
import { clientsAPI, testimonialsAPI } from '../../services/api';

const initialClient = { company_name: '', industry: 'Technology', contact_person: '', email: '', is_active: true };
const initialTestimonial = { author_name: '', content: '', rating: 5, is_approved: true, client_id: '' };

const tabs = [
  { id: 'clients', label: 'Clients', icon: HiBriefcase },
  { id: 'testimonials', label: 'Testimonials', icon: HiChat }
];

const ClientsTestimonials = () => {
  const [clients, setClients] = useState([]);
  const [testimonials, setTestimonials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('clients');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(initialClient);
  const [saving, setSaving] = useState(false);

  const fetchData = async () => {
    try {
      const [clientsRes, testimonialsRes] = await Promise.all([clientsAPI.getAll(), testimonialsAPI.getAll()]);
      setClients(clientsRes.data);
      setTestimonials(testimonialsRes.data);
    } catch (err) {
      console.error('Failed to fetch data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const clientColumns = [
    { key: 'company_name', label: 'Company', render: item => <div><span className="fw-600">{item.company_name}</span><div className="text-muted small">{item.contact_person}</div></div> },
    { key: 'industry', label: 'Industry', render: item => <span className="badge" style={{ background: 'var(--bg-elevated)', color: 'var(--primary-light)' }}>{item.industry}</span> },
    { key: 'email', label: 'Email' },
    { key: 'is_active', label: 'Status', render: item => <span className={`status-pill ${item.is_active ? 'active' : 'inactive'}`}>{item.is_active ? 'Active' : 'Inactive'}</span> }
  ];

  const testimonialColumns = [
    { key: 'author_name', label: 'Author' },
    { key: 'content', label: 'Content', render: item => <div><span>{item.content?.substring(0, 60)}...</span><div className="text-muted small">{item.author_position}</div></div> },
    { key: 'client_name', label: 'Client' },
    { key: 'rating', label: 'Rating', render: item => <div className="stars">{Array.from({ length: 5 }, (_, i) => <HiStar key={i} className={i < item.rating ? 'star-filled' : 'star-empty'} />)}</div> },
    { key: 'is_approved', label: 'Status', render: item => <span className={`status-pill ${item.is_approved ? 'active' : 'inactive'}`}>{item.is_approved ? 'Approved' : 'Pending'}</span> }
  ];

  const handleEdit = (item) => {
    setEditing(item);
    if (activeTab === 'clients') {
      setForm({ company_name: item.company_name, industry: item.industry || '', contact_person: item.contact_person || '', email: item.email || '', phone: item.phone || '', address: item.address || '', website: item.website || '', logo_url: item.logo_url || '', is_active: item.is_active });
    } else {
      setForm({ author_name: item.author_name, author_position: item.author_position || '', content: item.content, rating: item.rating, is_approved: item.is_approved, client_id: item.client_id?.toString() || '' });
    }
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    try {
      if (activeTab === 'clients') { await clientsAPI.delete(id); setClients(prev => prev.filter(c => c.id !== id)); }
      else { await testimonialsAPI.delete(id); setTestimonials(prev => prev.filter(t => t.id !== id)); }
    } catch (e) { console.error(e); }
  };

  const handleToggle = async (id) => {
    try {
      if (activeTab === 'clients') {
        const c = clients.find(c => c.id === id);
        const { data } = await clientsAPI.update(id, { ...c, is_active: !c.is_active });
        setClients(prev => prev.map(c => c.id === id ? data : c));
      } else {
        const t = testimonials.find(t => t.id === id);
        const { data } = await testimonialsAPI.update(id, { ...t, is_approved: !t.is_approved });
        setTestimonials(prev => prev.map(t => t.id === id ? data : t));
      }
    } catch (e) { console.error(e); }
  };

  const handleSubmit = async () => {
    setSaving(true);
    try {
      if (activeTab === 'clients') {
        if (editing) {
          const { data } = await clientsAPI.update(editing.id, form);
          setClients(prev => prev.map(c => c.id === editing.id ? data : c));
        } else {
          const { data } = await clientsAPI.create(form);
          setClients(prev => [...prev, data]);
        }
      } else {
        const payload = { ...form, client_id: form.client_id ? parseInt(form.client_id) : null, rating: form.rating };
        if (editing) {
          const { data } = await testimonialsAPI.update(editing.id, payload);
          setTestimonials(prev => prev.map(t => t.id === editing.id ? data : t));
        } else {
          const { data } = await testimonialsAPI.create(payload);
          setTestimonials(prev => [...prev, data]);
        }
      }
      setShowForm(false); setEditing(null);
      setForm(activeTab === 'clients' ? initialClient : initialTestimonial);
    } catch (e) { console.error(e); } finally { setSaving(false); }
  };

  const handleAdd = () => { setEditing(null); setForm(activeTab === 'clients' ? initialClient : initialTestimonial); setShowForm(true); };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className="data-table-header">
        <div><h1>Clients & Testimonials</h1></div>
        <button className="btn btn-primary" onClick={handleAdd}>+ Add {activeTab === 'clients' ? 'Client' : 'Testimonial'}</button>
      </div>

      <div className="admin-tabs">
        {tabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button key={tab.id} className={`admin-tab ${activeTab === tab.id ? 'active' : ''}`} onClick={() => setActiveTab(tab.id)}>
              <Icon /> {tab.label}
              <span className="tab-count">{tab.id === 'clients' ? clients.length : testimonials.length}</span>
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={activeTab} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.2 }}>
          {activeTab === 'clients' ? (
            <DataTable columns={clientColumns} data={clients} searchKeys={['company_name', 'industry', 'contact_person', 'email']} loading={loading}
              onEdit={handleEdit} onDelete={handleDelete} onToggleStatus={handleToggle} pageSize={8}
            />
          ) : (
            <DataTable columns={testimonialColumns} data={testimonials} searchKeys={['author_name', 'content', 'client_name']} loading={loading} statusKey="is_approved"
              onEdit={handleEdit} onDelete={handleDelete} onToggleStatus={handleToggle} pageSize={8}
            />
          )}
        </motion.div>
      </AnimatePresence>

      <FormModal isOpen={showForm} onClose={() => { setShowForm(false); setEditing(null); }} title={editing ? `Edit ${activeTab === 'clients' ? 'Client' : 'Testimonial'}` : `Add ${activeTab === 'clients' ? 'Client' : 'Testimonial'}`} onSubmit={handleSubmit} loading={saving}>
        {activeTab === 'clients' ? (
          <>
            <div className="form-group"><label>Company Name</label><input type="text" className="form-control" value={form.company_name} onChange={e => setForm({...form, company_name: e.target.value})} required /></div>
            <div className="form-row">
              <div className="form-group"><label>Industry</label>
                <select className="form-control" value={form.industry} onChange={e => setForm({...form, industry: e.target.value})}>
                  {['Technology', 'Finance', 'Healthcare', 'Education', 'Energy', 'Retail', 'Manufacturing'].map(ind => <option key={ind} value={ind}>{ind}</option>)}
                </select>
              </div>
              <div className="form-group"><label>Status</label>
                <select className="form-control" value={form.is_active} onChange={e => setForm({...form, is_active: e.target.value === 'true'})}>
                  <option value="true">Active</option><option value="false">Inactive</option>
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group"><label>Contact Person</label><input type="text" className="form-control" value={form.contact_person} onChange={e => setForm({...form, contact_person: e.target.value})} /></div>
              <div className="form-group"><label>Email</label><input type="email" className="form-control" value={form.email} onChange={e => setForm({...form, email: e.target.value})} /></div>
            </div>
          </>
        ) : (
          <>
            <div className="form-group"><label>Author Name</label><input type="text" className="form-control" value={form.author_name} onChange={e => setForm({...form, author_name: e.target.value})} required /></div>
            <div className="form-row">
              <div className="form-group"><label>Client</label>
                <select className="form-control" value={form.client_id} onChange={e => setForm({...form, client_id: e.target.value})}>
                  <option value="">Select client...</option>
                  {clients.filter(c => c.is_active).map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
                </select>
              </div>
              <div className="form-group"><label>Rating</label>
                <div className="star-picker">
                  {[1, 2, 3, 4, 5].map(n => (
                    <HiStar key={n} className={n <= form.rating ? 'star-filled' : 'star-empty'} onClick={() => setForm({...form, rating: n})} />
                  ))}
                </div>
              </div>
            </div>
            <div className="form-group"><label>Content</label><textarea className="form-control" rows="4" value={form.content} onChange={e => setForm({...form, content: e.target.value})} required /></div>
            <div className="form-group"><label className="checkbox-label"><input type="checkbox" checked={form.is_approved} onChange={e => setForm({...form, is_approved: e.target.checked})} /> Approved</label></div>
          </>
        )}
      </FormModal>
    </motion.div>
  );
};

export default ClientsTestimonials;
