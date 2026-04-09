const { WebSocketServer, WebSocket } = require('ws');
const { PrismaClient } = require('@prisma/client');
const logger = require('../logger');

const prisma = new PrismaClient();
const connectedKiosks = new Map();

function initPiSocket(httpServer) {
  const wss = new WebSocketServer({ server: httpServer, path: '/pi-socket' });

  wss.on('connection', (ws, req) => {
    const piSecret = req.headers['x-pi-secret'];
    const kioskId = req.headers['x-kiosk-id'] || 'unknown';

    if (piSecret !== process.env.PI_SECRET) {
      logger.warn(`Rejected Pi connection from ${kioskId}`);
      ws.close(1008, 'Unauthorized');
      return;
    }

    logger.info(`Pi connected: ${kioskId}`);
    connectedKiosks.set(kioskId, ws);

    prisma.kiosk.upsert({
      where: { id: kioskId },
      update: { isOnline: true, lastSeenAt: new Date() },
      create: { id: kioskId, location: 'Unknown', isOnline: true, lastSeenAt: new Date() },
    }).catch(err => logger.error(`Kiosk upsert error: ${err.message}`));

    ws.on('message', (data) => {
      let msg;
      try { msg = JSON.parse(data.toString()); } catch { return; }
      handlePiMessage(kioskId, msg);
    });

    ws.on('pong', () => {
      prisma.kiosk.update({ where: { id: kioskId }, data: { lastSeenAt: new Date() } }).catch(() => {});
    });

    ws.on('close', () => {
      logger.info(`Pi disconnected: ${kioskId}`);
      connectedKiosks.delete(kioskId);
      prisma.kiosk.update({ where: { id: kioskId }, data: { isOnline: false } }).catch(() => {});
    });

    ws.on('error', (err) => logger.error(`Pi socket error (${kioskId}): ${err.message}`));
  });

  setInterval(() => {
    for (const [kioskId, ws] of connectedKiosks) {
      if (ws.readyState === WebSocket.OPEN) ws.ping();
      else connectedKiosks.delete(kioskId);
    }
  }, 30000);

  logger.info('Pi WebSocket server ready at /pi-socket');
  return wss;
}

async function handlePiMessage(kioskId, msg) {
  logger.info(`← Pi [${kioskId}]: ${msg.type}`);
  switch (msg.type) {
    case 'HELLO':
      sendToKiosk(kioskId, { type: 'WELCOME', message: 'PrintPod cloud connected' });
      break;
    case 'PRINTER_STATUS':
      await prisma.kiosk.update({
        where: { id: kioskId },
        data: { printerReady: msg.ready, printerStatus: msg.status, lastSeenAt: new Date() },
      }).catch(() => {});
      break;
    case 'JOB_STATUS':
      await prisma.job.update({
        where: { id: msg.jobId },
        data: {
          status: msg.status,
          cupsJobId: msg.cupsJobId || undefined,
          errorMessage: msg.error || undefined,
          kioskId,
          ...(msg.status === 'completed' ? { fileDeleted: true } : {}),
        },
      }).catch(err => logger.error(`Job status update failed: ${err.message}`));
      break;
    default:
      logger.warn(`Unknown Pi message: ${msg.type}`);
  }
}

function sendToKiosk(kioskId, payload) {
  const ws = connectedKiosks.get(kioskId);
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    logger.warn(`Kiosk ${kioskId} not connected`);
    return false;
  }
  ws.send(JSON.stringify(payload));
  logger.info(`→ Pi [${kioskId}]: ${payload.type}`);
  return true;
}

function dispatchPrintJob(kioskId, jobPayload) {
  return sendToKiosk(kioskId, { type: 'PRINT_JOB', ...jobPayload });
}

function getConnectedKiosks() {
  return Array.from(connectedKiosks.keys());
}

module.exports = { initPiSocket, sendToKiosk, dispatchPrintJob, getConnectedKiosks };
