import { Router, type Request, type Response } from 'express';
import {
  getGoogleAuthUrl,
  getTokensFromCode,
  createOAuth2Client,
  fetchGoogleUserProfile,
  fetchUserYouTubeChannels,
} from '../../auth/google.auth.js';
import { userService } from '../../services/user.service.js';

const router = Router();

/**
 * Shared OAuth Callback Handler
 */
export async function handleGoogleCallback(req: Request, res: Response) {
  try {
    const code = req.query.code as string;
    const errorParam = req.query.error as string;

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

    if (errorParam) {
      console.error('[Google OAuth] Error from Google consent screen:', errorParam);
      return res.redirect(`${frontendUrl}?auth_error=${encodeURIComponent(errorParam)}`);
    }

    if (!code) {
      return res.redirect(`${frontendUrl}?auth_error=${encodeURIComponent('No authorization code received')}`);
    }

    // 1. Determine the redirect URI that was registered and called
    const configuredRedirect = process.env.GOOGLE_REDIRECT_URI;
    const currentHost = req.get('host') || 'localhost:5000';
    const protocol = req.protocol || 'http';
    const detectedRedirect = `${protocol}://${currentHost}${req.originalUrl.split('?')[0]}`;

    // Pass the configured redirect URI first, or fallback to detected URL
    const targetRedirectUri = configuredRedirect || detectedRedirect;

    console.log(`[Google OAuth] Exchanging code for tokens using redirect_uri: ${targetRedirectUri}`);

    // 2. Exchange code for OAuth tokens
    const { tokens } = await getTokensFromCode(code, targetRedirectUri);

    // 3. Build authenticated OAuth client
    const authClient = createOAuth2Client(targetRedirectUri);
    authClient.setCredentials(tokens);

    // 4. Fetch User Google Info
    const profile = await fetchGoogleUserProfile(authClient);

    // 5. Fetch User's YouTube Channels
    const channels = await fetchUserYouTubeChannels(authClient);

    // 6. Upsert User in Firestore
    const user = await userService.upsertGoogleUser({
      googleId: profile.id,
      email: profile.email,
      name: profile.name,
      picture: profile.picture,
      tokens,
    });

    // 7. Sync YouTube Channels in Firestore
    const syncedChannels = await userService.syncUserChannels(user.id, channels);

    console.log(`[Google OAuth] Success for user ${user.email} (${syncedChannels.length} channels synced)`);

    // 8. Redirect to frontend with auth payload
    const redirectTarget = `${frontendUrl}?auth_success=true&uid=${encodeURIComponent(user.id)}&name=${encodeURIComponent(user.name)}&email=${encodeURIComponent(user.email)}`;
    return res.redirect(redirectTarget);
  } catch (err: any) {
    console.error('[Google OAuth] Callback error:', err);
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    return res.redirect(`${frontendUrl}?auth_error=${encodeURIComponent(err.message || 'OAuth token exchange failed')}`);
  }
}

/**
 * GET /api/auth/google/url
 * Returns the Google OAuth 2.0 Consent URL with YouTube permissions
 */
