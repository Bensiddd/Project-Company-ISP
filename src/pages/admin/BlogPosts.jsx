import React, { useState, useEffect } from 'react';
import DataTable from '../../components/DataTable';
import FormModal from '../../components/FormModal';
import { blogPostsAPI } from '../../services/api';

  const initialForm = { title: '', slug: '', excerpt: '', content: '', category: 'Tips & Trik', status: 'draft' };

const categories = ['Tips & Trik', 'Teknologi', 'Promo', 'Tutorial', 'Info Wilayah', 'Company News'];

const BlogPosts = () => {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [saving, setSaving] = useState(false);

  const fetchPosts = async () => {
    try {
      const { data } = await blogPostsAPI.getAll();
      setPosts(data);
    } catch (err) {
      console.error('Failed to fetch posts:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPosts(); }, []);

  const columns = [
    { key: 'id', label: 'ID', width: 60 },
    { key: 'title', label: 'Title', render: item => <div><span className="fw-600">{item.title}</span><div className="text-muted small">{item.excerpt?.substring(0, 60)}...</div></div> },
    { key: 'category', label: 'Category', render: item => <span className="badge" style={{ background: 'var(--bg-elevated)', color: 'var(--primary-light)' }}>{item.category}</span> },
    { key: 'author_name', label: 'Author' },
    { key: 'status', label: 'Status', render: item => <span className={`status-pill ${item.status}`}>{item.status}</span> },
    { key: 'published_at', label: 'Published', render: item => item.published_at ? new Date(item.published_at + 'Z').toLocaleDateString() : '—' }
  ];

  const handleEdit = async (post) => {
    try {
      const { data } = await blogPostsAPI.getById(post.id);
      setEditing(data);
      setForm({ title: data.title, slug: data.slug, excerpt: data.excerpt || '', content: data.content || '', category: data.category || 'Tips & Trik', status: data.status });
      setShowForm(true);
    } catch (e) { console.error(e); }
  };

  const handleDelete = async (id) => { try { await blogPostsAPI.delete(id); setPosts(prev => prev.filter(p => p.id !== id)); } catch (e) { console.error(e); } };
  const handleToggle = async (id) => { try { const p = posts.find(p => p.id === id); const { data } = await blogPostsAPI.update(id, { ...p, status: p.status === 'published' ? 'draft' : 'published' }); setPosts(prev => prev.map(p => p.id === id ? data : p)); } catch (e) { console.error(e); } };

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const slug = form.slug || form.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      const payload = { ...form, slug };
      if (editing) {
        const { data } = await blogPostsAPI.update(editing.id, payload);
        setPosts(prev => prev.map(p => p.id === editing.id ? data : p));
      } else {
        const { data } = await blogPostsAPI.create(payload);
        setPosts(prev => [...prev, data]);
      }
      setShowForm(false); setEditing(null); setForm(initialForm);
    } catch (e) { console.error(e); } finally { setSaving(false); }
  };

  return (
    <>
      <DataTable columns={columns} data={posts} searchKeys={['title', 'excerpt', 'category', 'author_name']} loading={loading} title="Blog Posts" statusKey="status"
        addButton={{ label: 'New Post', onClick: () => { setEditing(null); setForm(initialForm); setShowForm(true); } }}
        onEdit={handleEdit} onDelete={handleDelete} onToggleStatus={handleToggle}
      />
      <FormModal isOpen={showForm} onClose={() => { setShowForm(false); setEditing(null); setForm(initialForm); }} title={editing ? 'Edit Post' : 'New Blog Post'} onSubmit={handleSubmit} loading={saving} size="lg">
        <div className="form-group">
          <label>Title</label>
          <input type="text" className="form-control" value={form.title} onChange={e => setForm({...form, title: e.target.value, slug: editing ? form.slug : e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') })} required />
        </div>
        <div className="form-group"><label>Slug</label><input type="text" className="form-control" value={form.slug} onChange={e => setForm({...form, slug: e.target.value})} /></div>
        <div className="form-row">
          <div className="form-group"><label>Category</label>
            <select className="form-control" value={form.category} onChange={e => setForm({...form, category: e.target.value})}>{categories.map(c => <option key={c} value={c}>{c}</option>)}</select>
          </div>
          <div className="form-group"><label>Status</label>
            <select className="form-control" value={form.status} onChange={e => setForm({...form, status: e.target.value})}>
              <option value="draft">Draft</option><option value="published">Published</option>
            </select>
          </div>
        </div>
        <div className="form-group"><label>Excerpt</label><textarea className="form-control" rows="2" value={form.excerpt} onChange={e => setForm({...form, excerpt: e.target.value})} /></div>
        <div className="form-group"><label>Content</label><textarea className="form-control" rows="6" value={form.content} onChange={e => setForm({...form, content: e.target.value})} placeholder="Write your blog post content here..." /></div>
      </FormModal>
    </>
  );
};

export default BlogPosts;
