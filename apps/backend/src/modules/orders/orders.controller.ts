import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, Query, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { OrdersService } from './orders.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { TenantId, CurrentUser, Public } from '../../common/decorators';

@ApiTags('Orders')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('orders')
export class OrdersController {
  constructor(private readonly svc: OrdersService) {}

  @Get()
  findAll(
    @TenantId() tid: string,
    @CurrentUser() user: any,
    @Query('branchId') qBranchId: string,
    @Query('status') status?: string,
    @Query('type') type?: string,
    @Query('date') date?: string,
    @Query('tableId') tableId?: string,
  ) {
    const isRestricted = user.role !== 'admin' && user.role !== 'manager';
    let branchId = qBranchId;

    if (isRestricted) {
      branchId = user.branch_id;
    } else if (!branchId && branchId !== '') {
      // Admin/Manager ama şube seçmemişse kendi şubesine bak (varsa)
      branchId = user.branch_id;
    }
    
    return this.svc.findAll(tid, { branchId: branchId || undefined, status, type, date, tableId });
  }

  @Get('table/:tableId/active')
  getActiveByTable(@Param('tableId') tableId: string) {
    return this.svc.findActiveByTable(tableId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @TenantId() tid: string) {
    return this.svc.findById(id, tid);
  }

  @Public()
  @Post()
  create(
    @TenantId() tid: string,
    @CurrentUser('id') waiterId: string,
    @Body() body: any,
  ) {
    // QR siparişi ise tid'yi body'den veya slug'dan gelen veriyle eledik (middleware/header üzerinden geçmeli)
    // QR siparişi ise waiterId null olacaktır, OrdersService bunu desteklemeli.
    return this.svc.create(tid || body.tenant_id, { 
      ...body, 
      waiter_id: waiterId || body.waiter_id || null 
    });
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

  @Patch(':id/items/:itemId/status')
  updateItemStatus(
    @Param('id') orderId: string,
    @Param('itemId') itemId: string,
    @TenantId() tid: string,
    @Body() body: { status: string },
  ) {
    return this.svc.updateItemStatus(orderId, itemId, tid, body.status);
  }

  @Delete(':id/items/:itemId')
  cancelItem(
    @Param('id') orderId: string,
    @Param('itemId') itemId: string,
    @TenantId() tid: string,
    @Query('reason') reason?: string,
    @CurrentUser('id') waiterId?: string,
  ) {
    return this.svc.cancelItem(orderId, itemId, tid, reason, waiterId);
  }
}
