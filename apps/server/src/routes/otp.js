const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { verifyOTP } = require('../services/otp');
const { getPresignedDownloadUrl, deleteFile } = require('../services/storage');
const { dispatchPrintJob, getConnectedKiosks } = require('../websocket/piSocket');
const logger = require('../logger');

const router = express.Router();
const prisma = new PrismaClient();

router.post('/verify', async (req, res) => {
  const { otp, kioskId } = req.body;

  if (!otp || !/^\d{6}$/.test(otp))
    return res.status(400).json({ success: false, error: 'Invalid OTP format' });
  if (!kioskId)
    return res.status(400).json({ success: false, error: 'kioskId required' });

  try {
    const candidates = await prisma.job.findMany({
      where: { status: 'paid', otpUsed: false, otpExpiresAt: { gt: new Date() }, paymentStatus: 'paid' },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    let matchedJob = null;
    for (const job of candidates) {
      if (job.otpHash && await verifyOTP(otp, job.otpHash)) {
        matchedJob = job;
        break;
      }
    }

    if (!matchedJob)
      return res.status(401).json({ success: false, error: 'Invalid or expired OTP. Please try again.' });

    await prisma.job.update({
      where: { id: matchedJob.id },
      data: { otpUsed: true, status: 'queued', kioskId },
    });

    const signedUrl = await getPresignedDownloadUrl(matchedJob.fileKey, 1800);

    const dispatched = dispatchPrintJob(kioskId, {
      jobId: matchedJob.id,
      signedUrl,
      fileExtension: matchedJob.fileExtension,
      printOptions: {
        copies: matchedJob.copies,
        color: matchedJob.color,
        sides: matchedJob.sides,
        paperSize: matchedJob.paperSize,
        quality: matchedJob.quality,
        orientation: matchedJob.orientation,
      },
    });

    if (!dispatched) {
      await prisma.job.update({
        where: { id: matchedJob.id },
        data: { otpUsed: false, status: 'paid', kioskId: null },
      });
      return res.status(503).json({ success: false, error: 'Printer offline. Please try again shortly.' });
    }

    setTimeout(async () => {
      const job = await prisma.job.findUnique({ where: { id: matchedJob.id } });
      if (job && ['completed', 'failed'].includes(job.status)) {
        await deleteFile(matchedJob.fileKey);
        await prisma.job.update({ where: { id: matchedJob.id }, data: { fileDeleted: true } });
      }
    }, 2 * 60 * 60 * 1000);

    logger.info(`Print job ${matchedJob.id} dispatched to kiosk ${kioskId}`);
    return res.json({
      success: true,
      message: 'OTP verified! Your document is printing now.',
      jobId: matchedJob.id,
      pages: matchedJob.pageCount,
      copies: matchedJob.copies,
    });
  } catch (err) {
    logger.error(`OTP verify error: ${err.message}`);
    return res.status(500).json({ success: false, error: 'Verification failed' });
  }
});

router.get('/kiosks', (req, res) => {
  res.json({ success: true, connectedKiosks: getConnectedKiosks() });
});

module.exports = router;
