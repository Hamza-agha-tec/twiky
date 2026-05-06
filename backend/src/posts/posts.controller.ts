import { Controller, Get, Post, Delete, Param, Body, UseGuards, Request } from '@nestjs/common';
import { PostsService } from './posts.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt.guard';
import { CreatePostDto } from './dto/create-post.dto';
import { CreateCommentDto } from './dto/create-comment.dto';

@Controller('posts')
export class PostsController {
    constructor(private readonly postsService: PostsService) {}

    @UseGuards(JwtAuthGuard)
    @Post()
    async createPost(@Request() req: any, @Body() createPostDto: CreatePostDto) {
        return this.postsService.createPost(req.user.userId, createPostDto);
    }

    @UseGuards(OptionalJwtAuthGuard)
    @Get("users/:userId")
    async getFeed(@Param("userId") userId: string, @Request() req: any) {
        return this.postsService.getFeed(userId, req.user?.userId ?? null);
    }

    @UseGuards(JwtAuthGuard)
    @Post(":id/comments")
    async addComment(@Request() req: any, @Param("id") postId: string, @Body() createCommentDto: CreateCommentDto) {
        return this.postsService.addComment(req.user.userId, postId, createCommentDto);
    }

    @UseGuards(JwtAuthGuard)
    @Post(":id/likes")
    async likePost(@Request() req: any, @Param("id") postId: string) {
        return this.postsService.likePost(req.user.userId, postId);
    }

    @UseGuards(JwtAuthGuard)
    @Delete(":id/likes")
    async unlikePost(@Request() req: any, @Param("id") postId: string) {
        return this.postsService.unlikePost(req.user.userId, postId);
    }
}
