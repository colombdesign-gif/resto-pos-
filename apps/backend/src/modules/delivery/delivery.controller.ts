import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { DeliveryService } from './delivery.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantId, CurrentUser } from '../../common/decorators';

@ApiTags('Delivery')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('deliveries')
export class DeliveryController {
  constructor(private readonly svc: DeliveryService) {}

  @Get()
  findAll(@TenantId() tid: string, @Query('courierId') courierId?: string) {
    return this.svc.findAll(tid, courierId);
  }

  @Post()
  create(@TenantId() tid: string, @Body() body: any) {
    return this.svc.createDelivery(tid, body);
  }

  @Patch(':id/assign')
  assign(@Param('id') id: string, @TenantId() tid: string, @Body() body: { courierId: string }) {
    return this.svc.assignCourier(id, body.courierId, tid);
  }

  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @TenantId() tid: string, @Body() body: { status: string }) {
    return this.svc.updateStatus(id, body.status, tid);
  }

  @Patch(':id/my-status')
  updateMyStatus(
    @Param('id') id: string,
    @TenantId() tid: string,
    @Body() body: { status: string },
  ) {
    return this.svc.updateStatus(id, body.status, tid);
  }
}