router.get('/google/url', (req: Request, res: Response) => {
  try {
    const state = (req.query.state as string) || 'default_session';
    const redirectUri = (req.query.redirect_uri as string) || undefined;
    const authUrl = getGoogleAuthUrl(state, redirectUri);
    return res.status(200).json({
      success: true,
      authUrl,
      redirectUri: redirectUri || process.env.GOOGLE_REDIRECT_URI || 'http://localhost:5000/api/auth/google/callback',
      permissions: [
        'Manage YouTube Channel and Streams',
        'Create & Schedule Live Broadcasts',
        'Upload & Publish Video Assets',
        'View Analytics & Subscriber Counts',
      ],
    });
  } catch (err: any) {
    console.error('Google Auth URL error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/auth/google/callback
 */
router.get('/google/callback', handleGoogleCallback);

/**
 * GET /api/auth/callback
 */
router.get('/callback', handleGoogleCallback);

/**
 * GET /api/auth/me
 * Returns current authenticated user profile, active channel, and all linked YouTube channels
 */
router.get('/me', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    const uid = (req.query.uid as string) || (authHeader ? authHeader.replace('Bearer ', '') : '');

    if (!uid) {
      return res.status(200).json({
        success: true,
        authenticated: false,
        user: null,
        channels: [],
      });
    }

    const userWithChannels = await userService.getUserWithChannels(uid);
    if (!userWithChannels) {
      return res.status(200).json({
        success: true,
        authenticated: false,
        user: null,
        channels: [],
      });
    }

    return res.status(200).json({
      success: true,
      authenticated: true,
      user: userWithChannels.user,
      channels: userWithChannels.channels,
      activeChannel: userWithChannels.channels.find(
        (c) => c.id === userWithChannels.user.activeChannelId
      ) || userWithChannels.channels[0] || null,
    });
  } catch (err: any) {
    console.error('Auth /me error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/auth/switch-channel
 * Switches the active YouTube channel for the user
 */
router.post('/switch-channel', async (req: Request, res: Response) => {
  try {
    const { userId, channelId } = req.body;
    if (!userId || !channelId) {
      return res.status(400).json({ success: false, error: 'userId and channelId are required' });
    }

    const result = await userService.switchActiveChannel(userId, channelId);
    return res.status(200).json({ success: true, ...result });
  } catch (err: any) {
    console.error('Switch channel error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/auth/sync-channels
 * Re-queries YouTube API and updates channel statistics in Firestore
 */
router.post('/sync-channels', async (req: Request, res: Response) => {
  try {
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ success: false, error: 'userId is required' });
    }

    const userWithChannels = await userService.getUserWithChannels(userId);
    if (!userWithChannels) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    let channels: any[] = [];
    if (userWithChannels.user.googleTokens?.refreshToken) {
      const authClient = createOAuth2Client();
      authClient.setCredentials(userWithChannels.user.googleTokens);
      channels = await fetchUserYouTubeChannels(authClient);
    }

    const synced = await userService.syncUserChannels(userId, channels);
    return res.status(200).json({
      success: true,
      message: `Successfully synced ${synced.length} YouTube channel(s) to Firestore`,
      channels: synced,
    });
  } catch (err: any) {
    console.error('Sync channels error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/auth/dev-login
 * Instant developer login flow with sample multi-channel YouTube account for rapid testing
 */
router.post('/dev-login', async (req: Request, res: Response) => {
  try {
    const devUserId = req.body.userId || 'dev_google_user_001';
    const email = req.body.email || 'alex.creator@studio-stream.com';
    const name = req.body.name || 'Alex Morgan (YouTube Creator)';
    const picture = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150';

    const sampleChannels = [
      {
        id: 'UC_lofi_vibes_247',
        title: '24/7 Deep Lo-Fi Radio',
        customUrl: '@DeepLoFiRadio',
        description: 'Continuous relaxing ambient lo-fi beats with rain soundscapes for study & sleep.',
        thumbnails: {
          default: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=150',
          medium: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=300',
        },
        statistics: {
          viewCount: 2490500,
          subscriberCount: 142000,
          videoCount: 114,
          hiddenSubscriberCount: false,
        },
      },
      {
        id: 'UC_synth_neon_wave',
        title: 'Neon Cyberpunk Synthwave',
        customUrl: '@NeonCyberpunkRadio',
        description: 'High energy 80s analog synthwave and retro driving beats.',
        thumbnails: {
          default: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=150',
          medium: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=300',
        },
        statistics: {
          viewCount: 890200,
          subscriberCount: 58400,
          videoCount: 42,
          hiddenSubscriberCount: false,
        },
      },
      {
        id: 'UC_deep_nature_ambient',
        title: 'Deep Nature Focus & Sleep',
        customUrl: '@DeepNatureFocus',
        description: 'Soothing rain, thunder, and forest stream binaural frequencies.',
        thumbnails: {
          default: 'https://images.unsplash.com/photo-1511497584788-87676104235f?w=150',
          medium: 'https://images.unsplash.com/photo-1511497584788-87676104235f?w=300',
        },
        statistics: {
          viewCount: 412000,
          subscriberCount: 29100,
          videoCount: 26,
          hiddenSubscriberCount: false,
        },
      },
    ];

    const user = await userService.upsertGoogleUser({
      googleId: devUserId,
      email,
      name,
      picture,
      tokens: {
        access_token: 'ya29.sample_dev_token',
        refresh_token: '1//sample_refresh_token',
        scope: 'https://www.googleapis.com/auth/youtube',
        token_type: 'Bearer',
        expiry_date: Date.now() + 3600 * 1000,
      },
    });

    const channels = await userService.syncUserChannels(devUserId, sampleChannels);

    return res.status(200).json({
      success: true,
      message: 'Developer multi-channel user account initialized in Firestore',
      user,
      channels,
      activeChannel: channels[0],
    });
  } catch (err: any) {
    console.error('Dev login error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/auth/users
 * Returns list of all registered users in Firestore
 */
router.get('/users', async (_req: Request, res: Response) => {
  try {
    const users = await userService.getAllUsers();
    return res.status(200).json({ success: true, users });
  } catch (err: any) {
    console.error('Get users error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
