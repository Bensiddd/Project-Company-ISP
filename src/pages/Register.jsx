import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { HiEye, HiEyeOff, HiGlobe } from 'react-icons/hi';
import { authAPI } from '../services/api';
import Particles from '../components/Particles';

const Register = () => {
  const [userData, setUserData] = useState({ name: '', email: '', password: '', confirmPassword: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [agreeTerms, setAgreeTerms] = useState(false);
  const navigate = useNavigate();

  const handleChange = e => setUserData({ ...userData, [e.target.name]: e.target.value });

  const handleSubmit = async e => {
    e.preventDefault();
    if (userData.password !== userData.confirmPassword) { setError('Passwords do not match'); return; }
    if (!agreeTerms) { setError('Please agree to the Terms and Privacy Policy'); return; }
    setLoading(true);
    setError('');
    try {
      const { data } = await authAPI.register({ name: userData.name, email: userData.email, password: userData.password });
      localStorage.setItem('admin_token', data.token);
      localStorage.setItem('admin_user', JSON.stringify(data.user));
      navigate('/admin');
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <Particles count={40} speed={0.3} />
      <div className="auth-bg" />
      <motion.div
        className="auth-container"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="auth-card">
          <div className="auth-header">
            <div className="auth-logo">
              <HiGlobe size={24} />
            </div>
            <h1>Buat Akun</h1>
            <p>Mulai langganan internet bersama MAZNET</p>
          </div>

          {error && <div className="alert alert-error">{error}</div>}

          <form onSubmit={handleSubmit} className="auth-form">
            <div className="form-group">
              <label className="form-label">Full Name</label>
              <input type="text" name="name" className="form-control" placeholder="John Doe" value={userData.name} onChange={handleChange} required />
            </div>
            <div className="form-group">
              <label className="form-label">Email Address</label>
              <input type="email" name="email" className="form-control" placeholder="you@example.com" value={userData.email} onChange={handleChange} required />
            </div>
            <div className="form-group">
              <label className="form-label">Password</label>
              <div className="input-with-icon">
                <input type={showPassword ? 'text' : 'password'} name="password" className="form-control" placeholder="Min. 8 characters" value={userData.password} onChange={handleChange} required />
                <button type="button" className="input-icon-btn" onClick={() => setShowPassword(!showPassword)} tabIndex={-1}>
                  {showPassword ? <HiEyeOff /> : <HiEye />}
                </button>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Confirm Password</label>
              <div className="input-with-icon">
                <input type={showConfirmPassword ? 'text' : 'password'} name="confirmPassword" className="form-control" placeholder="Re-enter your password" value={userData.confirmPassword} onChange={handleChange} required />
                <button type="button" className="input-icon-btn" onClick={() => setShowConfirmPassword(!showConfirmPassword)} tabIndex={-1}>
                  {showConfirmPassword ? <HiEyeOff /> : <HiEye />}
                </button>
              </div>
            </div>

            <div className="form-options">
              <label className="checkbox-label">
                <input type="checkbox" checked={agreeTerms} onChange={e => setAgreeTerms(e.target.checked)} />
                <span>I agree to the <a href="#">Terms</a> & <a href="#">Privacy Policy</a></span>
              </label>
            </div>

            <button type="submit" className="btn btn-primary btn-lg" style={{ width: '100%' }} disabled={loading}>
              {loading ? 'Creating Account...' : 'Create Account'}
            </button>
          </form>

          <div className="auth-footer">
            <p>Already have an account? <Link to="/login">Sign in</Link></p>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default Register;