import { Controller, Post, Body, UseGuards, Request, Get, Param, Patch } from '@nestjs/common';
import { InvitationsService } from './invitations.service';
import { CreateInvitationDto, RespondInvitationDto } from './dto/invitation.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('invitations')
@UseGuards(JwtAuthGuard)
export class InvitationsController {
    constructor(private readonly invitationsService: InvitationsService) { }

    @Post()
    async create(@Request() req: any, @Body() dto: CreateInvitationDto) {
        return this.invitationsService.createInvitation(req.user.userId, dto);
    }

    @Post('respond')
    async respond(@Request() req: any, @Body() dto: RespondInvitationDto) {
        return this.invitationsService.respondToInvitation(req.user.userId, dto.invitationId, dto.status);
    }

    @Get()
    async getInvitations(@Request() req: any) {
        return this.invitationsService.getInvitations(req.user.userId);
    }
}
