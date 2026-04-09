const { S3Client, DeleteObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const logger = require('../logger');

const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

const BUCKET = process.env.R2_BUCKET_NAME;

function generateFileKey(jobId, originalName) {
  const ext = originalName.split('.').pop().toLowerCase();
  return `jobs/${jobId}/document.${ext}`;
}

async function getPresignedDownloadUrl(fileKey, expiresInSeconds = 1800) {
  const command = new GetObjectCommand({ Bucket: BUCKET, Key: fileKey });
  const url = await getSignedUrl(r2, command, { expiresIn: expiresInSeconds });
  logger.info(`Generated presigned URL for ${fileKey}`);
  return url;
}

async function deleteFile(fileKey) {
  try {
    await r2.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: fileKey }));
    logger.info(`Deleted R2 file: ${fileKey}`);
    return true;
  } catch (err) {
    logger.error(`Failed to delete R2 file ${fileKey}: ${err.message}`);
    return false;
  }
}

function getMulterS3Storage() {
  const multerS3 = require('multer-s3');
  const { v4: uuidv4 } = require('uuid');
  return multerS3({
    s3: r2,
    bucket: BUCKET,
    key: (req, file, cb) => {
      const jobId = req.jobId || uuidv4();
      req.jobId = jobId;
      const key = generateFileKey(jobId, file.originalname);
      req.fileKey = key;
      cb(null, key);
    },
    contentType: multerS3.AUTO_CONTENT_TYPE,
  });
}

module.exports = { getMulterS3Storage, getPresignedDownloadUrl, deleteFile, generateFileKey };
