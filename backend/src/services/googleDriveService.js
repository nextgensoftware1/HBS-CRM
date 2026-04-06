// backend/src/services/googleDriveService.js
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

const DEFAULT_JSON_CREDENTIALS_PATH = path.join(__dirname, '../../credentials/google-credentials.json');
const DEFAULT_JS_CREDENTIALS_PATH = path.join(__dirname, '../../credentials/google-credentials.js');

const normalizeFolderId = (folderValue) => {
  if (!folderValue) return null;

  // Accept either a raw folder ID or a full Google Drive folder URL.
  const match = folderValue.match(/folders\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : folderValue.trim();
};

const resolveCredentialsPath = () => {
  const envPath = process.env.GOOGLE_CREDENTIALS_PATH;
  const candidates = [];

  if (envPath) {
    candidates.push(path.isAbsolute(envPath) ? envPath : path.resolve(process.cwd(), envPath));
  }

  candidates.push(DEFAULT_JSON_CREDENTIALS_PATH, DEFAULT_JS_CREDENTIALS_PATH);

  return candidates.find((candidate) => fs.existsSync(candidate)) || null;
};

const FOLDER_ID = normalizeFolderId(process.env.GOOGLE_DRIVE_FOLDER_ID);
const LOCAL_UPLOADS_DIR = path.join(__dirname, '../../uploads/documents');

const isLocalFileKey = (fileKey) => typeof fileKey === 'string' && fileKey.startsWith('local:');
const localPathFromKey = (fileKey) => fileKey.replace(/^local:/, '');

const publicBaseUrl = () => process.env.BACKEND_PUBLIC_URL || `http://localhost:${process.env.PORT || 5000}`;

const localPublicUrlFromRelativePath = (relativePath) => {
  const normalized = relativePath.replace(/\\/g, '/').replace(/^\/+/, '');
  return `${publicBaseUrl()}/${normalized}`;
};

const localFallbackEnabled = () => {
  const envFlag = (process.env.GOOGLE_DRIVE_FALLBACK_LOCAL || '').toLowerCase();
  if (envFlag === 'true') return true;
  return false;
};

const saveFileLocally = (fileBuffer, fileName) => {
  fs.mkdirSync(LOCAL_UPLOADS_DIR, { recursive: true });

  const timestamp = Date.now();
  const safeName = `${timestamp}-${fileName}`.replace(/[^a-zA-Z0-9._-]/g, '_');
  const fullPath = path.join(LOCAL_UPLOADS_DIR, safeName);
  fs.writeFileSync(fullPath, fileBuffer);

  const relativePath = path.join('uploads', 'documents', safeName).replace(/\\/g, '/');
  const fileUrl = localPublicUrlFromRelativePath(relativePath);

  return {
    success: true,
    fileId: `local:${relativePath}`,
    fileKey: `local:${relativePath}`,
    fileUrl,
    downloadUrl: fileUrl,
    fileName: safeName,
  };
};

// Authenticate with Google Drive
const authenticate = () => {
  const credentialsPath = resolveCredentialsPath();
  const scopes = ['https://www.googleapis.com/auth/drive.file'];

  if (!credentialsPath) {
    throw new Error(
      'Google Drive credentials file not found. Set GOOGLE_CREDENTIALS_PATH or add credentials/google-credentials.json.'
    );
  }

  if (credentialsPath.endsWith('.json')) {
    return new google.auth.GoogleAuth({
      keyFile: credentialsPath,
      scopes,
    });
  }

  // Allow a JS module export for local setups.
  // Expected shape: { client_email, private_key, ...service account fields }
  // or { credentials: { ...service account fields } }.
  // eslint-disable-next-line global-require, import/no-dynamic-require
  const moduleCredentials = require(credentialsPath);
  const credentials = moduleCredentials.credentials || moduleCredentials;

  if (!credentials || !credentials.client_email || !credentials.private_key) {
    throw new Error(
      'Invalid Google credentials format. Provide service account credentials with client_email and private_key.'
    );
  }

  return new google.auth.GoogleAuth({
    credentials,
    scopes,
  });
};

// Initialize Drive API
const getDriveService = async () => {
  const auth = authenticate();
  const drive = google.drive({ version: 'v3', auth });
  return drive;
};

/**
 * Upload file to Google Drive
 * @param {Buffer|String} fileContent - File buffer or path
 * @param {String} fileName - Name for the file
 * @param {String} mimeType - MIME type of the file
 * @returns {Promise} - Upload result with file ID and URL
 */
exports.uploadFile = async (fileContent, fileName, mimeType) => {
  try {
    const drive = await getDriveService();
    
    // Generate unique file name
    const timestamp = Date.now();
    const uniqueFileName = `${timestamp}-${fileName}`;
    
    // Prepare file buffer
    let fileBuffer = fileContent;
    if (typeof fileContent === 'string') {
      fileBuffer = fs.readFileSync(fileContent);
    }
    
    // Create file metadata
    const fileMetadata = { name: uniqueFileName };
    if (FOLDER_ID) {
      fileMetadata.parents = [FOLDER_ID];
    }
    
    // Upload file
    const media = {
      mimeType: mimeType,
      body: require('stream').Readable.from(fileBuffer)
    };
    
    const response = await drive.files.create({
      requestBody: fileMetadata,
      media: media,
      fields: 'id, webViewLink, webContentLink'
    });
    
    // Make file accessible (view only)
    await drive.permissions.create({
      fileId: response.data.id,
      requestBody: {
        role: 'reader',
        type: 'anyone'
      }
    });
    
    return {
      success: true,
      fileId: response.data.id,
      // Keep compatibility with existing controller/document schema naming.
      fileKey: response.data.id,
      fileUrl: response.data.webViewLink,
      downloadUrl: response.data.webContentLink,
      fileName: uniqueFileName
    };
  } catch (error) {
    if (localFallbackEnabled()) {
      try {
        const fileBuffer = typeof fileContent === 'string' ? fs.readFileSync(fileContent) : fileContent;
        console.warn('Google Drive unavailable. Falling back to local file storage.');
        return saveFileLocally(fileBuffer, fileName);
      } catch (localError) {
        console.error('Local fallback upload error:', localError);
      }
    }

    console.error('Google Drive upload error:', error);
    throw new Error('Failed to upload file to Google Drive. Files are not stored in DB/local by default.');
  }
};

/**
 * Delete file from Google Drive
 * @param {String} fileId - Google Drive file ID
 * @returns {Promise}
 */
exports.deleteFile = async (fileId) => {
  try {
    if (isLocalFileKey(fileId)) {
      const relativePath = localPathFromKey(fileId);
      const fullPath = path.join(__dirname, '../../', relativePath);

      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }

      return {
        success: true,
        message: 'Local file deleted successfully'
      };
    }

    const drive = await getDriveService();
    
    await drive.files.delete({
      fileId: fileId
    });
    
    return {
      success: true,
      message: 'File deleted successfully'
    };
  } catch (error) {
    console.error('Google Drive delete error:', error);
    throw new Error('Failed to delete file from Google Drive');
  }
};

