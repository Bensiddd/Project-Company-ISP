import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import axios from 'axios';
import './PayInvoice.css';

const API = axios.create({ baseURL: import.meta.env.VITE_API_URL || '/api', timeout: 30000 });

const formatIDR = (num) => `Rp${Number(num || 0).toLocaleString('id-ID')}`;

const PayInvoice = () => {
  const { token } = useParams();
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!token) return;
    API.get(`/payments/public/${token}`)
      .then(res => setInvoice(res.data))
      .catch(err => setError(err.response?.data?.message || 'Link tidak valid.'))
      .finally(() => setLoading(false));
  }, [token]);

  const handlePay = async () => {
    setPaying(true);
    setError(null);
    try {
      const { data } = await API.post(`/payments/public-charge/${token}`);
      window.location.href = data.redirect_url;
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal memproses pembayaran.');
      setPaying(false);
    }
  };

  if (loading) {
    return (
      <div className="pay-container">
        <div className="pay-card">
          <div className="pay-loading">Memuat data pembayaran...</div>
        </div>
      </div>
    );
  }

  if (error && !invoice) {
    return (
      <div className="pay-container">
        <div className="pay-card pay-error-card">
          <div className="pay-error-icon">✕</div>
          <h2>Link Tidak Valid</h2>
          <p>{error}</p>
          <p className="pay-help">Hubungi admin MAZNET untuk bantuan.</p>
        </div>
      </div>
    );
  }

  if (invoice?.already_paid) {
    return (
      <div className="pay-container">
        <motion.div className="pay-card pay-success-card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="pay-success-icon">✓</div>
          <h2>Invoice Sudah Dibayar</h2>
          <p>Invoice <strong>{invoice.invoice_number}</strong> sebesar {formatIDR(invoice.total_amount)} sudah lunas.</p>
          <p className="pay-help">Terima kasih telah menggunakan layanan MAZNET.</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="pay-container">
      <motion.div className="pay-card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        {/* Brand */}
        <div className="pay-brand">
          <span className="pay-brand-icon">M</span>
          <span className="pay-brand-name">MAZNET</span>
        </div>

        <h1 className="pay-title">Pembayaran Invoice</h1>

        <div className="pay-invoice-details">
          <div className="pay-row">
            <span className="pay-label">Invoice</span>
            <span className="pay-value">{invoice.invoice_number}</span>
          </div>
          <div className="pay-row">
            <span className="pay-label">Atas Nama</span>
            <span className="pay-value">{invoice.client_name}</span>
          </div>
          <div className="pay-row">
            <span className="pay-label">Jatuh Tempo</span>
            <span className="pay-value">{new Date(invoice.due_date).toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
          </div>
          <div className="pay-divider" />
          <div className="pay-row pay-total-row">
            <span className="pay-label">Total</span>
            <span className="pay-total">{formatIDR(invoice.total_amount)}</span>
          </div>
        </div>

        {error && (
          <div className="pay-error-msg">{error}</div>
        )}

        <button className="pay-button" onClick={handlePay} disabled={paying}>
          {paying ? 'Memproses...' : 'Bayar Sekarang'}
        </button>

        <p className="pay-methods-hint">
          Pembayaran diproses melalui Midtrans. Tersedia berbagai metode pembayaran.
        </p>

        <div className="pay-footer">
          <p>Butuh bantuan? Hubungi <strong>admin@maznet.id</strong></p>
        </div>
      </motion.div>
    </div>
  );
};

export default PayInvoice;
