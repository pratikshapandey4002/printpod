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

router.post('/create-checkout', async (req, res) => {
  const { jobId } = req.body;
  if (!jobId) return res.status(400).json({ success: false, error: 'jobId required' });

  try {
    const job = await prisma.job.findUnique({ where: { id: jobId } });
    if (!job) return res.status(404).json({ success: false, error: 'Job not found' });
    if (job.paymentStatus === 'paid') return res.status(400).json({ success: false, error: 'Already paid' });

    const payment = await dodo.payments.create({
      payment_link: true,
      billing: {
        city: 'Mumbai',
        country: 'IN',
        state: 'Maharashtra',
        street: 'NA',
        zipcode: 400001,
      },
      customer: {
        email: `${job.phoneNumber}@printpod.app`,
        name: 'PrintPod User',
      },
      product_cart: [{
        product_id: process.env.DODO_PRODUCT_ID,
        quantity: 1,
      }],
      metadata: { jobId },
      return_url: `${process.env.WEB_PORTAL_URL}/success?jobId=${jobId}`,
    });

    logger.info(`Dodo payment created: ${JSON.stringify(payment)}`);

    // Save payment ID to job
    await prisma.job.update({
      where: { id: jobId },
      data: { razorpayOrderId: payment.payment_id, status: 'awaiting_payment' },
    });

    const checkoutUrl = payment.payment_link;

    if (!checkoutUrl) {
      logger.error(`No payment_link in Dodo response: ${JSON.stringify(payment)}`);
      return res.status(500).json({ success: false, error: 'No checkout URL returned from Dodo' });
    }

    logger.info(`Dodo checkout URL: ${checkoutUrl} for job ${jobId}`);

    return res.json({
      success: true,
      checkoutUrl,
      paymentId: payment.payment_id,
    });
  } catch (err) {
    logger.error(`Dodo checkout creation failed: ${err.message}`);
    return res.status(500).json({ success: false, error: 'Payment session creation failed' });
  }
});

router.post('/dodo-webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const webhookId = req.headers['webhook-id'];
  const webhookSignature = req.headers['webhook-signature'];
  const webhookTimestamp = req.headers['webhook-timestamp'];

  if (!webhookId || !webhookSignature || !webhookTimestamp) {
    return res.status(400).json({ error: 'Missing webhook headers' });
  }

  try {
    const wh = new Webhook(process.env.DODO_WEBHOOK_SECRET);
    await wh.verify(req.body.toString(), {
      'webhook-id': webhookId,
      'webhook-signature': webhookSignature,
      'webhook-timestamp': webhookTimestamp,
    });

    const event = JSON.parse(req.body.toString());
    logger.info(`Dodo webhook: ${event.event_type}`);

    if (event.event_type === 'payment.succeeded') {
      const jobId = event.data?.metadata?.jobId;
      if (!jobId) { logger.warn('No jobId in webhook metadata'); return res.json({ received: true }); }

      const job = await prisma.job.findUnique({ where: { id: jobId } });
      if (!job) { logger.warn(`Job not found: ${jobId}`); return res.json({ received: true }); }
      if (job.paymentStatus === 'paid') { return res.json({ received: true }); }

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

      await sendOTPviaSMS(job.phoneNumber, otp);
      logger.info(`Payment confirmed for job ${jobId} — OTP: ${otp}`);
    }

    res.json({ received: true });
  } catch (err) {
    logger.error(`Dodo webhook error: ${err.message}`);
    return res.status(400).json({ error: 'Webhook verification failed' });
  }
});

router.get('/status/:jobId', async (req, res) => {
  try {
    const job = await prisma.job.findUnique({
      where: { id: req.params.jobId },
      select: { id: true, paymentStatus: true, status: true },
    });
    if (!job) return res.status(404).json({ success: false, error: 'Job not found' });
    res.json({ success: true, paymentStatus: job.paymentStatus, status: job.status });
  } catch {
    res.status(500).json({ success: false, error: 'Database error' });
  }
});

module.exports = router;
