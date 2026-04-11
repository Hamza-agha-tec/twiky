import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, Request } from '@nestjs/common';
import { ContactsService } from './contacts.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateContactDto, UpdateContactDto } from './dto/contacts.dto';

@Controller('contacts')
@UseGuards(JwtAuthGuard)
export class ContactsController {
  constructor(private readonly contactsService: ContactsService) {}

  @Get()
  async findAll(@Request() req: any) {
    return this.contactsService.findAll(req.user.userId);
  }

  @Post()
  async create(@Request() req: any, @Body() createContactDto: CreateContactDto) {
    return this.contactsService.addContact(req.user.userId, createContactDto);
  }

  @Patch(':contactId')
  async update(
    @Request() req: any,
    @Param('contactId') contactId: string,
    @Body() updateContactDto: UpdateContactDto,
  ) {
    return this.contactsService.updateContact(req.user.userId, contactId, updateContactDto);
  }

  @Patch(':contactId/block')
  async block(@Request() req: any, @Param('contactId') contactId: string, @Body('is_blocked') is_blocked: boolean) {
    return this.contactsService.updateContact(req.user.userId, contactId, { is_blocked });
  }

  @Patch(':contactId/archive')
  async archive(@Request() req: any, @Param('contactId') contactId: string, @Body('is_archived') is_archived: boolean) {
    return this.contactsService.updateContact(req.user.userId, contactId, { is_archived });
  }

  @Patch(':contactId/favorite')
  async favorite(@Request() req: any, @Param('contactId') contactId: string, @Body('is_favorite') is_favorite: boolean) {
    return this.contactsService.updateContact(req.user.userId, contactId, { is_favorite });
  }

  @Patch(':contactId/pin')
  async pin(@Request() req: any, @Param('contactId') contactId: string, @Body('is_pinned') is_pinned: boolean) {
    return this.contactsService.updateContact(req.user.userId, contactId, { is_pinned });
  }

  @Patch(':contactId/mute')
  async mute(@Request() req: any, @Param('contactId') contactId: string, @Body('is_muted') is_muted: boolean) {
    return this.contactsService.updateContact(req.user.userId, contactId, { is_muted });
  }

  @Delete(':contactId')
  async remove(@Request() req: any, @Param('contactId') contactId: string) {
    return this.contactsService.removeContact(req.user.userId, contactId);
  }
}
