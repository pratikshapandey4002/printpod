const { exec, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const logger = require('./logger');

const PRINTER_NAME = 'Brother_DCP_L2680DW';

/**
 * Build the lp options string from job settings
 * @param {Object} options
 * @param {number} options.copies       - number of copies (default 1)
 * @param {string} options.color        - 'mono' | 'color' (default 'mono')
 * @param {string} options.sides        - 'one-sided' | 'two-sided-long-edge' (default 'one-sided')
 * @param {string} options.paperSize    - 'A4' | 'Letter' (default 'A4')
 * @param {string} options.orientation  - 'portrait' | 'landscape' (default 'portrait')
 * @param {string} options.quality      - 'draft' | 'normal' | 'high' (default 'normal')
 */
function buildLpOptions(options = {}) {
  const {
    copies = 1,
    color = 'mono',
    sides = 'one-sided',
    paperSize = 'A4',
    orientation = 'portrait',
    quality = 'normal',
  } = options;

  const opts = [];

  // Copies
  opts.push(`-n ${parseInt(copies, 10)}`);

  // Paper size
  opts.push(`-o media=${paperSize}`);

  // Duplex
  opts.push(`-o sides=${sides}`);

  // Color / Mono — Brother uses ColorModel option
  if (color === 'mono') {
    opts.push('-o ColorModel=Gray');
  }

  // Orientation
  if (orientation === 'landscape') {
    opts.push('-o landscape');
  }

  // Print quality (Brother maps to Resolution)
  const qualityMap = { draft: '300dpi', normal: '600dpi', high: '1200dpi' };
  const resolution = qualityMap[quality] || '600dpi';
  opts.push(`-o Resolution=${resolution}`);

  // Fit to page (prevents clipping)
  opts.push('-o fit-to-page');

  return opts.join(' ');
}

/**
 * Get current printer status from CUPS
 * @returns {Promise<{ready: boolean, status: string, jobCount: number}>}
 */
function getPrinterStatus() {
  return new Promise((resolve) => {
    exec(`lpstat -p ${PRINTER_NAME} 2>&1`, (err, stdout) => {
      if (err || stdout.includes('not found') || stdout.includes('unknown')) {
        resolve({ ready: false, status: 'Printer not found', jobCount: 0 });
        return;
      }

      const ready =
        stdout.includes('idle') || stdout.includes('ready') || stdout.includes('enabled');
      const status = stdout.trim().split('\n')[0] || 'Unknown';

      // Count pending jobs
      exec(`lpq -P ${PRINTER_NAME} 2>&1`, (err2, stdout2) => {
        const jobCount = (stdout2.match(/\d+ job/g) || []).length;
        resolve({ ready, status, jobCount });
      });
    });
  });
}

/**
 * Print a file using CUPS lp command
 * @param {string} jobId        - PrintPod job ID (used for logging)
 * @param {string} filePath     - absolute path to file on Pi
 * @param {Object} printOptions - print settings from the job
 * @returns {Promise<{success: boolean, cupsJobId: string|null, error: string|null}>}
 */
function printFile(jobId, filePath, printOptions = {}) {
  return new Promise((resolve) => {
    // Validate file exists
    if (!fs.existsSync(filePath)) {
      logger.error(`[${jobId}] File not found: ${filePath}`);
      resolve({ success: false, cupsJobId: null, error: 'File not found on disk' });
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const lpOptions = buildLpOptions(printOptions);

    // Build the lp command
    // For PDFs: lp handles them natively via CUPS PDF filter
    // For DOCX: we convert to PDF first via LibreOffice
    let command;
    if (ext === '.pdf') {
      command = `lp -d ${PRINTER_NAME} ${lpOptions} "${filePath}"`;
    } else if (['.doc', '.docx', '.odt', '.txt'].includes(ext)) {
      // Convert to PDF in temp dir, then print
      const tmpPdf = filePath.replace(ext, '_converted.pdf');
      command = `libreoffice --headless --convert-to pdf "${filePath}" --outdir "${path.dirname(filePath)}" && lp -d ${PRINTER_NAME} ${lpOptions} "${tmpPdf}"`;
    } else {
      resolve({ success: false, cupsJobId: null, error: `Unsupported file type: ${ext}` });
      return;
    }

    logger.info(`[${jobId}] Sending to CUPS: ${command}`);

    exec(command, { timeout: 60000 }, (err, stdout, stderr) => {
      if (err) {
        logger.error(`[${jobId}] CUPS error: ${stderr || err.message}`);
        resolve({ success: false, cupsJobId: null, error: stderr || err.message });
        return;
      }

      // lp outputs: "request id is Brother_DCP_L2680DW-42 (1 file(s))"
      const match = stdout.match(/request id is (\S+)/);
      const cupsJobId = match ? match[1] : null;

      logger.info(`[${jobId}] Print job submitted. CUPS job ID: ${cupsJobId}`);
      resolve({ success: true, cupsJobId, error: null });
    });
  });
}

/**
 * Cancel a CUPS job by its CUPS job ID
 * @param {string} cupsJobId
 */
function cancelJob(cupsJobId) {
  return new Promise((resolve) => {
    exec(`cancel ${cupsJobId}`, (err) => {
      if (err) {
        logger.warn(`Failed to cancel CUPS job ${cupsJobId}: ${err.message}`);
        resolve(false);
      } else {
        logger.info(`Cancelled CUPS job ${cupsJobId}`);
        resolve(true);
      }
    });
  });
}

/**
 * Poll CUPS until the job is done or failed
 * Resolves with final status: 'completed' | 'failed' | 'cancelled'
 * @param {string} cupsJobId
 * @param {number} timeoutMs
 */
function waitForJobCompletion(cupsJobId, timeoutMs = 120000) {
  return new Promise((resolve) => {
    const start = Date.now();

    const poll = () => {
      exec(`lpstat -W completed 2>&1 && lpstat 2>&1`, (err, stdout) => {
        if (stdout.includes(cupsJobId)) {
          // Still in queue / printing
          if (Date.now() - start > timeoutMs) {
            logger.warn(`Job ${cupsJobId} timed out`);
            resolve('timeout');
            return;
          }
          setTimeout(poll, 2000);
        } else {
          // Job is gone from lpstat = completed or cancelled
          // Check completed list
          exec(`lpstat -W completed 2>&1`, (err2, completedOut) => {
            if (completedOut.includes(cupsJobId)) {
              resolve('completed');
            } else {
              resolve('completed'); // Brother driver removes it fast — treat as done
            }
          });
        }
      });
    };

    poll();
  });
}

module.exports = { printFile, getPrinterStatus, cancelJob, waitForJobCompletion, PRINTER_NAME };