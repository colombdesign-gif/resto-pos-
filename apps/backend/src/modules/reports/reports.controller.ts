import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { TenantId } from '../../common/decorators';

@ApiTags('Reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'manager')
@Controller('reports')
export class ReportsController {
  constructor(private readonly svc: ReportsService) {}

  @Get('dashboard')
  getDashboard(@TenantId() tid: string, @Query('branchId') branchId?: string) {
    return this.svc.getDashboardStats(tid, branchId);
  }

  @Get('sales')
  getSales(
    @TenantId() tid: string,
    @Query('branchId') branchId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('groupBy') groupBy?: 'day' | 'week' | 'month',
  ) {
    const today = new Date().toISOString().split('T')[0];
    return this.svc.getSalesReport(tid, {
      branchId,
      startDate: startDate || today,
      endDate: endDate || today,
      groupBy,
    });
  }

  @Get('products')
  getProducts(
    @TenantId() tid: string,
    @Query('branchId') branchId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('limit') limit?: number,
  ) {
    const today = new Date().toISOString().split('T')[0];
    return this.svc.getProductReport(tid, {
      branchId,
      startDate: startDate || today,
      endDate: endDate || today,
      limit: limit || 20,
    });
  }

  @Get('waiters')
  getWaiters(
    @TenantId() tid: string,
    @Query('branchId') branchId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const today = new Date().toISOString().split('T')[0];
    return this.svc.getWaiterReport(tid, {
      branchId,
      startDate: startDate || today,
      endDate: endDate || today,
    });
  }

  @Get('branches')
  getBranches(
    @TenantId() tid: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const today = new Date().toISOString().split('T')[0];
    return this.svc.getBranchReport(tid, startDate || today, endDate || today);
  }

  @Get('hourly')
  getHourly(
    @TenantId() tid: string,
    @Query('branchId') branchId?: string,
    @Query('date') date?: string,
  ) {
    return this.svc.getHourlyReport(tid, branchId, date);
  }
}
