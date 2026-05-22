import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { HiArrowLeft, HiCalendar, HiUser, HiClock, HiTag } from 'react-icons/hi';
import { blogPostsAPI } from '../services/api';
import Particles from '../components/Particles';
import './BlogDetail.css';

const BlogDetail = () => {
  const { slug } = useParams();
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    blogPostsAPI.getBySlug(slug).then(({ data }) => {
      setPost(data);
    }).catch(console.error).finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return (
      <div className="blog-detail">
        <section className="page-header">
          <Particles count={40} speed={0.3} />
          <div className="container"><h1>Loading...</h1></div>
        </section>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="blog-detail">
        <section className="page-header">
          <Particles count={40} speed={0.3} />
          <div className="container"><h1>Post not found</h1></div>
        </section>
      </div>
    );
  }

  return (
    <div className="blog-detail">
      <section className={`page-header ${post.featured_image_url ? 'page-header-cover' : ''}`}>
        <Particles count={40} speed={0.3} />
        {post.featured_image_url && <img src={post.featured_image_url} alt="" className="page-header-bg-img" />}
        {post.featured_image_url && <div className="page-header-overlay" />}
        <div className="container" style={{ position: 'relative', zIndex: 2 }}>
          <Link to="/blog" className="back-link"><HiArrowLeft /> Back to Blog</Link>
          <h1>{post.title}</h1>
          {post.excerpt && <p className="blog-detail-excerpt">{post.excerpt}</p>}
          <div className="blog-detail-meta">
            <span><HiCalendar /> {new Date(post.published_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
            {post.read_time && <span><HiClock /> {post.read_time} min read</span>}
            {Array.isArray(post.tags) && post.tags.length > 0 && (
              <span className="blog-detail-tags">
                {post.tags.map(tag => (
                  <span key={tag} className="badge badge-primary" style={{ fontSize: 11, marginLeft: 4 }}>{tag}</span>
                ))}
              </span>
            )}
          </div>
        </div>
      </section>

      <section className="page-content">
        <div className="container blog-detail-body">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="blog-detail-content" dangerouslySetInnerHTML={{ __html: post.content }} />
        </div>
      </section>
    </div>
  );
};

export default BlogDetail;
