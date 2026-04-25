import { Controller, Get, Post, Delete, Param, Body, UseGuards, Request, Patch, HttpCode } from '@nestjs/common';
import { GroupsService } from './groups.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateGroupDto } from './dto/create-group.dto';
import { AddGroupMemberDto } from './dto/add-group-member.dto';

@UseGuards(JwtAuthGuard)
@Controller()
export class GroupsController {
    constructor(private readonly groupsService: GroupsService) { }

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

    @Patch('groups/:groupId')
    async updateGroup(
        @Request() req: any,
        @Param('groupId') groupId: string,
        @Body() body: { name?: string; description?: string; group_type?: 'text' | 'voice'; access_type?: 'PUBLIC' | 'PRIVATE' }
    ) {
        return this.groupsService.updateGroup(groupId, req.user.userId, body);
    }

    @Delete('groups/:groupId')
    async deleteGroup(@Request() req: any, @Param('groupId') groupId: string) {
        return this.groupsService.deleteGroup(groupId, req.user.userId);
    }

    @Post('groups/:groupId/members')
    async addGroupMember(
        @Request() req: any,
        @Param('groupId') groupId: string,
        @Body() addGroupMemberDto: AddGroupMemberDto
    ) {
        return this.groupsService.addMemberToGroup(groupId, req.user.userId, addGroupMemberDto);
    }

    @Patch('groups/:groupId/members')
    async updateGroupMemberRole(
        @Request() req: any,
        @Param('groupId') groupId: string,
        @Body() updateGroupMemberRoleDto: AddGroupMemberDto
    ) {
        return this.groupsService.updateGroupMemberRole(groupId, req.user.userId, updateGroupMemberRoleDto);
    }

    @Delete('groups/:groupId/members/:memberId')
    async deleteGroupMember(
        @Request() req: any,
        @Param('groupId') groupId: string,
        @Param('memberId') memberId: string
    ) {
        return this.groupsService.deleteGroupMember(groupId, req.user.userId, memberId);
    }

    @Post('groups/:groupId/join-requests')
    @HttpCode(200)
    async requestJoin(@Request() req: any, @Param('groupId') groupId: string) {
        return this.groupsService.requestJoinGroup(groupId, req.user.userId);
    }

    @Get('groups/:groupId/join-requests')
    async getJoinRequests(@Request() req: any, @Param('groupId') groupId: string) {
        return this.groupsService.getJoinRequests(groupId, req.user.userId);
    }

    @Patch('groups/:groupId/join-requests/:requestId')
    async respondToJoinRequest(
        @Request() req: any,
        @Param('groupId') groupId: string,
        @Param('requestId') requestId: string,
        @Body() body: { status: 'ACCEPTED' | 'REJECTED' }
    ) {
        return this.groupsService.respondToJoinRequest(groupId, requestId, body.status, req.user.userId);
    }
}
