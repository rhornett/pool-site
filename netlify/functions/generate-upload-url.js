// netlify/functions/generate-upload-url.js
//
// Generates a short-lived, presigned URL that lets a browser upload a file
// DIRECTLY to Cloudflare R2 storage -- the file's bytes never pass through
// this function or through Netlify at all, which is what makes large
// (multi-hundred-MB, up to several GB) uploads possible on a serverless
// platform that would otherwise reject large request bodies.
//
// Required environment variables (set these in Netlify's site settings --
// Site configuration > Environment variables -- never commit them to git):
//   R2_ACCOUNT_ID        Cloudflare account ID
//   R2_ACCESS_KEY_ID     R2 API token's Access Key ID
//   R2_SECRET_ACCESS_KEY R2 API token's Secret Access Key
//   R2_BUCKET_NAME       Name of the R2 bucket to receive uploads

const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (e) {
    return { statusCode: 400, body: 'Invalid JSON body' };
  }

  const { filename, contentType, senderName } = body;
  if (!filename || typeof filename !== 'string') {
    return { statusCode: 400, body: 'filename is required' };
  }

  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucketName = process.env.R2_BUCKET_NAME;

  if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
    return {
      statusCode: 500,
      body: 'Server is not configured: one or more R2_* environment variables are missing in Netlify.',
    };
  }

  const s3 = new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });

  // Build a safe, collision-resistant object key so two people uploading
  // "picks.xlsx" at the same moment don't overwrite each other.
  const safe = (s) => (s || '').toString().replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80);
  const key = `uploads/${Date.now()}-${safe(senderName) || 'anonymous'}-${safe(filename)}`;

  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    ContentType: contentType || 'application/octet-stream',
  });

  try {
    // 1 hour validity -- generous enough to cover a slow connection
    // uploading a large file; the browser only needs to START the PUT
    // within this window.
    const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 3600 });
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uploadUrl, key }),
    };
  } catch (err) {
    return { statusCode: 500, body: 'Could not generate upload URL: ' + err.message };
  }
};
