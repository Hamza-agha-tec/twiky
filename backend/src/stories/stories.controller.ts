import { Controller, Get, Post, Delete, Param, Body, UseGuards, Request } from '@nestjs/common';
import { StoriesService } from './stories.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateStoryDto } from './dto/create-story.dto';

@UseGuards(JwtAuthGuard)
@Controller('stories')
export class StoriesController {
  constructor(private readonly storiesService: StoriesService) {}

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
    return this.storiesService.recordView(req.user.userId, storyId);
  }

  @Get(':id/viewers')
  async getViewers(@Request() req: any, @Param('id') storyId: string) {
    return this.storiesService.getStoryViewers(req.user.userId, storyId);
  }

  @Delete(':id')
  async deleteStory(@Request() req: any, @Param('id') storyId: string) {
    return this.storiesService.deleteStory(req.user.userId, storyId);
  }
}
