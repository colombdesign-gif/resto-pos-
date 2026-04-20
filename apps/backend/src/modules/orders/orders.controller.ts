import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, Query, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { OrdersService } from './orders.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { TenantId, CurrentUser } from '../../common/decorators';

@ApiTags('Orders')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('orders')
export class OrdersController {
  constructor(private readonly svc: OrdersService) {}

  @Get()
  findAll(
    @TenantId() tid: string,
    @Query('branchId') branchId?: string,
    @Query('status') status?: string,
    @Query('type') type?: string,
    @Query('date') date?: string,
    @Query('tableId') tableId?: string,
  ) {
    return this.svc.findAll(tid, { branchId, status, type, date, tableId });
  }

  @Get('table/:tableId/active')
  getActiveByTable(@Param('tableId') tableId: string) {
    return this.svc.findActiveByTable(tableId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @TenantId() tid: string) {
    return this.svc.findById(id, tid);
  }

  @Post()
  create(
    @TenantId() tid: string,
    @CurrentUser('id') waiterId: string,
    @Body() body: any,
  ) {
    return this.svc.create(tid, { ...body, waiter_id: body.waiter_id || waiterId });
  }

  @Post(':id/items')
  addItems(
    @Param('id') id: string,
    @TenantId() tid: string,
    @Body() body: { items: any[] },
  ) {
    return this.svc.addItems(id, tid, body.items);
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @TenantId() tid: string,
    @Body() body: { status: string },
  ) {
    return this.svc.updateStatus(id, tid, body.status);
  }

  @Delete(':id/items/:itemId')
  cancelItem(
    @Param('id') orderId: string,
    @Param('itemId') itemId: string,
    @TenantId() tid: string,
  ) {
    return this.svc.cancelItem(orderId, itemId, tid);
  }
}
