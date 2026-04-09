const express = require('express');
const Razorpay = require('razorpay');
const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');
const { generateOTP, hashOTP, getOTPExpiry, sendOTPviaSMS } = require('../services/otp');
const logger = require('../logger');

const router = express.Router();
const prisma = new PrismaClient();

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

router.post('/create-order', async (req, res) => {
  const { jobId } = req.body;
  if (!jobId) return res.status(400).json({ success: false, error: 'jobId required' });

  try {
    const job = await prisma.job.findUnique({ where: { id: jobId } });
    if (!job) return res.status(404).json({ success: false, error: 'Job not found' });
    if (job.paymentStatus === 'paid') return res.status(400).json({ success: false, error: 'Already paid' });

    const order = await razorpay.orders.create({
      amount: Math.round(job.totalAmount * 100),
      currency: 'INR',
      receipt: jobId,
      notes: { jobId, phoneNumber: job.phoneNumber },
    });

    await prisma.job.update({ where: { id: jobId }, data: { razorpayOrderId: order.id, status: 'awaiting_payment' } });
    logger.info(`Razorpay order created: ${order.id} for job ${jobId}`);

    return res.json({
      success: true,
      order: { id: order.id, amount: order.amount, currency: order.currency },
      razorpayKeyId: process.env.RAZORPAY_KEY_ID,
    });
  } catch (err) {
    logger.error(`Order creation failed: ${err.message}`);
    return res.status(500).json({ success: false, error: 'Payment order creation failed' });
  }
});

router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const signature = req.headers['x-razorpay-signature'];
  const expected = crypto.createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
    .update(req.body).digest('hex');
  if (signature !== expected) return res.status(400).json({ error: 'Invalid signature' });

  const event = JSON.parse(req.body.toString());
  if (event.event === 'payment.captured') {
    const payment = event.payload.payment.entity;
    const job = await prisma.job.findFirst({ where: { razorpayOrderId: payment.order_id } });
    if (job) {
      const otp = generateOTP();
      const otpHash = await hashOTP(otp);
      await prisma.job.update({
        where: { id: job.id },
        data: { paymentStatus:'paid', razorpayPaymentId:payment.id, status:'paid', otpHash, otpExpiresAt:getOTPExpiry() },
      });
      await sendOTPviaSMS(job.phoneNumber, otp);
      logger.info(`Payment confirmed for job ${job.id}`);
    }
  }
  res.json({ received: true });
});

router.post('/verify', async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, jobId } = req.body;
  const expected = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`).digest('hex');

  if (expected !== razorpay_signature)
    return res.status(400).json({ success: false, error: 'Invalid payment signature' });

  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (job?.paymentStatus === 'paid')
    return res.json({ success: true, message: 'Already confirmed' });

  const otp = generateOTP();
  const otpHash = await hashOTP(otp);
  await prisma.job.update({
    where: { id: jobId },
    data: { paymentStatus:'paid', razorpayPaymentId:razorpay_payment_id, status:'paid', otpHash, otpExpiresAt:getOTPExpiry() },
  });
  await sendOTPviaSMS(job.phoneNumber, otp);
  return res.json({ success: true, message: 'Payment verified, OTP sent' });
});

module.exports = router;
