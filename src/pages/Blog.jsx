import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { HiArrowRight } from 'react-icons/hi';
import { blogPostsAPI } from '../services/api';
import './Blog.css';

const Blog = () => {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    blogPostsAPI.getAll().then(({ data }) => {
      setPosts(data.filter(p => p.status === 'published'));
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  return (
    <div className="blog">
      <section className="page-header">
        <div className="container">
          <h1>Our Blog</h1>
          <p>Latest insights and updates from our team</p>
        </div>
      </section>

      <section className="page-content">
        <div className="container">
          {loading ? (
            <div className="blog-grid">
              {[1, 2, 3].map(n => (
                <div key={n} className="blog-post-card">
                  <div className="skeleton" style={{ height: '200px', borderRadius: 'var(--radius-xl) var(--radius-xl) 0 0' }} />
                  <div style={{ padding: 24 }}>
                    <div className="skeleton" style={{ height: 20, width: 80, marginBottom: 12 }} />
                    <div className="skeleton" style={{ height: 24, width: '90%', marginBottom: 12 }} />
                    <div className="skeleton" style={{ height: 16, width: '70%', marginBottom: 8 }} />
                    <div className="skeleton" style={{ height: 16, width: '50%' }} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <motion.div
              className="blog-grid"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ staggerChildren: 0.1 }}
            >
              {posts.map(post => (
                <motion.article
                  key={post.id}
                  className="blog-post-card"
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4 }}
                  whileHover={{ y: -6 }}
                >
                  <div className="blog-post-image">
                    <div className="blog-post-placeholder">
                      <span>{post.category[0]}</span>
                    </div>
                  </div>
                  <div className="blog-post-body">
                    <div className="blog-post-meta">
                      <span className="blog-post-category">{post.category}</span>
                      <span className="blog-post-date">
                        {new Date(post.published_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                    </div>
                    <h3>{post.title}</h3>
                    <p>{post.excerpt}</p>
                    <div className="blog-post-footer">
                      <div className="blog-post-author">
                        <div className="post-author-avatar">
                          {post.author_name?.split(' ').map(n => n[0]).join('')}
                        </div>
                        <span>{post.author_name}</span>
                      </div>
                      <button className="btn btn-ghost">
                        Read <HiArrowRight />
                      </button>
                    </div>
                  </div>
                </motion.article>
              ))}
            </motion.div>
          )}
        </div>
      </section>
    </div>
  );
};

export default Blog;