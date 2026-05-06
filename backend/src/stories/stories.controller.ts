import { Controller, Get, Post, Delete, Param, Body, UseGuards, Request } from '@nestjs/common';
import { StoriesService } from './stories.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateStoryDto } from './dto/create-story.dto';
import { ReactStoryDto } from './dto/react-story.dto';
import { ChatGateway } from '../messaging/gateway/chat.gateway';

@UseGuards(JwtAuthGuard)
@Controller('stories')
export class StoriesController {
  constructor(
    private readonly storiesService: StoriesService,
    private readonly chatGateway: ChatGateway,
  ) {}

  @Post()
  async createStory(@Request() req: any, @Body() dto: CreateStoryDto) {
    return this.storiesService.createStory(req.user.userId, dto);
  }

  @Get('feed')
  async getFeed(@Request() req: any) {
    return this.storiesService.getFeed(req.user.userId);
  }

  @Get(':id')
  async getStory(@Request() req: any, @Param('id') storyId: string) {
    return this.storiesService.getStoryById(req.user.userId, storyId);
  }

  @Post(':id/view')
  async recordView(@Request() req: any, @Param('id') storyId: string) {
    const result = await this.storiesService.recordView(req.user.userId, storyId);
    if (result.ownerId && result.ownerId !== req.user.userId) {
      this.chatGateway.server.to(`user_${result.ownerId}`).emit('storyViewed', {
        storyId: result.storyId,
        viewsCount: result.viewsCount,
      });
    }
    return result;
  }

  @Get(':id/viewers')
  async getViewers(@Request() req: any, @Param('id') storyId: string) {
    return this.storiesService.getStoryViewers(req.user.userId, storyId);
  }

  @Post(':id/react')
  async reactToStory(@Request() req: any, @Param('id') storyId: string, @Body() dto: ReactStoryDto) {
    const result = await this.storiesService.reactToStory(req.user.userId, storyId, dto.reaction);
    if (result.ownerId && result.ownerId !== req.user.userId) {
      this.chatGateway.server.to(`user_${result.ownerId}`).emit('storyReacted', {
        storyId: result.storyId,
        reactionsCount: result.reactionsCount,
        fromUserId: req.user.userId,
      });
    }
    return result;
  }

  @Delete(':id/react')
  async removeReaction(@Request() req: any, @Param('id') storyId: string) {
    return this.storiesService.removeReaction(req.user.userId, storyId);
  }

  @Delete(':id')
  async deleteStory(@Request() req: any, @Param('id') storyId: string) {
    return this.storiesService.deleteStory(req.user.userId, storyId);
  }
}
