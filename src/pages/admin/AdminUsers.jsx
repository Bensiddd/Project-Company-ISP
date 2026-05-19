import React, { useState, useEffect } from 'react';
import DataTable from '../../components/DataTable';
import FormModal from '../../components/FormModal';
import { adminUsersAPI } from '../../services/api';

const initialForm = { username: '', email: '', full_name: '', role: 'admin', is_active: true, password: '' };

const AdminUsers = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [saving, setSaving] = useState(false);

  const fetchUsers = async () => {
    try {
      const { data } = await adminUsersAPI.getAll();
      setUsers(data);
    } catch (err) {
      console.error('Failed to fetch users:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, []);

  const columns = [
    { key: 'id', label: 'ID', width: 60 },
    { key: 'username', label: 'Username', render: item => <div><span className="fw-600">{item.username}</span><div className="text-muted small">{item.full_name}</div></div> },
    { key: 'email', label: 'Email' },
    { key: 'role', label: 'Role', render: item => {
      const colors = { super_admin: 'var(--primary)', admin: 'var(--success)', editor: 'var(--warning)', teknisi: '#f59e0b', cs: '#8b5cf6', marketing: '#06b6d4' };
      return <span className="badge" style={{ background: `${colors[item.role] || '#666'}20`, color: colors[item.role] || '#666' }}>{item.role.replace('_', ' ')}</span>;
    }},
    { key: 'is_active', label: 'Status', render: item => <span className={`status-pill ${item.is_active ? 'active' : 'inactive'}`}>{item.is_active ? 'Active' : 'Inactive'}</span> },
    { key: 'last_login', label: 'Last Login', render: item => item.last_login ? new Date(item.last_login).toLocaleDateString() : '—' }
  ];

  const handleEdit = (user) => { setEditing(user); setForm({ username: user.username, email: user.email, full_name: user.full_name, role: user.role, is_active: user.is_active, password: '' }); setShowForm(true); };
  const handleDelete = async (id) => { try { await adminUsersAPI.delete(id); setUsers(prev => prev.filter(u => u.id !== id)); } catch (e) { console.error(e); } };
  const handleToggle = async (id) => { try { const u = users.find(u => u.id === id); const { data } = await adminUsersAPI.update(id, { ...u, is_active: !u.is_active }); setUsers(prev => prev.map(u => u.id === id ? data : u)); } catch (e) { console.error(e); } };

  const handleSubmit = async () => {
    setSaving(true);
    try {
      if (editing) {
        const { data } = await adminUsersAPI.update(editing.id, form);
        setUsers(prev => prev.map(u => u.id === editing.id ? data : u));
      } else {
        const { data } = await adminUsersAPI.create(form);
        setUsers(prev => [...prev, data]);
      }
      setShowForm(false);
      setEditing(null);
      setForm(initialForm);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <DataTable columns={columns} data={users} searchKeys={['username', 'email', 'full_name', 'role']} loading={loading} title="Admin Users"
        addButton={{ label: 'Add User', onClick: () => { setEditing(null); setForm(initialForm); setShowForm(true); } }}
        onEdit={handleEdit} onDelete={handleDelete} onToggleStatus={handleToggle}
      />
      <FormModal isOpen={showForm} onClose={() => { setShowForm(false); setEditing(null); setForm(initialForm); }} title={editing ? 'Edit User' : 'Add New User'} onSubmit={handleSubmit} loading={saving}>
        <div className="form-group"><label>Username</label><input type="text" className="form-control" value={form.username} onChange={e => setForm({...form, username: e.target.value})} required /></div>
        <div className="form-group"><label>Full Name</label><input type="text" className="form-control" value={form.full_name} onChange={e => setForm({...form, full_name: e.target.value})} required /></div>
        <div className="form-group"><label>Email</label><input type="email" className="form-control" value={form.email} onChange={e => setForm({...form, email: e.target.value})} required /></div>
        <div className="form-row">
          <div className="form-group"><label>Role</label>
            <select className="form-control" value={form.role} onChange={e => setForm({...form, role: e.target.value})}>
              <option value="admin">Admin</option><option value="super_admin">Super Admin</option><option value="cs">CS</option><option value="marketing">Marketing</option><option value="editor">Editor</option><option value="teknisi">Teknisi</option>
            </select>
          </div>
          <div className="form-group"><label>Status</label>
            <select className="form-control" value={form.is_active} onChange={e => setForm({...form, is_active: e.target.value === 'true'})}>
              <option value="true">Active</option><option value="false">Inactive</option>
            </select>
          </div>
        </div>
        <div className="form-group"><label>{editing ? 'New Password (leave blank to keep)' : 'Password'}</label>
          <input type="password" className="form-control" value={form.password} onChange={e => setForm({...form, password: e.target.value})} required={!editing} />
        </div>
      </FormModal>
    </>
  );
};

export default AdminUsers;
