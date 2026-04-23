import { Controller, Post, Get, Body, UseGuards, Request, Headers, BadRequestException } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateCheckoutDto } from './dto/checkout.dto';

@Controller('payments')
export class PaymentsController {
    constructor(private readonly paymentsService: PaymentsService) { }

    @UseGuards(JwtAuthGuard)
    @Post('checkout')
    async createCheckout(@Request() req: any, @Body() dto: CreateCheckoutDto) {
        return this.paymentsService.createCheckoutSession(req.user.userId, dto.planId, dto.redirectUrl);
    }

    @UseGuards(JwtAuthGuard)
    @Get('subscription')
    async getSubscription(@Request() req: any) {
        return this.paymentsService.getSubscription(req.user.userId);
    }

    @Post('webhook')
    async handleWebhook(
        @Body() payload: any,
        @Headers('webhook-signature') signature: string
    ) {
        if (!signature) {
            throw new BadRequestException('Missing webhook signature');
        }
        return this.paymentsService.handleWebhook(payload, signature);
    }
}
