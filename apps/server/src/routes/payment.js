const express = require('express');
const DodoPayments = require('dodopayments').default;
const { Webhook } = require('standardwebhooks');
const { PrismaClient } = require('@prisma/client');
const { generateOTP, hashOTP, getOTPExpiry, sendOTPviaSMS } = require('../services/otp');
const logger = require('../logger');

const router = express.Router();
const prisma = new PrismaClient();

const dodo = new DodoPayments({
  bearerToken: process.env.DODO_API_KEY,
  environment: process.env.DODO_ENVIRONMENT || 'test_mode',
});

// ─── POST /payment/create-checkout ───────────────────────────────────────────
// Creates a Dodo checkout session and returns the checkout URL
router.post('/create-checkout', async (req, res) => {
  const { jobId } = req.body;
  if (!jobId) return res.status(400).json({ success: false, error: 'jobId required' });

  try {
    const job = await prisma.job.findUnique({ where: { id: jobId } });
    if (!job) return res.status(404).json({ success: false, error: 'Job not found' });
    if (job.paymentStatus === 'paid') return res.status(400).json({ success: false, error: 'Already paid' });

    const session = await dodo.checkoutSessions.create({
      product_cart: [{
        product_id: process.env.DODO_PRODUCT_ID,
        quantity: 1,
      }],
      customer: {
        email: job.userEmail || `${job.phoneNumber}@printpod.app`,
        name: `PrintPod User`,
      },
      billing: {
        city: 'Mumbai',
        country: 'IN',
        state: 'Maharashtra',
        street: 'NA',
        zipcode: 400001,
      },
      return_url: `${process.env.WEB_PORTAL_URL}/success?jobId=${jobId}`,
      metadata: { jobId },
    });

    // Save session ID to job
    await prisma.job.update({
      where: { id: jobId },
      data: { razorpayOrderId: session.session_id, status: 'awaiting_payment' },
    });

    logger.info(`Dodo checkout created: ${session.session_id} for job ${jobId}`);

    return res.json({
      success: true,
      checkoutUrl: session.url,
      sessionId: session.session_id,
    });
  } catch (err) {
    logger.error(`Dodo checkout creation failed: ${err.message}`);
    return res.status(500).json({ success: false, error: 'Payment session creation failed' });
  }
});

// ─── POST /payment/dodo-webhook ───────────────────────────────────────────────
// Dodo calls this after payment succeeds
router.post('/dodo-webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const webhookId = req.headers['webhook-id'];
  const webhookSignature = req.headers['webhook-signature'];
  const webhookTimestamp = req.headers['webhook-timestamp'];

  if (!webhookId || !webhookSignature || !webhookTimestamp) {
    return res.status(400).json({ error: 'Missing webhook headers' });
  }

  try {
    const wh = new Webhook(process.env.DODO_WEBHOOK_SECRET);
    const payload = await wh.verify(req.body.toString(), {
      'webhook-id': webhookId,
      'webhook-signature': webhookSignature,
      'webhook-timestamp': webhookTimestamp,
    });

    const event = JSON.parse(req.body.toString());
    logger.info(`Dodo webhook: ${event.event_type}`);

    if (event.event_type === 'payment.succeeded') {
      const jobId = event.data?.metadata?.jobId;
      if (!jobId) {
        logger.warn('No jobId in webhook metadata');
        return res.json({ received: true });
      }

      const job = await prisma.job.findUnique({ where: { id: jobId } });
      if (!job) {
        logger.warn(`Job not found for webhook: ${jobId}`);
        return res.json({ received: true });
      }

      if (job.paymentStatus === 'paid') {
        logger.info(`Job ${jobId} already paid — skipping`);
        return res.json({ received: true });
      }

      // Generate OTP
      const otp = generateOTP();
      const otpHash = await hashOTP(otp);

      await prisma.job.update({
        where: { id: jobId },
        data: {
          paymentStatus: 'paid',
          razorpayPaymentId: event.data?.payment_id || 'dodo',
          status: 'paid',
          otpHash,
          otpExpiresAt: getOTPExpiry(),
        },
      });

      // Send OTP via SMS (or log in dev mode)
      await sendOTPviaSMS(job.phoneNumber, otp);
      logger.info(`Payment confirmed for job ${jobId} — OTP sent`);
    }

    res.json({ received: true });
  } catch (err) {
    logger.error(`Dodo webhook error: ${err.message}`);
    return res.status(400).json({ error: 'Webhook verification failed' });
  }
});

// ─── GET /payment/status/:jobId ───────────────────────────────────────────────
// Web portal polls this after redirect back from Dodo checkout
router.get('/status/:jobId', async (req, res) => {
  try {
    const job = await prisma.job.findUnique({
      where: { id: req.params.jobId },
      select: { id: true, paymentStatus: true, status: true, phoneNumber: true },
    });
    if (!job) return res.status(404).json({ success: false, error: 'Job not found' });
    res.json({ success: true, paymentStatus: job.paymentStatus, status: job.status });
  } catch {
    res.status(500).json({ success: false, error: 'Database error' });
  }
});

module.exports = router;
