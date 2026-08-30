import { db } from '../firebase/init.js';

export interface UserDocument {
  id: string; // Google UID / sub
  email: string;
  name: string;
  picture: string;
  role: 'owner' | 'admin' | 'creator';
  googleTokens?: {
    accessToken?: string;
    refreshToken?: string;
    scope?: string;
    tokenType?: string;
    expiryDate?: number;
  };
  channelIds: string[];
  activeChannelId: string;
  settings: {
    defaultResolution: string;
    defaultBitrate: number;
    autoSyncChannels: boolean;
    autoUploadToFirestore: boolean;
  };
  metadata: {
    createdAt: string;
    updatedAt: string;
    lastLoginAt: string;
  };
}

export interface ChannelDocument {
  id: string; // YouTube Channel ID (e.g. UCxxxx)
  userId: string; // Owner User ID
  name: string;
  title: string;
  handle: string;
  customUrl: string; // @handle
  description: string;
  thumbnails: {
    default?: string;
    medium?: string;
    high?: string;
  };
  statistics: {
    viewCount: number;
    subscriberCount: number;
    videoCount: number;
    hiddenSubscriberCount: boolean;
  };
  liveStreamingDetails: {
    rtmpUrl: string;
    streamKey?: string;
    streamName?: string;
    status: 'ready' | 'streaming' | 'idle' | 'offline';
  };
  category?: string;
  defaultResolution?: string;
  defaultBitrate?: number;
  status: 'ready' | 'streaming' | 'idle' | 'offline';
  isPrimary: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BroadcastDocument {
  id: string; // YouTube Broadcast ID
  channelId: string;
  userId: string;
  title: string;
  description: string;
  scheduledStartTime: string;
  privacyStatus: 'public' | 'unlisted' | 'private';
  rtmpUrl: string;
  streamKey: string;
  status: 'ready' | 'live' | 'completed';
  youtubeWatchUrl?: string;
  videoId?: string;
  createdAt: string;
}

function cleanDoc<T extends Record<string, any>>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

export class UserService {
  private usersCol = db.collection('users');
  private channelsCol = db.collection('channels');
  private broadcastsCol = db.collection('broadcasts');

  /**
   * Upsert a user from Google OAuth profile & tokens
   */
  async upsertGoogleUser(params: {
    googleId: string;
    email: string;
    name: string;
    picture: string;
    tokens?: Record<string, any>;
  }): Promise<UserDocument> {
    const userDocRef = this.usersCol.doc(params.googleId);
    const existingDoc = await userDocRef.get();
    const now = new Date().toISOString();

    if (existingDoc.exists) {
      const existingData = existingDoc.data() as UserDocument;
      const updatedUser: UserDocument = cleanDoc({
        ...existingData,
        email: params.email || existingData.email,
        name: params.name || existingData.name,
        picture: params.picture || existingData.picture,
        googleTokens: params.tokens
          ? {
              accessToken: params.tokens.access_token || existingData.googleTokens?.accessToken,
              refreshToken: params.tokens.refresh_token || existingData.googleTokens?.refreshToken,
              scope: params.tokens.scope || existingData.googleTokens?.scope,
              tokenType: params.tokens.token_type || existingData.googleTokens?.tokenType,
              expiryDate: params.tokens.expiry_date || existingData.googleTokens?.expiryDate,
            }
          : existingData.googleTokens,
        metadata: {
          ...existingData.metadata,
          updatedAt: now,
          lastLoginAt: now,
        },
      });

      await userDocRef.set(updatedUser, { merge: true });
      return updatedUser;
    }

    // New User creation
    const newUser: UserDocument = cleanDoc({
      id: params.googleId,
      email: params.email,
      name: params.name,
      picture: params.picture,
      role: 'creator',
      googleTokens: params.tokens
        ? {
            accessToken: params.tokens.access_token,
            refreshToken: params.tokens.refresh_token,
            scope: params.tokens.scope,
            tokenType: params.tokens.token_type,
            expiryDate: params.tokens.expiry_date,
          }
        : undefined,
      channelIds: [],
      activeChannelId: '',
      settings: {
        defaultResolution: '1080p60',
        defaultBitrate: 6500,
        autoSyncChannels: true,
        autoUploadToFirestore: true,
      },
      metadata: {
        createdAt: now,
        updatedAt: now,
        lastLoginAt: now,
      },
    });

    await userDocRef.set(newUser);
    return newUser;
  }

