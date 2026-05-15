const express = require('express');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const { PrismaClient } = require('@prisma/client');
const { getMulterS3Storage } = require('../services/storage');
const { calculatePrice, getPriceList } = require('../services/pricing');
const { generateOTP, hashOTP, getOTPExpiry } = require('../services/otp');
const logger = require('../logger');

const router = express.Router();
const prisma = new PrismaClient();

const upload = multer({
  storage: getMulterS3Storage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];
    allowed.includes(file.mimetype) ? cb(null, true) : cb(new Error('Only PDF, DOC, DOCX allowed'));
  },
});

router.get('/prices', (req, res) => {
  res.json({ success: true, prices: getPriceList() });
});

router.post('/upload', (req, res) => {
  req.jobId = uuidv4();
  upload.single('document')(req, res, async (err) => {
    if (err) return res.status(400).json({ success: false, error: err.message });
    if (!req.file) return res.status(400).json({ success: false, error: 'No file uploaded' });

    const { phoneNumber, copies=1, color='mono', sides='one-sided',
            paperSize='A4', quality='normal', orientation='portrait' } = req.body;

    if (!phoneNumber || !/^[6-9]\d{9}$/.test(phoneNumber))
      return res.status(400).json({ success: false, error: 'Valid 10-digit Indian phone number required' });

    try {
      const pageCount = 1;
      const printOptions = { copies: parseInt(copies), color, sides, paperSize, quality, orientation };
      const { pricePerPage, totalAmount } = calculatePrice({ pageCount, ...printOptions });

      const job = await prisma.job.create({
        data: {
          id: req.jobId,
          phoneNumber,
          originalName: req.file.originalname,
          fileKey: req.file.key || req.fileKey,
          fileExtension: '.' + req.file.originalname.split('.').pop().toLowerCase(),
          pageCount,
          ...printOptions,
          pricePerPage,
          totalAmount,
          status: 'created',
          paymentStatus: 'pending',
        },
      });

      logger.info(`Job created: ${job.id} | ₹${totalAmount}`);
      return res.json({
        success: true,
        jobId: job.id,
        pageCount,
        printOptions,
        pricing: { pricePerPage, totalAmount, currency: 'INR' },
      });
    } catch (dbErr) {
      logger.error(`Job creation failed: ${dbErr.message}`);
      return res.status(500).json({ success: false, error: 'Failed to create job' });
    }
  });
});

// Store OTPs in memory to avoid regenerating
const otpCache = new Map();

router.get('/:id/otp', async (req, res) => {
  try {
    const job = await prisma.job.findUnique({
      where: { id: req.params.id },
      select: { id: true, paymentStatus: true, otpExpiresAt: true, otpUsed: true },
    });
    if (!job) return res.status(404).json({ success: false, error: 'Job not found' });
    if (job.paymentStatus !== 'paid') return res.status(400).json({ success: false, error: 'Payment not confirmed yet' });
    if (job.otpUsed) return res.status(400).json({ success: false, error: 'OTP already used' });

    // Return cached OTP if exists and not expired
    if (otpCache.has(req.params.id)) {
      const cached = otpCache.get(req.params.id)
      if (cached.expiresAt > Date.now()) {
        logger.info(`OTP served from cache for job ${req.params.id}: ${cached.otp}`)
        return res.json({ success: true, otp: cached.otp })
      }
    }

    // Generate new OTP only once
    const otp = generateOTP();
    const otpHash = await hashOTP(otp);
    const otpExpiresAt = getOTPExpiry();

    await prisma.job.update({
      where: { id: req.params.id },
      data: { otpHash, otpExpiresAt, otpUsed: false },
    });

    // Cache it
    otpCache.set(req.params.id, { otp, expiresAt: otpExpiresAt.getTime() })

    logger.info(`OTP generated for job ${req.params.id}: ${otp}`);
    return res.json({ success: true, otp });
  } catch (err) {
    logger.error(`OTP fetch error: ${err.message}`);
    return res.status(500).json({ success: false, error: 'Failed to fetch OTP' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const job = await prisma.job.findUnique({
      where: { id: req.params.id },
      select: { id:true, status:true, pageCount:true, copies:true,
        color:true, sides:true, totalAmount:true, paymentStatus:true,
        originalName:true, createdAt:true, kioskId:true },
    });
    if (!job) return res.status(404).json({ success: false, error: 'Job not found' });
    res.json({ success: true, job });
  } catch {
    res.status(500).json({ success: false, error: 'Database error' });
  }
});

module.exports = router;
