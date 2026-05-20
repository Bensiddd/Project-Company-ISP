import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { HiArrowLeft, HiSave, HiGlobe, HiClock, HiTag, HiEye, HiEyeOff, HiPlus, HiX, HiPhotograph, HiUpload } from 'react-icons/hi';
import { blogPostsAPI } from '../../services/api';
import RichTextEditor from '../../components/RichTextEditor';
import axios from 'axios';

const BlogEditor = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    title: '', slug: '', excerpt: '', content: '', category: 'General',
    status: 'draft', featured_image_url: '', meta_description: '', read_time: '',
    tags: []
  });
  const [tagInput, setTagInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [preview, setPreview] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const isEditing = Boolean(id);

  useEffect(() => {
    if (id) {
      blogPostsAPI.getById(id).then(({ data }) => {
        setForm({
          title: data.title || '', slug: data.slug || '', excerpt: data.excerpt || '',
          content: data.content || '', category: data.category || 'General',
          status: data.status || 'draft', featured_image_url: data.featured_image_url || '',
          meta_description: data.meta_description || '', read_time: data.read_time || '',
          tags: Array.isArray(data.tags) ? data.tags : (typeof data.tags === 'string' ? (() => { try { return JSON.parse(data.tags); } catch (_) { return []; } })() : [])
        });
      }).catch(console.error);
    }
  }, [id]);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const generateSlug = useCallback((title) => {
    return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }, []);

  const handleTitleChange = (e) => {
    const title = e.target.value;
    setForm({ ...form, title, slug: isEditing ? form.slug : generateSlug(title) });
  };

  const handleContentChange = (html) => setForm({ ...form, content: html });

  const addTag = () => {
    const tag = tagInput.trim();
    if (tag && !form.tags.includes(tag)) {
      setForm({ ...form, tags: [...form.tags, tag] });
    }
    setTagInput('');
  };

  const removeTag = (tag) => {
    setForm({ ...form, tags: form.tags.filter(t => t !== tag) });
  };

  const handleSave = async (status) => {
    setSaving(true);
    setSaveMsg('');
    try {
      const payload = { ...form, status: status || form.status };
      if (isEditing) {
        await blogPostsAPI.update(id, payload);
      } else {
        await blogPostsAPI.create(payload);
      }
      setSaveMsg(status === 'published' ? 'Published!' : 'Saved!');
      setTimeout(() => setSaveMsg(''), 2000);
    } catch (err) {
      setSaveMsg('Error saving post');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleFeaturedImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const { data } = await axios.post('/api/upload', fd);
      setForm({ ...form, featured_image_url: data.url });
    } catch (err) {
      console.error('Upload failed:', err);
    } finally {
      setUploadingImage(false);
    }
  };

  const wordCount = form.content ? form.content.replace(/<[^>]*>/g, '').trim().split(/\s+/).length : 0;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className="blog-editor-topbar">
        <button className="btn btn-ghost" onClick={() => navigate('/admin/blog')}>
          <HiArrowLeft /> Back
        </button>
        <div className="blog-editor-topbar-center">
          <input
            className="blog-editor-title-input"
            name="title"
            placeholder="Post title..."
            value={form.title}
            onChange={handleTitleChange}
          />
          {form.read_time && (
            <span className="blog-editor-readtime"><HiClock /> {form.read_time} min</span>
          )}
        </div>
        <div className="blog-editor-topbar-actions">
          {saveMsg && <span className="save-success">{saveMsg}</span>}
          <button className="btn btn-secondary" onClick={() => handleSave('draft')} disabled={saving}>
            <HiSave /> {saving ? 'Saving...' : 'Save Draft'}
          </button>
          <button className="btn btn-primary" onClick={() => handleSave('published')} disabled={saving}>
            <HiGlobe /> Publish
          </button>
        </div>
      </div>

      <div className="blog-editor-layout">
        <div className="blog-editor-main">
          <div className="form-group">
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
              <label className="form-label" style={{ margin: 0 }}>Content</label>
              <button className="btn-icon" onClick={() => setPreview(!preview)} title={preview ? 'Edit' : 'Preview'}>
                {preview ? <HiEyeOff /> : <HiEye />}
              </button>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{wordCount} words</span>
            </div>
            {preview ? (
              <div className="rte-wrapper">
                <div className="rte-content">
                  <div className="ProseMirror" style={{ padding: '20px 24px' }} dangerouslySetInnerHTML={{ __html: form.content || '<p>No content yet...</p>' }} />
                </div>
              </div>
            ) : (
              <RichTextEditor value={form.content} onChange={handleContentChange} placeholder="Mulai menulis..." />
            )}
          </div>
        </div>

        <div className="blog-editor-sidebar">
          <div className="chart-card" style={{ marginBottom: 16 }}>
            <h3 className="blog-editor-section-title">Post Settings</h3>

            <div className="form-group">
              <label className="form-label">Slug</label>
              <input className="form-control" name="slug" value={form.slug} onChange={handleChange} placeholder="post-url-slug" />
            </div>

            <div className="form-group">
              <label className="form-label">Excerpt</label>
              <textarea className="form-control" name="excerpt" value={form.excerpt} onChange={handleChange} placeholder="Brief description..." rows={2} />
            </div>

            <div className="form-group">
              <label className="form-label">Category</label>
              <select className="form-control" name="category" value={form.category} onChange={handleChange}>
                {['General', 'Tips & Trik', 'Teknologi', 'Tutorial', 'Promo', 'Berita'].map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Read Time (minutes)</label>
              <input className="form-control" name="read_time" value={form.read_time} onChange={handleChange} placeholder="e.g. 5" type="number" min="1" />
            </div>

            <div className="form-group">
              <label className="form-label">Featured Image</label>
              {form.featured_image_url && (
                <div style={{ marginBottom: 8, borderRadius: 'var(--radius)', overflow: 'hidden', border: '1px solid var(--border)' }}>
                  <img src={form.featured_image_url} alt="Featured" style={{ width: '100%', height: 160, objectFit: 'cover', display: 'block' }} />
                </div>
              )}
              <div style={{ display: 'flex', gap: 4 }}>
                <input className="form-control" name="featured_image_url" value={form.featured_image_url} onChange={handleChange} placeholder="Image URL..." style={{ flex: 1, fontSize: 13 }} />
                <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer', margin: 0, flexShrink: 0 }}>
                  <HiUpload /> {uploadingImage ? '...' : 'Upload'}
                  <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFeaturedImageUpload} disabled={uploadingImage} />
                </label>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label"><HiTag /> Tags</label>
              <div style={{ display: 'flex', gap: 4, marginBottom: 8, flexWrap: 'wrap' }}>
                {form.tags.map(tag => (
                  <span key={tag} className="badge badge-primary" style={{ cursor: 'pointer' }} onClick={() => removeTag(tag)}>
                    {tag} <HiX style={{ marginLeft: 4, width: 12, height: 12 }} />
                  </span>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                <input className="form-control" value={tagInput} onChange={e => setTagInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addTag())} placeholder="Add tag..." style={{ flex: 1 }} />
                <button className="btn btn-secondary btn-sm" onClick={addTag}><HiPlus /></button>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Meta Description</label>
              <textarea className="form-control" name="meta_description" value={form.meta_description} onChange={handleChange} placeholder="SEO description..." rows={2} />
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default BlogEditor;
