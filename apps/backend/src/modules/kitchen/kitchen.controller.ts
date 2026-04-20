import { Controller, Get, Patch, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { KitchenService } from './kitchen.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantId } from '../../common/decorators';

@ApiTags('Kitchen')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('kitchen')
export class KitchenController {
  constructor(private readonly svc: KitchenService) {}

  @Get('orders')
  getOrders(
    @Query('branchId') branchId: string,
    @Query('stationId') stationId?: string,
  ) {
    return this.svc.getKitchenOrders(branchId, stationId);
  }

  @Patch('items/:id/status')
  updateItemStatus(
    @Param('id') id: string,
    @Body() body: { status: string },
    @TenantId() tid: string,
  ) {
    return this.svc.updateItemStatus(id, body.status, tid);
  }

  @Post('orders/:id/start')
  startPreparing(@Param('id') id: string, @TenantId() tid: string) {
    return this.svc.startPreparing(id, tid);
  }
}
