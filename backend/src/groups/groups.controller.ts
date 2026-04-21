import { Controller, Get, Post, Delete, Param, Body, UseGuards, Request } from '@nestjs/common';
import { GroupsService } from './groups.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateGroupDto } from './dto/create-group.dto';
import { AddGroupMemberDto } from './dto/add-group-member.dto';

@UseGuards(JwtAuthGuard)
@Controller()
export class GroupsController {
    constructor(private readonly groupsService: GroupsService) {}

    @Post('channels/:channelId/groups')
    async createGroup(
        @Request() req: any, 
        @Param('channelId') channelId: string, 
        @Body() createGroupDto: CreateGroupDto
    ) {
        return this.groupsService.createGroup(channelId, req.user.userId, createGroupDto);
    }

    @Get('channels/:channelId/groups')
    async getChannelGroups(@Param('channelId') channelId: string) {
        return this.groupsService.getGroupsInChannel(channelId);
    }

    @Get('groups/:groupId/members')
    async getGroupMembers(@Param('groupId') groupId: string) {
        return this.groupsService.getGroupMembers(groupId);
    }

    @Delete('groups/:groupId')
    async deleteGroup(@Request() req: any, @Param('groupId') groupId: string) {
        return this.groupsService.deleteGroup(groupId, req.user.userId);
    }

    @Post('groups/:groupId/members')
    async addGroupMember(
        @Param('groupId') groupId: string, 
        @Body() addGroupMemberDto: AddGroupMemberDto
    ) {
        return this.groupsService.addMemberToGroup(groupId, addGroupMemberDto);
    }
}