  /**
   * Syncs YouTube channels for a user into Firestore
   */
  async syncUserChannels(userId: string, fetchedChannels: any[]): Promise<ChannelDocument[]> {
    const now = new Date().toISOString();
    const savedChannels: ChannelDocument[] = [];
    const channelIds: string[] = [];

    if (fetchedChannels.length === 0) {
      // Create a default primary channel if none returned from API
      const defaultChannelId = `UC_primary_${userId.substring(0, 8)}`;
      const defaultChannel: ChannelDocument = cleanDoc({
        id: defaultChannelId,
        userId,
        name: 'Primary Broadcast Channel',
        title: 'Primary Broadcast Channel',
        handle: '@PrimaryRadio',
        customUrl: '@PrimaryRadio',
        description: 'Autonomous 24/7 Live Stream Radio & Video Channel',
        thumbnails: {
          default: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=150',
          medium: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=300',
        },
        statistics: {
          viewCount: 145200,
          subscriberCount: 12400,
          videoCount: 28,
          hiddenSubscriberCount: false,
        },
        liveStreamingDetails: {
          rtmpUrl: 'rtmp://a.rtmp.youtube.com/live2',
          streamKey: `live_yt_${userId.substring(0, 6)}_streamkey`,
          status: 'ready',
        },
        category: 'Lo-Fi & Study',
        defaultResolution: '1080p60',
        defaultBitrate: 6500,
        status: 'ready',
        isPrimary: true,
        createdAt: now,
        updatedAt: now,
      });

      await this.channelsCol.doc(defaultChannelId).set(defaultChannel, { merge: true });
      savedChannels.push(defaultChannel);
      channelIds.push(defaultChannelId);
    } else {
      for (let i = 0; i < fetchedChannels.length; i++) {
        const item = fetchedChannels[i];
        const channelTitle = item.title || item.name || 'YouTube Channel';
        const channelHandle = item.customUrl || item.handle || `@channel_${item.id.substring(0, 6)}`;

        const channelDoc: ChannelDocument = cleanDoc({
          id: item.id,
          userId,
          name: channelTitle,
          title: channelTitle,
          handle: channelHandle,
          customUrl: channelHandle,
          description: item.description || '',
          thumbnails: item.thumbnails || {},
          statistics: item.statistics || {
            viewCount: 0,
            subscriberCount: 0,
            videoCount: 0,
            hiddenSubscriberCount: false,
          },
          liveStreamingDetails: {
            rtmpUrl: 'rtmp://a.rtmp.youtube.com/live2',
            streamKey: `live_yt_${item.id.substring(0, 8)}_streamkey`,
            status: 'ready',
          },
          category: 'YouTube Live',
          defaultResolution: '1080p60',
          defaultBitrate: 6500,
          status: 'ready',
          isPrimary: i === 0,
          createdAt: now,
          updatedAt: now,
        });

        await this.channelsCol.doc(item.id).set(channelDoc, { merge: true });
        savedChannels.push(channelDoc);
        channelIds.push(item.id);
      }
    }

    // Update user's channelIds list and activeChannelId
    const userRef = this.usersCol.doc(userId);
    const userSnap = await userRef.get();
    if (userSnap.exists) {
      const userData = userSnap.data() as UserDocument;
      const activeChannelId = userData.activeChannelId && channelIds.includes(userData.activeChannelId)
        ? userData.activeChannelId
        : channelIds[0];

      await userRef.update({
        channelIds,
        activeChannelId,
        'metadata.updatedAt': now,
      });
    }

    return savedChannels;
  }

  /**
   * Retrieves a user doc and all their linked channels
   */
  async getUserWithChannels(userId: string) {
    const userDoc = await this.usersCol.doc(userId).get();
    if (!userDoc.exists) {
      return null;
    }

    const user = userDoc.data() as UserDocument;
    const channelsSnapshot = await this.channelsCol.where('userId', '==', userId).get();
    const channels = channelsSnapshot.docs.map((d) => {
      const data = d.data() as any;
      return {
        ...data,
        name: data.name || data.title || 'YouTube Channel',
        title: data.title || data.name || 'YouTube Channel',
        handle: data.handle || data.customUrl || `@${data.id.substring(0, 8)}`,
        customUrl: data.customUrl || data.handle || `@${data.id.substring(0, 8)}`,
        status: data.status || 'ready',
        category: data.category || 'YouTube Live',
        defaultResolution: data.defaultResolution || '1080p60',
        defaultBitrate: data.defaultBitrate || 6500,
        streamKey: data.liveStreamingDetails?.streamKey || data.streamKey || '',
        rtmpUrl: data.liveStreamingDetails?.rtmpUrl || data.rtmpUrl || 'rtmp://a.rtmp.youtube.com/live2',
      } as ChannelDocument;
    });

    return { user, channels };
  }

  /**
   * Switches active channel for a user
   */
  async switchActiveChannel(userId: string, channelId: string) {
    const userRef = this.usersCol.doc(userId);
    const userDoc = await userRef.get();
    if (!userDoc.exists) {
      throw new Error('User not found');
    }

    const userData = userDoc.data() as UserDocument;
    if (!userData.channelIds.includes(channelId)) {
      throw new Error(`Channel ${channelId} does not belong to this user`);
    }

    await userRef.update({
      activeChannelId: channelId,
      'metadata.updatedAt': new Date().toISOString(),
    });

    return { success: true, activeChannelId: channelId };
  }

  /**
   * Saves a YouTube live broadcast record
   */
  async saveBroadcast(broadcast: BroadcastDocument) {
    const cleaned = cleanDoc(broadcast);
    await this.broadcastsCol.doc(broadcast.id).set(cleaned);
    return cleaned;
  }

  /**
   * Retrieves all broadcasts for a user
   */
  async getUserBroadcasts(userId: string): Promise<BroadcastDocument[]> {
    const snapshot = await this.broadcastsCol
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get();
    return snapshot.docs.map((d) => d.data() as BroadcastDocument);
  }

  /**
   * Retrieves all registered users
   */
  async getAllUsers(): Promise<UserDocument[]> {
    const snapshot = await this.usersCol.orderBy('metadata.createdAt', 'desc').limit(20).get();
    return snapshot.docs.map((d) => d.data() as UserDocument);
  }
}

export const userService = new UserService();
