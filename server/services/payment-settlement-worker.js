import midtransClient from 'midtrans-client';

export function startPaymentSettlementWorker(db) {
  console.log('🔄 Payment Settlement Background Worker started (interval: 30s)');

  setInterval(async () => {
    try {
      // 1. Fetch Midtrans payment settings
      const settings = await db.get("SELECT * FROM payment_settings WHERE gateway = 'midtrans' LIMIT 1");
      if (!settings || !settings.server_key) {
        // Silently skip if not configured
        return;
      }

      const core = new midtransClient.CoreApi({
        isProduction: !settings.is_sandbox,
        serverKey: settings.server_key,
        clientKey: settings.client_key
      });

      // 2. Fetch pending midtrans payments (created within last 24h, limit 10)
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
        .toISOString().slice(0, 19).replace('T', ' ');
      const pendingPayments = await db.all(
        `SELECT id, invoice_id, transaction_id FROM payments
         WHERE status = 'pending' AND payment_method IN ('midtrans', 'midtrans_snap')
         AND transaction_id IS NOT NULL AND created_at > ?
         ORDER BY created_at ASC LIMIT 10`,
        [twentyFourHoursAgo]
      );

      if (pendingPayments.length === 0) return;

      console.log(`[PaymentWorker] Checking ${pendingPayments.length} pending payments...`);

      let settled = 0, failed = 0, pending = 0;
      for (const p of pendingPayments) {
        try {
          const resp = await core.transaction.status(p.transaction_id);
          const txnStatus = resp.transaction_status;
          const fraudStatus = resp.fraud_status;

          let newStatus;
          if (txnStatus === 'capture') {
            newStatus = (fraudStatus === 'accept') ? 'success' : 'pending';
          } else if (txnStatus === 'settlement') {
            newStatus = 'success';
          } else if (['cancel', 'deny', 'expire', 'failure'].includes(txnStatus)) {
            newStatus = 'failed';
          } else {
            newStatus = null;
          }

          if (newStatus === 'success') {
            await db.run(
              'UPDATE payments SET status = ?, paid_at = NOW(), payment_details = ? WHERE id = ?',
              [newStatus, JSON.stringify(resp), p.id]
            );
            await db.run('UPDATE invoices SET status = ? WHERE id = ?', ['paid', p.invoice_id]);
            settled++;
            console.log(`[PaymentWorker] Payment #${p.id} → SUCCESS, invoice #${p.invoice_id} → paid`);
          } else if (newStatus === 'failed') {
            await db.run(
              'UPDATE payments SET status = ?, payment_details = ? WHERE id = ?',
              [newStatus, JSON.stringify(resp), p.id]
            );
            failed++;
          } else {
            pending++;
          }
        } catch (err) {
          pending++;
          // Single payment check failure shouldn't stop the batch
        }
      }

      if (settled > 0 || failed > 0) {
        console.log(`[PaymentWorker] ${pendingPayments.length} checked → ${settled} settled, ${failed} failed, ${pending} still pending`);
      }
    } catch (error) {
      console.error('[PaymentWorker] Error:', error.message);
    }
  }, 30_000);
}
