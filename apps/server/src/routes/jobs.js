const express = require('express');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const { PrismaClient } = require('@prisma/client');
const { getMulterS3Storage } = require('../services/storage');
const { calculatePrice, getPriceList } = require('../services/pricing');
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
