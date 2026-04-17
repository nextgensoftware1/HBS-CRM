// backend/src/services/s3Service.js
const AWS = require('aws-sdk');
const fs = require('fs');

// Configure AWS
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION
});

/**
 * Upload file to S3
 * @param {Buffer|String} fileContent - File buffer or path
 * @param {String} fileName - Name for the file in S3
 * @param {String} mimeType - MIME type of the file
 * @returns {Promise} - S3 upload result with URL
 */
exports.uploadFile = async (fileContent, fileName, mimeType) => {
  try {
    // Generate unique file name
    const timestamp = Date.now();
    const uniqueFileName = `${timestamp}-${fileName}`;
    
    // If fileContent is a file path, read it
    let fileBuffer = fileContent;
    if (typeof fileContent === 'string') {
      fileBuffer = fs.readFileSync(fileContent);
    }
    
    const params = {
      Bucket: process.env.AWS_S3_BUCKET_NAME,
      Key: `documents/${uniqueFileName}`,
      Body: fileBuffer,
      ContentType: mimeType,
      ServerSideEncryption: 'AES256', // Encrypt at rest (HIPAA requirement)
      // ACL: 'private' // Keep files private by default
    };
    
    const result = await s3.upload(params).promise();
    
    return {
      success: true,
      fileUrl: result.Location,
      fileKey: result.Key,
      fileName: uniqueFileName
    };
  } catch (error) {
    console.error('S3 upload error:', error);
    throw new Error('Failed to upload file to S3');
  }
};

/**
 * Delete file from S3
 * @param {String} fileKey - S3 file key
 * @returns {Promise}
 */
exports.deleteFile = async (fileKey) => {
  try {
    const params = {
      Bucket: process.env.AWS_S3_BUCKET_NAME,
      Key: fileKey
    };
    
    await s3.deleteObject(params).promise();
    
    return {
      success: true,
      message: 'File deleted successfully'
    };
  } catch (error) {
    console.error('S3 delete error:', error);
    throw new Error('Failed to delete file from S3');
  }
};

/**
 * Generate signed URL for temporary file access
 * @param {String} fileKey - S3 file key
 * @param {Number} expiresIn - URL expiry time in seconds (default 1 hour)
 * @returns {String} - Signed URL
 */
exports.getSignedUrl = (fileKey, expiresIn = 3600) => {
  try {
    const params = {
      Bucket: process.env.AWS_S3_BUCKET_NAME,
      Key: fileKey,
      Expires: expiresIn
    };
    
    const url = s3.getSignedUrl('getObject', params);
    return url;
  } catch (error) {
    console.error('Get signed URL error:', error);
    throw new Error('Failed to generate signed URL');
  }
};

/**
 * List all files in a folder
 * @param {String} prefix - Folder prefix
 * @returns {Promise} - List of files
 */
exports.listFiles = async (prefix = 'documents/') => {
  try {
    const params = {
      Bucket: process.env.AWS_S3_BUCKET_NAME,
      Prefix: prefix
    };
    
    const result = await s3.listObjectsV2(params).promise();
    
    return {
      success: true,
      files: result.Contents
    };
  } catch (error) {
    console.error('S3 list files error:', error);
    throw new Error('Failed to list files from S3');
  }
};

/**
 * Check if bucket exists and is accessible
 * @returns {Promise<Boolean>}
 */
exports.checkBucketAccess = async () => {
  try {
    await s3.headBucket({
      Bucket: process.env.AWS_S3_BUCKET_NAME
    }).promise();
    
    return true;
  } catch (error) {
    console.error('S3 bucket access error:', error);
    return false;
  }
};
