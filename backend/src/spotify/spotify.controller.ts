import { BadRequestException, Controller, Delete, Get, Param, Query, Request, Res, UseGuards, ParseIntPipe, Optional } from '@nestjs/common';
import type { Response } from 'express';
import { SpotifyService } from './spotify.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('spotify')
export class SpotifyController {
  constructor(private readonly spotifyService: SpotifyService) { }

  @UseGuards(JwtAuthGuard)
  @Get('auth')
  async login(@Request() req: any) {
    const url = this.spotifyService.getAuthUrl(req.user?.userId);
    return { url };
  }

  // Note: This callback might be called without the JWT in headers if handled as a simple redirect.
  // However, Spotify doesn't send the Twiky JWT back. We usually handle this by storing the userId
  // in a state parameter or a session/cookie. 
  // For simplicity here, we'll assume the frontend handles the redirect and passes the code to an endpoint
  // that IS guarded, OR we use a state parameter.

  @Get('callback')
  async callback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') error: string | undefined,
    @Res() res: Response,
  ) {
    // In a production app, we'd verify the 'state' parameter here.
    // Since we don't have the userId directly in this redirect, 
    // the best flow is:
    // 1. Frontend opens a popup or redirects.
    // 2. Spotify redirects to this backend endpoint.
    // 3. This endpoint redirects back to the frontend with the code, 
    //    or handles it if we have a session.

    // Simplest for now: Redirect back to frontend with the code (and state/error when present)
    return res.redirect(this.spotifyService.getFrontendCallbackRedirect({ code, state, error }));
  }

  @UseGuards(JwtAuthGuard)
  @Get('connect')
  async connect(@Request() req: any, @Query('code') code: string) {
    if (!code) {
      throw new BadRequestException('Missing Spotify authorization code');
    }
    return this.spotifyService.handleCallback(req.user.userId, code);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('disconnect')
  async disconnect(@Request() req: any) {
    return this.spotifyService.disconnect(req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('now-playing/:userId')
  async getNowPlaying(@Request() req: any, @Param('userId') targetUserId: string) {
    return this.spotifyService.getNowPlaying(targetUserId, req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile/:userId')
  async getProfile(@Request() req: any, @Param('userId') targetUserId: string) {
    return this.spotifyService.getDetailedProfile(targetUserId, req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('search')
  async search(@Query('q') q: string) {
    if (!q?.trim()) throw new BadRequestException('Missing search query');
    return this.spotifyService.searchTracks(q.trim());
  }
}
