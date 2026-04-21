import { Controller, Get, Patch, Param, UseGuards, Request } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  async getNotifications(@Request() req: any) {
    return this.notificationsService.getNotifications(req.user.userId);
  }

  @Patch(':id/read')
  async markAsRead(@Request() req: any, @Param('id') notificationId: string) {
    return this.notificationsService.markAsRead(req.user.userId, notificationId);
  }

  @Patch('read-all')
  async markAllAsRead(@Request() req: any) {
    return this.notificationsService.markAllAsRead(req.user.userId);
  }
}
