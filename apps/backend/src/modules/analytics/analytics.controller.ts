import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { TenantId } from '../../common/decorators';

@ApiTags('Analytics')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'manager')
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly svc: AnalyticsService) {}

  @Get('top-products')
  getTopProducts(
    @TenantId() tid: string,
    @Query('days') days?: number,
    @Query('limit') limit?: number,
  ) {
    return this.svc.getTopSellingProducts(tid, days || 30, limit || 10);
  }

  @Get('peak-hours')
  getPeakHours(@TenantId() tid: string, @Query('branchId') branchId?: string) {
    return this.svc.getPeakHourPrediction(tid, branchId);
  }

  @Get('stock-forecast')
  getStockForecast(@TenantId() tid: string) {
    return this.svc.getStockForecast(tid);
  }

  @Get('campaign-suggestions')
  getCampaignSuggestions(@TenantId() tid: string) {
    return this.svc.getCampaignSuggestions(tid);
  }

  @Get('revenue-forecast')
  getRevenueForecast(@TenantId() tid: string, @Query('days') days?: number) {
    return this.svc.getRevenueForecast(tid, days || 7);
  }

  @Get('waiter-performance')
  getWaiterPerformance(@TenantId() tid: string, @Query('branchId') branchId?: string) {
    return this.svc.getWaiterPerformance(tid, branchId);
  }

  @Get('menu-mix')
  getMenuMix(@TenantId() tid: string) {
    return this.svc.getMenuMixAnalysis(tid);
  }
}