/**
 * Get file metadata
 * @param {String} fileId - Google Drive file ID
 * @returns {Promise}
 */
exports.getFileMetadata = async (fileId) => {
  try {
    if (isLocalFileKey(fileId)) {
      const relativePath = localPathFromKey(fileId);
      const fullPath = path.join(__dirname, '../../', relativePath);
      const exists = fs.existsSync(fullPath);

      if (!exists) {
        throw new Error('Local file not found');
      }

      const stats = fs.statSync(fullPath);
      const fileUrl = localPublicUrlFromRelativePath(relativePath);

      return {
        success: true,
        file: {
          id: fileId,
          name: path.basename(fullPath),
          size: stats.size,
          createdTime: stats.birthtime,
          webViewLink: fileUrl,
          webContentLink: fileUrl,
        }
      };
    }

    const drive = await getDriveService();
    
    const response = await drive.files.get({
      fileId: fileId,
      fields: 'id, name, mimeType, size, createdTime, webViewLink, webContentLink'
    });
    
    return {
      success: true,
      file: response.data
    };
  } catch (error) {
    console.error('Get file metadata error:', error);
    throw new Error('Failed to get file metadata');
  }
};

/**
 * Download file from Google Drive
 * @param {String} fileId - Google Drive file ID
 * @returns {Promise} - File stream
 */
exports.downloadFile = async (fileId) => {
  try {
    if (isLocalFileKey(fileId)) {
      const relativePath = localPathFromKey(fileId);
      const fullPath = path.join(__dirname, '../../', relativePath);
      return fs.createReadStream(fullPath);
    }

    const drive = await getDriveService();
    
    const response = await drive.files.get(
      { fileId: fileId, alt: 'media' },
      { responseType: 'stream' }
    );
    
    return response.data;
  } catch (error) {
    console.error('Google Drive download error:', error);
    throw new Error('Failed to download file from Google Drive');
  }
};

/**
 * List all files in folder
 * @returns {Promise}
 */
exports.listFiles = async () => {
  try {
    const drive = await getDriveService();
    
    const response = await drive.files.list({
      q: `'${FOLDER_ID}' in parents and trashed=false`,
      fields: 'files(id, name, mimeType, size, createdTime, webViewLink)',
      orderBy: 'createdTime desc'
    });
    
    return {
      success: true,
      files: response.data.files
    };
  } catch (error) {
    console.error('List files error:', error);
    throw new Error('Failed to list files');
  }
};

/**
 * Check if Google Drive is accessible
 * @returns {Promise<Boolean>}
 */
exports.checkDriveAccess = async () => {
  try {
    if (localFallbackEnabled()) {
      return true;
    }

    if (!FOLDER_ID) {
      return true;
    }

    const drive = await getDriveService();
    
    await drive.files.get({
      fileId: FOLDER_ID,
      fields: 'id, name'
    });
    
    return true;
  } catch (error) {
    console.error('Google Drive access error:', error);
    return false;
  }
};