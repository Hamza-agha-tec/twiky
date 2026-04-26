import { Controller, Post, Get, Body, UseGuards, Request, Req, Param } from '@nestjs/common';
import { Request as ExpressRequest } from 'express';
import { PaymentsService } from './payments.service';
import { ProductPaymentsService } from './product-payments.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateCheckoutDto } from './dto/checkout.dto';
import { ProductCheckoutDto } from './dto/order.dto';

@Controller('payments')
export class PaymentsController {
    constructor(
        private readonly paymentsService: PaymentsService,
        private readonly productPaymentsService: ProductPaymentsService,
    ) { }

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

    @UseGuards(JwtAuthGuard)
    @Post('checkout/product')
    async createProductCheckout(@Request() req: any, @Body() dto: ProductCheckoutDto) {
        return this.productPaymentsService.createProductCheckout(req.user.userId, dto);
    }

    @UseGuards(JwtAuthGuard)
    @Get('orders')
    async getOrders(@Request() req: any) {
        return this.productPaymentsService.getOrders(req.user.userId);
    }

    @UseGuards(JwtAuthGuard)
    @Get('orders/:orderId')
    async getOrderById(@Request() req: any, @Param('orderId') orderId: string) {
        return this.productPaymentsService.getOrderById(req.user.userId, orderId);
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
