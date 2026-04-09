const bcrypt = require('bcryptjs');
const axios = require('axios');
const logger = require('../logger');

function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function hashOTP(otp) {
  return bcrypt.hash(otp, 10);
}

async function verifyOTP(rawOtp, hash) {
  return bcrypt.compare(rawOtp, hash);
}

function getOTPExpiry() {
  return new Date(Date.now() + 15 * 60 * 1000);
}

async function sendOTPviaSMS(phoneNumber, otp) {
  const mobile = `91${phoneNumber.replace(/^(\+91|91)/, '')}`;
  try {
    const response = await axios.post(
      'https://api.msg91.com/api/v5/otp',
      {
        template_id: process.env.MSG91_TEMPLATE_ID,
        mobile,
        authkey: process.env.MSG91_AUTH_KEY,
        otp,
        sender: process.env.MSG91_SENDER_ID || 'PRTPOD',
      },
      { headers: { 'Content-Type': 'application/json' }, timeout: 10000 }
    );
    if (response.data.type === 'success') {
      logger.info(`OTP sent to ${mobile}`);
      return { success: true };
    }
    return { success: false, error: response.data.message };
  } catch (err) {
    if (process.env.NODE_ENV === 'development') {
      logger.info(`[DEV] OTP for ${mobile}: ${otp}`);
      return { success: true, devOtp: otp };
    }
    return { success: false, error: 'SMS service unavailable' };
  }
}

module.exports = { generateOTP, hashOTP, verifyOTP, getOTPExpiry, sendOTPviaSMS };
