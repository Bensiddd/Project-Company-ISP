import React, { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import axios from 'axios';
import { motion } from 'framer-motion';
import './PayInvoice.css';

const API = axios.create({ baseURL: '/' });

const statusConfig = {
  settlement: {
    icon: '✓',
    iconClass: 'pay-success-icon',
    title: 'Pembayaran Berhasil',
    desc: 'Pembayaran Anda telah diterima. Invoice akan segera terupdate.',
  },
  success: {
    icon: '✓',
    iconClass: 'pay-success-icon',
    title: 'Pembayaran Berhasil',
    desc: 'Pembayaran Anda telah diterima. Invoice akan segera terupdate.',
  },
  capture: {
    icon: '✓',
    iconClass: 'pay-success-icon',
    title: 'Pembayaran Berhasil',
    desc: 'Pembayaran Anda telah diterima. Invoice akan segera terupdate.',
  },
  pending: {
    icon: '⏳',
    iconClass: 'pay-pending-icon',
    title: 'Menunggu Pembayaran',
    desc: 'Pembayaran Anda sedang diproses. Silakan selesaikan pembayaran sesuai instruksi yang diberikan.',
  },
  error: {
    icon: '✕',
    iconClass: 'pay-error-icon',
    title: 'Pembayaran Gagal',
    desc: 'Terjadi kendala saat memproses pembayaran. Silakan coba lagi.',
  },
  deny: {
    icon: '✕',
    iconClass: 'pay-error-icon',
    title: 'Pembayaran Ditolak',
    desc: 'Pembayaran Anda ditolak. Silakan coba dengan metode pembayaran lain.',
  },
  expire: {
    icon: '⏰',
    iconClass: 'pay-error-icon',
    title: 'Waktu Habis',
    desc: 'Waktu pembayaran telah habis. Silakan lakukan pembayaran ulang.',
  },
};

const PaymentResult = () => {
  const [searchParams] = useSearchParams();
  const status = searchParams.get('status') || 'settlement';
  const orderId = searchParams.get('order_id');

  // Auto-close popup: notify backend + postMessage to parent, then close self
  useEffect(() => {
    const status = searchParams.get('status') || 'settlement';
    const orderId = searchParams.get('order_id');
    const txnStatus = searchParams.get('transaction_status') || status;

    // For success/capture/settlement → notify backend immediately to update DB
    const isSuccess = ['settlement','success','capture'].includes(status);
    if (isSuccess && orderId) {
      API.post('/api/payments/snap-callback', {
        order_id: orderId,
        transaction_status: txnStatus,
      }).catch(() => {}); // fire-and-forget
    }

    if (window.opener && !window.opener.closed) {
      window.opener.postMessage({
        type: 'midtrans_payment_result',
        status,
        order_id: orderId
      }, window.location.origin);
      setTimeout(() => window.close(), isSuccess ? 1200 : 600);
    }
    setTimeout(() => window.close(), 500);
  }, []);

  const config = statusConfig[status] || statusConfig.error;

  return (
    <div className="pay-container">
      <motion.div className="pay-card pay-success-card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        {/* Brand */}
        <div className="pay-brand">
          <span className="pay-brand-icon">M</span>
          <span className="pay-brand-name">MAZNET</span>
        </div>

        <div className={config.iconClass}>{config.icon}</div>
        <h2>{config.title}</h2>
        <p>{config.desc}</p>

        {orderId && (
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
            Ref: {orderId}
          </p>
        )}

        <div style={{ marginTop: 24 }}>
          <Link to="/" className="pay-button" style={{ display: 'block', textDecoration: 'none', textAlign: 'center' }}>
            Kembali ke Beranda
          </Link>
        </div>

        {status === 'pending' && (
          <p className="pay-help">
            Jika sudah transfer, tunggu beberapa saat hingga status terupdate.
          </p>
        )}

        <div className="pay-footer">
          <p>Butuh bantuan? Hubungi <strong>admin@maznet.id</strong></p>
        </div>
      </motion.div>
    </div>
  );
};

export default PaymentResult;
