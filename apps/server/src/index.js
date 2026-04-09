require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const logger = require('./logger');
const { initPiSocket } = require('./websocket/piSocket');

const app = express();
const server = http.createServer(app);

app.use(helmet());
app.use(cors({
  origin: [
    'https://printpod-two.vercel.app',
    'https://printpod-mnrf.vercel.app',
    'http://localhost:5173',
    'http://localhost:5174',
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }));

app.use('/payment/webhook', express.raw({ type: 'application/json' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.use('/jobs',    require('./routes/jobs'));
app.use('/payment', require('./routes/payment'));
app.use('/otp',     require('./routes/otp'));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'PrintPod Cloud', timestamp: new Date().toISOString() });
});

app.use((req, res) => res.status(404).json({ error: `Not found: ${req.method} ${req.path}` }));
app.use((err, req, res, next) => {
  logger.error(`Error: ${err.message}`);
  res.status(500).json({ error: 'Internal server error' });
});

initPiSocket(server);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  logger.info(`PrintPod server running on port ${PORT}`);
  logger.info(`Pi WebSocket endpoint: ws://localhost:${PORT}/pi-socket`);
  logger.info(`Health check: http://localhost:${PORT}/health`);
});

module.exports = { app, server };
