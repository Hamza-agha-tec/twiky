import { Injectable, ForbiddenException, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { SupabaseService } from '../supabase/supabase.module';

type AxiosLikeError = {
  message?: string;
  response?: { status?: number; data?: any };
  config?: { url?: string };
};

class SpotifyApiError extends Error {
  constructor(
    public readonly url: string,
    public readonly status: number | undefined,
    public readonly data: any,
    public readonly authenticateHeader: string | undefined,
  ) {
    super('Spotify API request failed');
  }
}

interface NowPlayingCache {
  data: any;
  fetchedAt: number;
}

@Injectable()
export class SpotifyService {
  private readonly logger = new Logger(SpotifyService.name);
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly redirectUri: string;
  private readonly frontendUrl: string;
  // userId → cached now-playing result
  private readonly nowPlayingCache = new Map<string, NowPlayingCache>();
  // userId → active poll interval
  private readonly pollIntervals = new Map<string, NodeJS.Timeout>();
  // userId → change callback
  private readonly changeCallbacks = new Map<string, (data: any) => void>();
  private readonly POLL_INTERVAL = 15_000;

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
    private readonly supabaseService: SupabaseService,
  ) {
    this.clientId = this.configService.get<string>('SPOTIFY_CLIENT_ID') ?? '';
    this.clientSecret = this.configService.get<string>('SPOTIFY_CLIENT_SECRET') ?? '';
    this.redirectUri = this.configService.get<string>('SPOTIFY_REDIRECT_URI') ?? '';
    this.frontendUrl = this.configService.get<string>('FRONTEND_URL') ?? 'http://localhost:3000';

    if (!this.clientId || !this.clientSecret || !this.redirectUri) {
      this.logger.error(
        'Missing Spotify env. Required: SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, SPOTIFY_REDIRECT_URI',
      );
    }
  }

  // ── background polling ────────────────────────────────────────────────────

  getCachedNowPlaying(userId: string): any | null {
    return this.nowPlayingCache.get(userId)?.data ?? null;
  }

  startWatching(userId: string, onChange: (data: any) => void) {
    this.changeCallbacks.set(userId, onChange);
    if (this.pollIntervals.has(userId)) return; // already polling

    const tick = async () => {
      const result = await this.fetchNowPlayingRaw(userId);
      if (!result) return;
      const cached = this.nowPlayingCache.get(userId);
      const trackId = (result.track as any)?.spotify_url;
      const prevTrackId = cached ? (cached.data?.track as any)?.spotify_url : undefined;
      const changed = result.is_playing !== cached?.data?.is_playing || trackId !== prevTrackId;
      this.nowPlayingCache.set(userId, { data: result, fetchedAt: Date.now() });
      if (changed) {
        this.changeCallbacks.get(userId)?.(result);
      }
    };

    tick(); // immediate first fetch
    this.pollIntervals.set(userId, setInterval(tick, this.POLL_INTERVAL));
  }

  stopWatching(userId: string) {
    this.changeCallbacks.delete(userId);
    const interval = this.pollIntervals.get(userId);
    if (interval) {
      clearInterval(interval);
      this.pollIntervals.delete(userId);
    }
  }

  private async fetchNowPlayingRaw(userId: string): Promise<any | null> {
    try {
      const { data: connection, error } = await this.supabaseService
        .getClient()
        .from('spotify_connections')
        .select('access_token, refresh_token, expires_at')
        .eq('user_id', userId)
        .single();

      if (error || !connection) return { is_playing: false, message: 'Spotify not connected' };

      let accessToken = connection.access_token;
      if (new Date(connection.expires_at) <= new Date()) {
        accessToken = await this.refreshAccessToken(userId, connection.refresh_token);
      }

      const response = await this.spotifyGetWithRefresh(
        userId,
        accessToken,
        connection.refresh_token,
        'https://api.spotify.com/v1/me/player/currently-playing',
      );

      if (response.status === 204 || !response.data?.item) return { is_playing: false };

      const track = response.data.item;
      return {
        is_playing: response.data.is_playing,
        track: {
          name: track.name,
          artist: track.artists?.map((a: any) => a.name).join(', '),
          album: track.album?.name,
          album_art: track.album?.images?.[0]?.url,
          spotify_url: track.external_urls?.spotify,
          progress_ms: response.data.progress_ms,
          duration_ms: track.duration_ms,
        },
      };
    } catch {
      return null;
    }
  }

  // ── public API ────────────────────────────────────────────────────────────

  getAuthUrl(state?: string) {
    if (!this.clientId || !this.redirectUri) {
      throw new BadRequestException('Spotify is not configured on the server');
    }
    const scopes = [
      'user-read-currently-playing',
      'user-read-playback-state',
      'user-top-read',
      'user-read-recently-played',
      'playlist-read-private',
      'user-read-private',
    ].join(' ');

    // show_dialog=true helps ensure Spotify returns a refresh_token when re-connecting
    const base = `https://accounts.spotify.com/authorize?response_type=code&show_dialog=true&client_id=${this.clientId}&scope=${encodeURIComponent(
      scopes,
    )}&redirect_uri=${encodeURIComponent(this.redirectUri)}`;
    return state ? `${base}&state=${encodeURIComponent(state)}` : base;
  }

  getFrontendCallbackRedirect(params: { code?: string; state?: string; error?: string }) {
    const base = this.frontendUrl.replace(/\/$/, '');
    const qs = new URLSearchParams();
    if (params.code) qs.set('code', params.code);
    if (params.state) qs.set('state', params.state);
    if (params.error) qs.set('error', params.error);
    return `${base}/spotify-callback?${qs.toString()}`;
  }

  async handleCallback(userId: string, code: string) {
    if (!code) {
      throw new BadRequestException('Missing Spotify authorization code');
    }
    try {
      const response = await firstValueFrom(
        this.httpService.post<any>(
          'https://accounts.spotify.com/api/token',
          new URLSearchParams({
            grant_type: 'authorization_code',
            code,
            redirect_uri: this.redirectUri,
          }).toString(),
          {
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              Authorization: `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')}`,
            },
          },
        ),
      );

      const { access_token, refresh_token, expires_in } = response.data;
      const expiresAt = new Date();
      expiresAt.setSeconds(expiresAt.getSeconds() + expires_in);

      const { error } = await this.supabaseService
        .getClient()
        .from('spotify_connections')
        .upsert({
          user_id: userId,
          access_token,
          refresh_token,
          expires_at: expiresAt.toISOString(),
          updated_at: new Date().toISOString(),
        });

      if (error) throw new Error(`Database error: ${error.message}`);
      return { success: true };
    } catch (error) {
      this.logger.error(`Spotify callback failed: ${error.response?.data?.error || error.message}`);
      throw new BadRequestException('Failed to connect to Spotify');
    }
  }

  async getNowPlaying(targetUserId: string, viewerUserId: string) {
    if (targetUserId !== viewerUserId) {
      const isMutual = await this.checkMutualFollowers(targetUserId, viewerUserId);
      if (!isMutual) throw new ForbiddenException('You must be mutual followers to see Spotify status');
    }
    // Return cached data immediately — background polling keeps it fresh
    const cached = this.getCachedNowPlaying(targetUserId);
    if (cached) return cached;
    // Cold start: fetch once, store in cache
    const result = await this.fetchNowPlayingRaw(targetUserId);
    if (result) this.nowPlayingCache.set(targetUserId, { data: result, fetchedAt: Date.now() });
    return result ?? { is_playing: false };
  }

  async getDetailedProfile(targetUserId: string, viewerUserId: string) {
    // 1. Verify mutual followers if viewer is not the owner
    if (targetUserId !== viewerUserId) {
      const isMutual = await this.checkMutualFollowers(targetUserId, viewerUserId);
      if (!isMutual) {
        throw new ForbiddenException('You must be mutual followers to see the full Spotify profile');
      }
    }

    // 2. Get tokens and cache
    const { data: connection, error } = await this.supabaseService
      .getClient()
      .from('spotify_connections')
      .select('*')
      .eq('user_id', targetUserId)
      .single();

    if (error || !connection) {
      throw new NotFoundException('Spotify not connected for this user');
    }

    // 2.5 Check cache
    if (connection.cached_profile && connection.cache_expires_at && new Date(connection.cache_expires_at) > new Date()) {
      this.logger.log(`Returning cached Spotify profile for user ${targetUserId}`);
      return connection.cached_profile;
    }

    // 3. Refresh token if expired
    let accessToken = connection.access_token;
    if (new Date(connection.expires_at) <= new Date()) {
      accessToken = await this.refreshAccessToken(targetUserId, connection.refresh_token);
    }

    try {
      this.logger.log(`Fetching fresh Spotify profile for user ${targetUserId}`);

      // Fetch "profile" first: if this fails, the token/user isn't allowed at all.
      const profileRes = await this.spotifyGetWithRefresh(
        targetUserId,
        accessToken,
        connection.refresh_token,
        'https://api.spotify.com/v1/me',
      );

      // Fetch optional sections in parallel. If any of these are 403, return partial data instead of failing.
      const optionalResults = await Promise.allSettled([
        this.spotifyGetWithRefresh(
          targetUserId,
          accessToken,
          connection.refresh_token,
          'https://api.spotify.com/v1/me/top/tracks?limit=5&time_range=medium_term',
        ),
        this.spotifyGetWithRefresh(
          targetUserId,
          accessToken,
          connection.refresh_token,
          'https://api.spotify.com/v1/me/player/recently-played?limit=5',
        ),
        this.spotifyGetWithRefresh(
          targetUserId,
          accessToken,
          connection.refresh_token,
          'https://api.spotify.com/v1/me/playlists?limit=10',
        ),
      ]);

      const [topTracksRes, recentTracksRes, playlistsRes] = optionalResults.map(
        (r) => (r.status === 'fulfilled' ? r.value : null) as { status: number; data: any } | null,
      );

      const optionalErrors = optionalResults
        .filter((r) => r.status === 'rejected')
        .map((r) => (r as PromiseRejectedResult).reason)
        .filter((reason) => reason instanceof SpotifyApiError)
        .map((reason: SpotifyApiError) => ({
          url: reason.url,
          status: reason.status,
          data: reason.data,
        }));

      const detailedProfile = {
        profile: {
          display_name: profileRes.data.display_name,
          images: profileRes.data.images,
          followers: profileRes.data.followers?.total ?? 0,
          spotify_url: profileRes.data.external_urls?.spotify,
        },
        top_tracks: topTracksRes?.data?.items
          ? topTracksRes.data.items.map((item: any) => ({
              name: item.name,
              artist: item.artists?.map((a: any) => a.name).join(', '),
              album_art: item.album?.images?.[0]?.url,
              spotify_url: item.external_urls?.spotify,
            }))
          : [],
        recently_played: recentTracksRes?.data?.items
          ? recentTracksRes.data.items.map((item: any) => ({
              name: item.track?.name,
              artist: item.track?.artists?.map((a: any) => a.name).join(', '),
              album_art: item.track?.album?.images?.[0]?.url,
              played_at: item.played_at,
              spotify_url: item.track?.external_urls?.spotify,
            }))
          : [],
        playlists: playlistsRes?.data?.items
          ? playlistsRes.data.items.map((item: any) => ({
              name: item.name,
              description: item.description,
              image: item.images?.[0]?.url,
              tracks_count: item.tracks?.total ?? 0,
              spotify_url: item.external_urls?.spotify,
              owner: item.owner?.display_name,
            }))
          : [],
        partial: optionalErrors.length > 0 ? true : undefined,
        errors: optionalErrors.length > 0 ? optionalErrors : undefined,
      };

      // 5. Update cache (5 minute expiry)
      const cacheExpiresAt = new Date();
      cacheExpiresAt.setMinutes(cacheExpiresAt.getMinutes() + 5);

      await this.supabaseService
        .getClient()
        .from('spotify_connections')
        .update({
          cached_profile: detailedProfile,
          cache_expires_at: cacheExpiresAt.toISOString(),
        })
        .eq('user_id', targetUserId);

      return detailedProfile;
    } catch (error) {
      const isProd = (this.configService.get<string>('NODE_ENV') ?? '').toLowerCase() === 'production';

      if (error instanceof SpotifyApiError) {
        this.logger.error(
          `Failed to fetch detailed Spotify profile: ${error.status ?? 'unknown'} ${error.url} ${JSON.stringify(
            error.data,
          )}${error.authenticateHeader ? ` www-authenticate=${JSON.stringify(error.authenticateHeader)}` : ''}`,
        );

        if (error.status === 401) {
          throw new BadRequestException('Spotify session expired. Please reconnect your Spotify account.');
        }

        if (error.status === 403) {
          // In dev, return exact Spotify details to make the fix deterministic.
          if (!isProd) {
            throw new BadRequestException({
              message: 'Spotify rejected the request (403). See details.',
              spotify: {
                url: error.url,
                status: error.status,
                data: error.data,
                www_authenticate: error.authenticateHeader,
              },
            });
          }

          throw new BadRequestException('Spotify rejected the request (403). Please reconnect and accept permissions.');
        }

        throw new BadRequestException('Failed to fetch Spotify profile data');
      }

      const err = error as AxiosLikeError;
      this.logger.error(
        `Failed to fetch detailed Spotify profile (unknown): ${err.response?.status ?? 'unknown'} ${JSON.stringify(
          err.response?.data ?? err.message,
        )}`,
      );
      throw new BadRequestException('Failed to fetch Spotify profile data');
    }
  }

  private async refreshAccessToken(userId: string, refreshToken: string) {
    try {
      const response = await firstValueFrom(
        this.httpService.post<any>(
          'https://accounts.spotify.com/api/token',
          new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: refreshToken,
          }).toString(),
          {
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              Authorization: `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')}`,
            },
          },
        ),
      );

      const { access_token, expires_in, refresh_token: newRefreshToken } = response.data;
      const expiresAt = new Date();
      expiresAt.setSeconds(expiresAt.getSeconds() + expires_in);

      await this.supabaseService
        .getClient()
        .from('spotify_connections')
        .update({
          access_token,
          refresh_token: newRefreshToken || refreshToken, // Spotify might not always return a new refresh token
          expires_at: expiresAt.toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId);

      return access_token;
    } catch (error) {
      this.logger.error(`Spotify token refresh failed: ${error.message}`);
      throw new BadRequestException('Failed to refresh Spotify session');
    }
  }

  private async spotifyGetWithRefresh(
    userId: string,
    accessToken: string,
    refreshToken: string,
    url: string,
  ): Promise<{ status: number; data: any }> {
    try {
      return await firstValueFrom(
        this.httpService.get<any>(url, {
          headers: { Authorization: `Bearer ${accessToken}` },
        }),
      );
    } catch (error) {
      const err = error as AxiosLikeError;
      if (err.response?.status !== 401) {
        const authenticateHeader =
          (error as any)?.response?.headers?.['www-authenticate'] ??
          (error as any)?.response?.headers?.['WWW-Authenticate'];
        throw new SpotifyApiError(url, err.response?.status, err.response?.data ?? err.message, authenticateHeader);
      }

      const newAccessToken = await this.refreshAccessToken(userId, refreshToken);
      try {
        return await firstValueFrom(
          this.httpService.get<any>(url, {
            headers: { Authorization: `Bearer ${newAccessToken}` },
          }),
        );
      } catch (retryError) {
        const retryErr = retryError as AxiosLikeError;
        const authenticateHeader =
          (retryError as any)?.response?.headers?.['www-authenticate'] ??
          (retryError as any)?.response?.headers?.['WWW-Authenticate'];
        throw new SpotifyApiError(
          url,
          retryErr.response?.status,
          retryErr.response?.data ?? retryErr.message,
          authenticateHeader,
        );
      }
    }
  }

  private async checkMutualFollowers(userId1: string, userId2: string) {
    const { data: follow1 } = await this.supabaseService.getClient()
      .from('follows')
      .select('*')
      .eq('follower_id', userId1)
      .eq('following_id', userId2)
      .single();

    const { data: follow2 } = await this.supabaseService.getClient()
      .from('follows')
      .select('*')
      .eq('follower_id', userId2)
      .eq('following_id', userId1)
      .single();

    return !!(follow1 && follow2);
  }
}
