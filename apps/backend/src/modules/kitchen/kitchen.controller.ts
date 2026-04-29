import { Controller, Get, Patch, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { KitchenService } from './kitchen.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantId, CurrentUser } from '../../common/decorators';

@ApiTags('Kitchen')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('kitchen')
export class KitchenController {
  constructor(private readonly svc: KitchenService) {}

  @Get('orders')
  getOrders(
    @Query('branchId') qBranchId: string,
    @Query('stationId') stationId: string,
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
  ) {
    // Güvenlik: Eğer kullanıcı admin/manager değilse, sadece kendi şubesini görebilir
    const isRestricted = user.role !== 'admin' && user.role !== 'manager';
    let branchId = qBranchId;

    if (isRestricted) {
      branchId = user.branch_id;
    } else if (!branchId && branchId !== '') {
      // Admin/Manager ama şube seçmemişse kendi şubesine bak (varsa)
      branchId = user.branch_id;
    }

    return this.svc.getKitchenOrders(branchId || null, stationId, tenantId);
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
