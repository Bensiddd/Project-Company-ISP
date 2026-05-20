import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import DataTable from '../../components/DataTable';
import { blogPostsAPI } from '../../services/api';

const BlogPosts = () => {
  const navigate = useNavigate();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

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
    { key: 'thumbnail', label: '', width: 56, render: item => (
      item.featured_image_url
        ? <img src={item.featured_image_url} alt="" style={{ width: 40, height: 40, borderRadius: 'var(--radius-sm)', objectFit: 'cover' }} />
        : <div style={{ width: 40, height: 40, borderRadius: 'var(--radius-sm)', background: 'var(--bg-elevated)' }} />
    )},
    { key: 'title', label: 'Title', render: item => <div><span className="fw-600">{item.title}</span><div className="text-muted small">{item.excerpt?.substring(0, 60)}...</div></div> },
    { key: 'category', label: 'Category', render: item => <span className="badge" style={{ background: 'var(--bg-elevated)', color: 'var(--primary-light)' }}>{item.category}</span> },
    { key: 'author_name', label: 'Author' },
    { key: 'status', label: 'Status', render: item => <span className={`status-pill ${item.status}`}>{item.status}</span> },
    { key: 'published_at', label: 'Published', render: item => item.published_at ? new Date(item.published_at).toLocaleDateString() : '—' }
  ];

  const handleEdit = (post) => navigate(`/admin/blog/editor/${post.id}`);

  const handleDelete = async (id) => { try { await blogPostsAPI.delete(id); setPosts(prev => prev.filter(p => p.id !== id)); } catch (e) { console.error(e); } };

  const handleToggle = async (id) => { try { const p = posts.find(p => p.id === id); const { data } = await blogPostsAPI.update(id, { ...p, status: p.status === 'published' ? 'draft' : 'published' }); setPosts(prev => prev.map(p => p.id === id ? data : p)); } catch (e) { console.error(e); } };

  return (
    <DataTable columns={columns} data={posts} searchKeys={['title', 'excerpt', 'category', 'author_name']} loading={loading} title="Blog Posts" statusKey="status"
      addButton={{ label: 'New Post', onClick: () => navigate('/admin/blog/editor') }}
      onEdit={handleEdit} onDelete={handleDelete} onToggleStatus={handleToggle}
    />
  );
};

export default BlogPosts;
