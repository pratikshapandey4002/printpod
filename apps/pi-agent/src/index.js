require('dotenv').config();
const WebSocket = require('ws');
const cron = require('node-cron');
const logger = require('./logger');
const { printFile, getPrinterStatus, waitForJobCompletion } = require('./printer');
const { downloadFile, cleanupFile, cleanupOldFiles } = require('./downloader');

// ─── Config ────────────────────────────────────────────────────────────────
const CLOUD_WS_URL = process.env.CLOUD_WS_URL; // e.g. wss://printpod.railway.app/pi-socket
const PI_SECRET    = process.env.PI_SECRET;     // shared secret to authenticate this Pi
const KIOSK_ID     = process.env.KIOSK_ID || 'kiosk-001';

if (!CLOUD_WS_URL || !PI_SECRET) {
  logger.error('Missing CLOUD_WS_URL or PI_SECRET in .env — cannot start');
  process.exit(1);
}

// ─── State ─────────────────────────────────────────────────────────────────
let ws = null;
let reconnectTimer = null;
let reconnectDelay = 3000; // starts at 3s, backs off to 30s
const MAX_RECONNECT_DELAY = 30000;

// ─── WebSocket connection ───────────────────────────────────────────────────
function connect() {
  logger.info(`Connecting to cloud: ${CLOUD_WS_URL}`);

  ws = new WebSocket(CLOUD_WS_URL, {
    headers: {
      'x-pi-secret': PI_SECRET,
      'x-kiosk-id': KIOSK_ID,
    },
  });

  ws.on('open', () => {
    logger.info('✓ Connected to PrintPod cloud');
    reconnectDelay = 3000; // reset backoff

    // Announce ourselves and send initial printer status
    sendToCloud({ type: 'HELLO', kioskId: KIOSK_ID });
    reportPrinterStatus();
  });

  ws.on('message', async (data) => {
    let msg;
    try {
      msg = JSON.parse(data.toString());
    } catch {
      logger.warn('Received non-JSON message from cloud');
      return;
    }

    logger.info(`← Cloud message: ${msg.type}`);
    await handleCloudMessage(msg);
  });

  ws.on('close', (code, reason) => {
    logger.warn(`WebSocket closed (${code}): ${reason?.toString() || 'no reason'}`);
    scheduleReconnect();
  });

  ws.on('error', (err) => {
    logger.error(`WebSocket error: ${err.message}`);
    // 'close' event fires after 'error', so reconnect is handled there
  });

  // Keep-alive ping every 30s to prevent NAT timeout
  const pingInterval = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.ping();
    } else {
      clearInterval(pingInterval);
    }
  }, 30000);
}

function scheduleReconnect() {
  if (reconnectTimer) return;
  logger.info(`Reconnecting in ${reconnectDelay / 1000}s...`);
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connect();
  }, reconnectDelay);
  reconnectDelay = Math.min(reconnectDelay * 1.5, MAX_RECONNECT_DELAY);
}

function sendToCloud(payload) {
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
  } else {
    logger.warn('Cannot send — WebSocket not open');
  }
}

// ─── Message handler ────────────────────────────────────────────────────────
async function handleCloudMessage(msg) {
  switch (msg.type) {

    // Cloud sends this when an OTP is verified — time to print
    case 'PRINT_JOB': {
      const { jobId, signedUrl, fileExtension, printOptions } = msg;
      logger.info(`[${jobId}] Print job received`);

      // Acknowledge receipt immediately
      sendToCloud({ type: 'JOB_ACK', jobId });

      try {
        // 1. Download file from R2
        sendToCloud({ type: 'JOB_STATUS', jobId, status: 'downloading' });
        const filePath = await downloadFile(jobId, signedUrl, fileExtension);

        // 2. Send to CUPS
        sendToCloud({ type: 'JOB_STATUS', jobId, status: 'printing' });
        const { success, cupsJobId, error } = await printFile(jobId, filePath, printOptions);

        if (!success) {
          throw new Error(error);
        }

        // 3. Wait for CUPS to finish
        const finalStatus = await waitForJobCompletion(cupsJobId);
        logger.info(`[${jobId}] CUPS job ${cupsJobId} finished: ${finalStatus}`);

        // 4. Notify cloud of completion
        sendToCloud({ type: 'JOB_STATUS', jobId, status: 'completed', cupsJobId });

        // 5. Clean up temp file
        cleanupFile(jobId, fileExtension);

      } catch (err) {
        logger.error(`[${jobId}] Job failed: ${err.message}`);
        sendToCloud({ type: 'JOB_STATUS', jobId, status: 'failed', error: err.message });
        cleanupFile(jobId, fileExtension);
      }
      break;
    }

    // Cloud can request a status update any time (for admin dashboard)
    case 'STATUS_REQUEST': {
      await reportPrinterStatus();
      break;
    }

    // Cloud acknowledged our ping
    case 'PONG': {
      break;
    }

    default:
      logger.warn(`Unknown message type: ${msg.type}`);
  }
}

// ─── Status reporting ───────────────────────────────────────────────────────
async function reportPrinterStatus() {
  const status = await getPrinterStatus();
  sendToCloud({
    type: 'PRINTER_STATUS',
    kioskId: KIOSK_ID,
    ...status,
    timestamp: new Date().toISOString(),
  });
}

// ─── Scheduled tasks ────────────────────────────────────────────────────────
// Report printer status every 2 minutes for the admin dashboard
cron.schedule('*/2 * * * *', () => {
  reportPrinterStatus();
});

// Clean up stale tmp files every hour (files older than 1 hour)
cron.schedule('0 * * * *', () => {
  cleanupOldFiles(60 * 60 * 1000);
});

// ─── Start ──────────────────────────────────────────────────────────────────
logger.info(`PrintPod Pi Agent starting — Kiosk ID: ${KIOSK_ID}`);
cleanupOldFiles(); // clean any leftover files from previous run
connect();

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received — shutting down gracefully');
  ws?.close();
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received — shutting down');
  ws?.close();
  process.exit(0);
});