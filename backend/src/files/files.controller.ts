import {
  Body,
  Controller,
  Post,
  Param,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  Request,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { FilesService } from './files.service';

@UseGuards(JwtAuthGuard)
@Controller('files')
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Post('channels/:channelId/banner')
  @UseInterceptors(FileInterceptor('file'))
  async uploadChannelBanner(
    @Request() req: { user: { userId: string } },
    @Param('channelId') channelId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.filesService.uploadChannelImage(req.user.userId, channelId, 'banner', file);
  }

  @Post('channels/:channelId/logo')
  @UseInterceptors(FileInterceptor('file'))
  async uploadChannelLogo(
    @Request() req: { user: { userId: string } },
    @Param('channelId') channelId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.filesService.uploadChannelImage(req.user.userId, channelId, 'logo', file);
  }

  @Post('users/me/avatar_url')
  @UseInterceptors(FileInterceptor('file'))
  async uploadUserAvatar(
    @Request() req: { user: { userId: string } },
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.filesService.uploadUserImage(req.user.userId, 'avatar_url', file);
  }

  @Post('users/me/enter_sound')
  @UseInterceptors(FileInterceptor('file'))
  async uploadUserEnterSound(
    @Request() req: { user: { userId: string } },
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.filesService.uploadUserEnterSound(req.user.userId, file);
  }

  /** Second user image slot in the `users` bucket; map to `users.banner` on the client if you use it as a header image. */
  @Post('users/me/logo')
  @UseInterceptors(FileInterceptor('file'))
  async uploadUserLogo(
    @Request() req: { user: { userId: string } },
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.filesService.uploadUserImage(req.user.userId, 'logo', file);
  }

  @Post('groups/:groupId/banner')
  @UseInterceptors(FileInterceptor('file'))
  async uploadGroupBanner(
    @Request() req: { user: { userId: string } },
    @Param('groupId') groupId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.filesService.uploadGroupImage(req.user.userId, groupId, 'banner', file);
  }

  @Post('groups/:groupId/logo')
  @UseInterceptors(FileInterceptor('file'))
  async uploadGroupLogo(
    @Request() req: { user: { userId: string } },
    @Param('groupId') groupId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.filesService.uploadGroupImage(req.user.userId, groupId, 'logo', file);
  }

  @Post('groups/:groupId/file')
  @UseInterceptors(FileInterceptor('file'))
  async uploadGroupPrimaryFile(
    @Request() req: { user: { userId: string } },
    @Param('groupId') groupId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.filesService.uploadGroupPrimaryFile(req.user.userId, groupId, file);
  }

  @Post('groups/:groupId/files')
  @UseInterceptors(FileInterceptor('file'))
  async uploadGroupExtra(
    @Request() req: { user: { userId: string } },
    @Param('groupId') groupId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.filesService.uploadGroupExtra(req.user.userId, groupId, file);
  }

  @Post('messages/upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadMessageFile(
    @Request() req: { user: { userId: string } },
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.filesService.uploadMessageFile(req.user.userId, file);
  }

  @Post('stories/upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadStoryMedia(
    @Request() req: { user: { userId: string } },
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.filesService.uploadStoryMedia(req.user.userId, file);
  }

  @Post('stories/signed-url')
  async getStorySignedUploadUrl(
    @Request() req: { user: { userId: string } },
    @Body() body: { filename: string; mimeType: string },
  ) {
    return this.filesService.getStorySignedUploadUrl(req.user.userId, body.filename, body.mimeType);
  }
}
