import { Controller, Post, Get, Body, UseGuards, Request, Req } from '@nestjs/common';
import { Request as ExpressRequest } from 'express';
import { PaymentsService } from './payments.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateCheckoutDto } from './dto/checkout.dto';

@Controller('payments')
export class PaymentsController {
    constructor(private readonly paymentsService: PaymentsService) { }

    @UseGuards(JwtAuthGuard)
    @Post('checkout')
    async createCheckout(@Request() req: any, @Body() dto: CreateCheckoutDto) {
        return this.paymentsService.createCheckoutSession(req.user.userId, dto.productId, dto.redirectUrl);
    }

    @UseGuards(JwtAuthGuard)
    @Get('subscription')
    async getSubscription(@Request() req: any) {
        return this.paymentsService.getSubscription(req.user.userId);
    }

    @UseGuards(JwtAuthGuard)
    @Get('portal')
    async getPortal(@Request() req: any) {
        return this.paymentsService.getCustomerPortalUrl(req.user.userId);
    }

    @Post('webhook')
    async handleWebhook(
        @Body() payload: any,
        @Req() req: ExpressRequest & { rawBody?: Buffer }
    ) {
        const rawPayload = req.rawBody?.toString('utf8') ?? JSON.stringify(payload);
        return this.paymentsService.handleWebhook(rawPayload, req.headers);
    }
}
