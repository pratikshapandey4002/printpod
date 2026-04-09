const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const logger = require('../logger');

const router = express.Router();
const prisma = new PrismaClient();

// ─── Middleware: verify admin JWT ─────────────────────────────────────────────
function requireAdmin(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }
  try {
    req.admin = jwt.verify(auth.split(' ')[1], process.env.JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// ─── POST /admin/login ────────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }

  const admin = await prisma.admin.findUnique({ where: { email } });
  if (!admin || !(await bcrypt.compare(password, admin.password))) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = jwt.sign({ id: admin.id, email: admin.email }, process.env.JWT_SECRET, {
    expiresIn: '7d',
  });

  res.json({ success: true, token });
});

// ─── GET /admin/overview ──────────────────────────────────────────────────────
router.get('/overview', requireAdmin, async (req, res) => {
  try {
    const [totalJobs, completedJobs, failedJobs, totalRevenue, kiosks] = await Promise.all([
      prisma.job.count(),
      prisma.job.count({ where: { status: 'completed' } }),
      prisma.job.count({ where: { status: 'failed' } }),
      prisma.job.aggregate({
        where: { paymentStatus: 'paid' },
        _sum: { totalAmount: true },
      }),
      prisma.kiosk.findMany(),
    ]);

    // Jobs in last 7 days
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentJobs = await prisma.job.count({ where: { createdAt: { gte: weekAgo } } });
    const recentRevenue = await prisma.job.aggregate({
      where: { paymentStatus: 'paid', createdAt: { gte: weekAgo } },
      _sum: { totalAmount: true },
    });

    res.json({
      success: true,
      overview: {
        totalJobs,
        completedJobs,
        failedJobs,
        successRate: totalJobs > 0 ? ((completedJobs / totalJobs) * 100).toFixed(1) : 0,
        totalRevenue: totalRevenue._sum.totalAmount || 0,
        recentJobs,
        recentRevenue: recentRevenue._sum.totalAmount || 0,
        kiosks: kiosks.map(k => ({
          id: k.id,
          location: k.location,
          isOnline: k.isOnline,
          printerReady: k.printerReady,
          printerStatus: k.printerStatus,
          lastSeen: k.lastSeenAt,
        })),
      },
    });
  } catch (err) {
    logger.error(`Admin overview error: ${err.message}`);
    res.status(500).json({ error: 'Failed to fetch overview' });
  }
});

// ─── GET /admin/jobs ──────────────────────────────────────────────────────────
router.get('/jobs', requireAdmin, async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const status = req.query.status;

  try {
    const where = status ? { status } : {};
    const [jobs, total] = await Promise.all([
      prisma.job.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true, createdAt: true, status: true, paymentStatus: true,
          originalName: true, pageCount: true, copies: true, color: true,
          sides: true, totalAmount: true, phoneNumber: true, kioskId: true,
        },
      }),
      prisma.job.count({ where }),
    ]);

    res.json({ success: true, jobs, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch jobs' });
  }
});

// ─── POST /admin/seed ─────────────────────────────────────────────────────────
// One-time: create the first admin user. Disable after setup!
router.post('/seed', async (req, res) => {
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_ADMIN_SEED !== 'true') {
    return res.status(403).json({ error: 'Seeding disabled in production' });
  }

  const { email, password } = req.body;
  if (!email || !password || password.length < 8) {
    return res.status(400).json({ error: 'Email and password (min 8 chars) required' });
  }

  const existing = await prisma.admin.findUnique({ where: { email } });
  if (existing) return res.status(409).json({ error: 'Admin already exists' });

  const hashed = await bcrypt.hash(password, 10);
  await prisma.admin.create({ data: { email, password: hashed } });

  res.json({ success: true, message: 'Admin created. Disable /admin/seed now!' });
});

module.exports = router;