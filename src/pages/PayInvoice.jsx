import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import axios from 'axios';
import './PayInvoice.css';

const API = axios.create({ baseURL: import.meta.env.VITE_API_URL || '/api', timeout: 10000 });

const formatIDR = (num) => `Rp${Number(num || 0).toLocaleString('id-ID')}`;

const PayInvoice = () => {
  const { token } = useParams();
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState(null);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const paidRef = useRef(false);
  const checkingRef = useRef(false); // prevent overlapping polls

  const markPaid = (data) => {
    paidRef.current = true;
    checkingRef.current = false;
    setInvoice(prev => ({ ...(prev || {}), ...data, already_paid: true }));
    setError(null);
    setCheckingStatus(false);
    setPaying(false);
  };

  const checkMidtransStatus = async () => {
    if (paidRef.current || !token) return false;
    if (checkingRef.current) return false; // prevent overlapping
    checkingRef.current = true;
    try {
      const { data } = await API.post(`/payments/public/check-status/${token}`);
      if (data.already_paid || data.status === 'paid') {
        markPaid(data);
        return true;
      }
      return false;
    } catch {
      return false;
    } finally {
      checkingRef.current = false;
    }
  };

  const pollRef = useRef(null);
  const cleanupPoll = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  useEffect(() => {
    if (!token) return;
    const initLoad = async () => {
      // 1. Get invoice info
      try {
        const { data } = await API.get(`/payments/public/${token}`);
        if (data.already_paid || data.status === 'paid') {
          markPaid(data);
          setLoading(false);
          return;
        }
        setInvoice(data);
      } catch (err) {
        setError(err.response?.data?.message || 'Link tidak valid.');
        setLoading(false);
        return;
      }

      // 2. Immediately check Midtrans real status
      setCheckingStatus(true);
      await checkMidtransStatus();
      setCheckingStatus(false);
      setLoading(false);

      // 3. Start auto-poll every 10s
      if (!paidRef.current) {
        pollRef.current = setInterval(async () => {
          const done = await checkMidtransStatus();
          if (done) cleanupPoll();
        }, 10000);
      }
    };
    initLoad();
    return () => cleanupPoll();
  }, [token]);

  // Listen for postMessage from popup (PaymentResult auto-closes after payment)
  useEffect(() => {
    const handleMessage = async (event) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === 'midtrans_payment_result') {
        cleanupPoll();
        setCheckingStatus(true);
        setError(null);
        try {
          // Check DB once (PaymentResult keepalive fetch may have updated)
          const done = await checkMidtransStatus();
          if (done) return;
          // Fallback: poll 5x every 2s
          let attempts = 0;
          const poll = setInterval(async () => {
            attempts++;
            const ok = await checkMidtransStatus();
            if (ok || attempts >= 5) {
              clearInterval(poll);
              if (!ok) {
                setCheckingStatus(false);
                // Restart auto-poll while we wait for settlement
                if (!paidRef.current && !pollRef.current) {
                  pollRef.current = setInterval(async () => {
                    const done = await checkMidtransStatus();
                    if (done) cleanupPoll();
                  }, 10000);
                }
              }
            }
          }, 2000);
        } catch {
          setCheckingStatus(false);
        }
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [token]);

  const handleRefreshStatus = async () => {
    setCheckingStatus(true);
    const done = await checkMidtransStatus();
    if (!done) {
      const { data } = await API.get(`/payments/public/${token}`);
      setInvoice(prev => ({ ...(prev || {}), ...data }));
    }
    setCheckingStatus(false);
  };

  const handlePay = async () => {
    setPaying(true);
    setError(null);
    try {
      const { data } = await API.post(`/payments/public-charge/${token}`);
      const w = 450, h = 620;
      const left = (screen.width - w) / 2;
      const top = (screen.height - h) / 2;
      const popup = window.open(
        data.redirect_url,
        'midtrans_pay',
        `width=${w},height=${h},left=${left},top=${top},resizable=no,scrollbars=no`
      );
      if (!popup) {
        window.location.href = data.redirect_url;
        return;
      }
      setPaying(false);
      // Monitor popup: check status immediately when closed
      // postMessage handler + auto-poll will handle the rest
      const monitor = setInterval(async () => {
        if (popup.closed) {
          clearInterval(monitor);
          setCheckingStatus(true);
          await checkMidtransStatus();
          // If not paid yet, auto-poll is already running; show user it's checking
          if (!paidRef.current) {
            setCheckingStatus(false);
          }
        }
      }, 2000);
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

        {checkingStatus && (
          <div className="pay-status-checking">
            Memeriksa status pembayaran...
          </div>
        )}

        <button className="pay-button" onClick={handlePay} disabled={paying || checkingStatus}>
          {paying ? 'Memproses...' : 'Bayar Sekarang'}
        </button>

        <button
          className="pay-refresh-button"
          onClick={handleRefreshStatus}
          disabled={checkingStatus}
        >
          {checkingStatus ? 'Memeriksa...' : 'Refresh Status'}
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
