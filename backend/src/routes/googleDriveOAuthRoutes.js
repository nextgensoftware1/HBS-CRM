const express = require('express');
const router = express.Router();

const {
  getGoogleAuthUrl,
  handleGoogleCallback,
} = require('../services/googleDriveOAuthService');

router.get('/connect', (req, res) => {
  try {
    const authUrl = getGoogleAuthUrl();
    return res.redirect(authUrl);
  } catch (error) {
    return res.status(500).json({
      status: 'error',
      message: error.message,
    });
  }
});

router.get('/callback', async (req, res) => {
  try {
    const { code, error, error_description: errorDescription } = req.query;

    if (error) {
      return res.status(403).json({
        status: 'error',
        message: `Google OAuth denied access: ${error}`,
        details: errorDescription || null,
        troubleshooting: [
          'If OAuth consent screen is in Testing mode, add your Google account as a Test user.',
          'If app is Internal, sign in with an account from the same Google Workspace org or switch app to External.',
          'Ensure GOOGLE_OAUTH_REDIRECT_URI exactly matches an Authorized redirect URI in Google Cloud.',
        ],
      });
    }

    if (!code) {
      return res.status(400).json({
        status: 'error',
        message: 'Authorization code is missing.',
      });
    }

    await handleGoogleCallback(code);

    return res.send('Google Drive connected successfully. You can close this tab.');
  } catch (error) {
    console.error('Google OAuth callback error:', error);
    return res.status(500).json({
      status: 'error',
      message: error.message,
    });
  }
});

module.exports = router;