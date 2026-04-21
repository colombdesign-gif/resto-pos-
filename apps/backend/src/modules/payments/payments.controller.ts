import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantId, CurrentUser } from '../../common/decorators';

@ApiTags('Payments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('payments')
export class PaymentsController {
  constructor(private readonly svc: PaymentsService) {}

  @Post('order/:orderId')
  processPayment(
    @Param('orderId') orderId: string,
    @TenantId() tid: string,
    @Body() body: any,
  ) {
    return this.svc.processPayment(orderId, tid, body);
  }

  @Get('order/:orderId')
  getOrderPayments(
    @Param('orderId') orderId: string,
    @TenantId() tid: string,
  ) {
    return this.svc.getOrderPayments(orderId, tid);
  }

  @Post('session/open')
  openSession(
    @Body() body: { branchId: string; openingCash: number },
    @CurrentUser('id') userId: string,
  ) {
    return this.svc.openCashSession(body.branchId, userId, body.openingCash);
  }

  @Post('session/close')
  closeSession(
    @Body() body: { branchId: string; closingCash: number; notes: string },
    @CurrentUser('id') userId: string,
  ) {
    return this.svc.closeCashSession(body.branchId, userId, body.closingCash, body.notes);
  }

  @Get('daily-report')
  getDailyReport(
    @Query('branchId') branchId: string,
    @Query('date') date: string,
  ) {
    return this.svc.getDailyReport(branchId, date || new Date().toISOString().split('T')[0]);
  }
}
