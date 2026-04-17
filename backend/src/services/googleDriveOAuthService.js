const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
const { Readable } = require('stream');

const TOKEN_PATH = path.join(__dirname, '../../credentials/google-oauth-token.json');
const LOCAL_UPLOADS_DIR = path.join(__dirname, '../../uploads/documents');
const normalizeFolderId = (folderValue) => {
  if (!folderValue) return null;
  const match = folderValue.match(/folders\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : folderValue.trim();
};

const isLocalFileKey = (fileKey) => typeof fileKey === 'string' && fileKey.startsWith('local:');
const localPathFromKey = (fileKey) => fileKey.replace(/^local:/, '');

const publicBaseUrl = () => process.env.BACKEND_PUBLIC_URL || `http://localhost:${process.env.PORT || 5000}`;

const localPublicUrlFromRelativePath = (relativePath) => {
  const normalized = String(relativePath || '').replace(/\\/g, '/').replace(/^\/+/, '');
  return `${publicBaseUrl()}/${normalized}`;
};

const localFallbackEnabled = () => {
  const envFlag = String(process.env.GOOGLE_DRIVE_FALLBACK_LOCAL || '').toLowerCase();
  if (envFlag === 'true') return true;
  if (envFlag === 'false') {
    // In local/dev environments, keep temporary fallback active to avoid blocking uploads.
    return process.env.NODE_ENV !== 'production';
  }
  return true;
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

exports.isLocalFallbackEnabled = localFallbackEnabled;

const getOAuth2Client = () => {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error('Missing Google OAuth environment variables.');
  }

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
};

const saveTokens = (tokens) => {
  const dir = path.dirname(TOKEN_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2), 'utf8');
};

const loadTokens = () => {
  if (!fs.existsSync(TOKEN_PATH)) return null;
  return JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'));
};

exports.getGoogleAuthUrl = () => {
  const oauth2Client = getOAuth2Client();

  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: ['https://www.googleapis.com/auth/drive'],
  });
};

exports.handleGoogleCallback = async (code) => {
  const oauth2Client = getOAuth2Client();
  const { tokens } = await oauth2Client.getToken(code);
  oauth2Client.setCredentials(tokens);
  saveTokens(tokens);
  return tokens;
};

exports.getDriveClient = async () => {
  const oauth2Client = getOAuth2Client();
  const tokens = loadTokens();

  if (!tokens) {
    throw new Error('Google Drive is not connected yet. Please connect admin Google account first.');
  }

  oauth2Client.setCredentials(tokens);

  oauth2Client.on('tokens', (newTokens) => {
    const oldTokens = loadTokens() || {};
    saveTokens({ ...oldTokens, ...newTokens });
  });

  return google.drive({
    version: 'v3',
    auth: oauth2Client,
  });
};

exports.checkDriveAccess = async () => {
  try {
    const drive = await exports.getDriveClient();
    const folderId = normalizeFolderId(process.env.GOOGLE_DRIVE_FOLDER_ID || '');

    if (!folderId) {
      return true;
    }

    await drive.files.get({
      fileId: folderId,
      fields: 'id,name',
      supportsAllDrives: true,
    });

    return true;
  } catch (error) {
    console.error('Google Drive access check failed:', error.message);
    return false;
  }
};

exports.uploadFileToAdminDrive = async (fileBuffer, fileName, mimeType) => {
  let drive;
  try {
    drive = await exports.getDriveClient();
  } catch (error) {
    if (localFallbackEnabled()) {
      console.warn('Google Drive is not connected. Falling back to local document storage.');
      return saveFileLocally(fileBuffer, fileName);
    }
    throw error;
  }

  const folderId = normalizeFolderId(process.env.GOOGLE_DRIVE_FOLDER_ID || '');

  const requestBody = {
    name: `${Date.now()}-${fileName}`,
  };

  if (folderId) {
    requestBody.parents = [folderId];
  }

  const response = await drive.files.create({
    requestBody,
    media: {
      mimeType,
      body: Readable.from(fileBuffer),
    },
    fields: 'id, name, webViewLink, webContentLink, parents',
  });

  console.log('Google Drive upload success:', response.data);

  return {
    success: true,
    fileId: response.data.id,
    fileKey: response.data.id,
    fileUrl: response.data.webViewLink,
    downloadUrl: response.data.webContentLink,
    fileName: response.data.name,
  };
};

exports.deleteFile = async (fileId) => {
  if (isLocalFileKey(fileId)) {
    const relativePath = localPathFromKey(fileId);
    const fullPath = path.join(__dirname, '../../', relativePath);

    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }

    return {
      success: true,
      message: 'Local file deleted successfully',
    };
  }

  const drive = await exports.getDriveClient();
  await drive.files.delete({
    fileId,
    supportsAllDrives: true,
  });

  return {
    success: true,
    message: 'File deleted successfully',
  };
};

exports.getFileMetadata = async (fileId) => {
  if (isLocalFileKey(fileId)) {
    const relativePath = localPathFromKey(fileId);
    const fullPath = path.join(__dirname, '../../', relativePath);

    if (!fs.existsSync(fullPath)) {
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
      },
    };
  }

  const drive = await exports.getDriveClient();
  const response = await drive.files.get({
    fileId,
    fields: 'id,name,mimeType,size,createdTime,webViewLink,webContentLink',
    supportsAllDrives: true,
  });

  return {
    success: true,
    file: response.data,
  };
};