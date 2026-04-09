const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const logger = require('./logger');

const TMP_DIR = path.join(__dirname, '../../tmp');

// Ensure tmp dir exists
if (!fs.existsSync(TMP_DIR)) {
  fs.mkdirSync(TMP_DIR, { recursive: true });
}

/**
 * Download a file from a signed URL (R2 presigned URL) to local tmp directory
 * @param {string} jobId       - PrintPod job ID (used as filename base)
 * @param {string} signedUrl   - presigned download URL from cloud server
 * @param {string} extension   - file extension e.g. '.pdf'
 * @returns {Promise<string>}  - absolute path to downloaded file
 */
function downloadFile(jobId, signedUrl, extension = '.pdf') {
  return new Promise((resolve, reject) => {
    const filename = `job_${jobId}${extension}`;
    const destPath = path.join(TMP_DIR, filename);

    // Don't re-download if already exists (retry safety)
    if (fs.existsSync(destPath)) {
      logger.info(`[${jobId}] File already downloaded: ${destPath}`);
      resolve(destPath);
      return;
    }

    logger.info(`[${jobId}] Downloading file from signed URL...`);

    const fileStream = fs.createWriteStream(destPath);
    const protocol = signedUrl.startsWith('https') ? https : http;

    const request = protocol.get(signedUrl, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        // Handle redirects
        fileStream.close();
        fs.unlinkSync(destPath);
        downloadFile(jobId, response.headers.location, extension)
          .then(resolve)
          .catch(reject);
        return;
      }

      if (response.statusCode !== 200) {
        fileStream.close();
        fs.unlinkSync(destPath);
        reject(new Error(`Download failed with status ${response.statusCode}`));
        return;
      }

      response.pipe(fileStream);

      fileStream.on('finish', () => {
        fileStream.close();
        const stats = fs.statSync(destPath);
        logger.info(`[${jobId}] Download complete: ${destPath} (${(stats.size / 1024).toFixed(1)} KB)`);
        resolve(destPath);
      });
    });

    request.on('error', (err) => {
      fileStream.close();
      if (fs.existsSync(destPath)) fs.unlinkSync(destPath);
      logger.error(`[${jobId}] Download error: ${err.message}`);
      reject(err);
    });

    // 60 second timeout for download
    request.setTimeout(60000, () => {
      request.destroy();
      reject(new Error('Download timed out after 60s'));
    });
  });
}

/**
 * Delete a job's temp file after printing
 * @param {string} jobId
 * @param {string} extension
 */
function cleanupFile(jobId, extension = '.pdf') {
  const patterns = [
    path.join(TMP_DIR, `job_${jobId}${extension}`),
    path.join(TMP_DIR, `job_${jobId}_converted.pdf`),
  ];

  for (const filePath of patterns) {
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
        logger.info(`[${jobId}] Cleaned up: ${filePath}`);
      } catch (err) {
        logger.warn(`[${jobId}] Could not delete ${filePath}: ${err.message}`);
      }
    }
  }
}

/**
 * Clean up all tmp files older than maxAgeMs (safety net)
 * Called on startup and periodically
 */
function cleanupOldFiles(maxAgeMs = 60 * 60 * 1000) {
  const now = Date.now();
  const files = fs.readdirSync(TMP_DIR);

  let cleaned = 0;
  for (const file of files) {
    const filePath = path.join(TMP_DIR, file);
    const stat = fs.statSync(filePath);
    if (now - stat.mtimeMs > maxAgeMs) {
      fs.unlinkSync(filePath);
      cleaned++;
    }
  }

  if (cleaned > 0) {
    logger.info(`Cleanup: removed ${cleaned} stale temp file(s)`);
  }
}

module.exports = { downloadFile, cleanupFile, cleanupOldFiles };