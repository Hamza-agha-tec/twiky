import { Controller, Get, Param, UseGuards, Request, Patch, Body, Query } from '@nestjs/common';
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
    async search(@Query("phone") phone: string) {
        return this.usersService.searchByPhone(phone);
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
