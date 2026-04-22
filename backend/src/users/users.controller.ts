import { Controller, Get, Param, Post, Delete, UseGuards, Request, Patch, Body, Query } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateSettingsDto } from './dto/update-settings.dto';

@Controller('users')
export class UsersController {
    constructor(private readonly usersService: UsersService) { }

    @UseGuards(JwtAuthGuard)
    @Get("profile")
    async getProfile(@Request() req: any) {
        return this.usersService.getUserById(req.user.userId);
    }

    @UseGuards(JwtAuthGuard)
    @Patch("profile")
    async updateProfile(@Request() req: any, @Body() updateData: UpdateUserDto) {
        return this.usersService.updateProfile(req.user.userId, updateData);
    }

    @UseGuards(JwtAuthGuard)
    @Get("settings")
    async getSettings(@Request() req: any) {
        return this.usersService.getSettings(req.user.userId);
    }

    @UseGuards(JwtAuthGuard)
    @Patch("settings")
    async updateSettings(@Request() req: any, @Body() updateData: UpdateSettingsDto) {
        return this.usersService.updateSettings(req.user.userId, updateData);
    }

    @UseGuards(JwtAuthGuard)
    @Get("search")
    async search(@Query("username") username: string , @Request() req: any) {
        return this.usersService.searchByUsername(username , req.user.userId);
    }

    @UseGuards(JwtAuthGuard)
    @Post("follows/:id")
    async followUser(@Request() req: any, @Param("id") followingId: string) {
        return this.usersService.followUser(req.user.userId, followingId);
    }

    @UseGuards(JwtAuthGuard)
    @Delete("follows/:id")
    async unfollowUser(@Request() req: any, @Param("id") followingId: string) {
        return this.usersService.unfollowUser(req.user.userId, followingId);
    }

    @Get(":id/followers")
    async getFollowers(@Param("id") id: string) {
        return this.usersService.getFollowers(id);
    }

    @Get(":id/following")
    async getFollowing(@Param("id") id: string) {
        return this.usersService.getFollowing(id);
    }

    @Get("username/:username")
    async getUserByUsername(@Param("username") username: string) {
        return this.usersService.getUserByUsername(username);
    }

    @Get(":id")
    getUserById(@Param("id") id: string) {
        return this.usersService.getUserById(id);
    }

    @Get()
    getUsers() {
        return this.usersService.getUsers();
    }
}
