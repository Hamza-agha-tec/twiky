import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, Request } from '@nestjs/common';
import { ChannelsService } from './channels.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateChannelDto } from './dto/create-channel.dto';
import { UpdateChannelDto } from './dto/update-channel.dto';
import { AddMemberDto } from './dto/add-member.dto';

@UseGuards(JwtAuthGuard)
@Controller('channels')
export class ChannelsController {
    constructor(private readonly channelsService: ChannelsService) {}

    @Post()
    async createChannel(@Request() req: any, @Body() createChannelDto: CreateChannelDto) {
        return this.channelsService.createChannel(req.user.userId, createChannelDto);
    }

    @Get()
    async getUserChannels(@Request() req: any) {
        return this.channelsService.getUserChannels(req.user.userId);
    }

    @Get("discover")
    async discoverChannels(@Request() req: any) {
        return this.channelsService.discoverChannels(req.user.userId);
    }

    @Get(":id/invite-link")
    async getInviteLink(@Param("id") channelId: string) {
        return this.channelsService.getInviteLink(channelId);
    }

    @Get(":id")
    async getChannelDetails(@Param("id") channelId: string) {
        return this.channelsService.getChannelDetails(channelId);
    }

    @Patch(":id")
    async updateChannel(@Param("id") channelId: string, @Body() updateChannelDto: UpdateChannelDto) {
        return this.channelsService.updateChannel(channelId, updateChannelDto);
    }

    @Delete(":id")
    async deleteChannel(@Request() req: any, @Param("id") channelId: string) {
        return this.channelsService.deleteChannel(req.user.userId, channelId);
    }

    @Get(":id/members")
    async getMembers(@Request() req: any, @Param("id") channelId: string) {
        return this.channelsService.getMembers(channelId, req.user.userId);
    }

    @Post(":id/members")
    async addMember(@Param("id") channelId: string, @Body() addMemberDto: AddMemberDto) {
        return this.channelsService.addMember(channelId, addMemberDto);
    }

    @Delete(":id/members/:userId")
    async kickMember(@Request() req: any, @Param("id") channelId: string, @Param("userId") targetUserId: string) {
        return this.channelsService.kickMember(channelId, req.user.userId, targetUserId);
    }

    @Post(":id/join")
    async joinChannel(@Request() req: any, @Param("id") channelId: string) {
        return this.channelsService.joinChannel(req.user.userId, channelId);
    }

    @Post(":id/request-join")
    async requestJoinChannel(@Request() req: any, @Param("id") channelId: string) {
        return this.channelsService.requestJoinChannel(req.user.userId, channelId);
    }

    @Get(":id/join-requests")
    async getChannelJoinRequests(@Request() req: any, @Param("id") channelId: string) {
        return this.channelsService.getChannelJoinRequests(channelId, req.user.userId);
    }

    @Patch(":id/join-requests/:requestId")
    async respondToChannelJoinRequest(
        @Request() req: any,
        @Param("id") channelId: string,
        @Param("requestId") requestId: string,
        @Body() body: { status: 'ACCEPTED' | 'REJECTED' },
    ) {
        return this.channelsService.respondToChannelJoinRequest(channelId, requestId, body.status, req.user.userId);
    }
}
