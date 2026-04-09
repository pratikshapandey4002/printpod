/**
 * PrintPod — CUPS standalone test
 * Run this directly on the Pi to verify Node.js can trigger prints:
 *
 *   node test-print.js
 *
 * It creates a small test PDF in /tmp and prints it.
 * Check the printer output and the console logs.
 */

const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const PRINTER_NAME = 'Brother_DCP_L2680DW';
const TEST_FILE = '/tmp/printpod-test.txt';

// Write a test text file
fs.writeFileSync(TEST_FILE, [
  '================================',
  '       PrintPod Test Print       ',
  '================================',
  '',
  `Date: ${new Date().toLocaleString('en-IN')}`,
  `Printer: ${PRINTER_NAME}`,
  `Node.js: ${process.version}`,
  '',
  'If you can read this, the Pi-to-CUPS',
  'Node.js integration is working!',
  '',
  '================================',
].join('\n'));

console.log(`\n[PrintPod] Test file written: ${TEST_FILE}`);
console.log(`[PrintPod] Sending to printer: ${PRINTER_NAME}\n`);

// Test 1: Check printer exists
exec(`lpstat -p ${PRINTER_NAME}`, (err, stdout, stderr) => {
  if (err) {
    console.error('✗ Printer not found in CUPS!');
    console.error('  Run: lpstat -v   to see available printers');
    process.exit(1);
  }
  console.log('✓ Printer found in CUPS:');
  console.log(' ', stdout.trim());

  // Test 2: Send print job
  const cmd = `lp -d ${PRINTER_NAME} -o media=A4 -o ColorModel=Gray -o fit-to-page "${TEST_FILE}"`;
  console.log(`\n[PrintPod] Running: ${cmd}\n`);

  exec(cmd, (err2, stdout2, stderr2) => {
    if (err2) {
      console.error('✗ Print command failed!');
      console.error('  Error:', stderr2 || err2.message);
      process.exit(1);
    }

    // Parse CUPS job ID from output
    const match = stdout2.match(/request id is (\S+)/);
    const cupsJobId = match ? match[1] : 'unknown';

    console.log('✓ Print job submitted successfully!');
    console.log(`  CUPS Job ID: ${cupsJobId}`);
    console.log(`  Output: ${stdout2.trim()}`);
    console.log('\n[PrintPod] Check your printer — it should be printing now.');
    console.log('[PrintPod] Run "lpq" to see the queue.\n');
  });
});