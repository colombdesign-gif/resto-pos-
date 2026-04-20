import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { CustomersService } from './customers.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantId } from '../../common/decorators';

@ApiTags('Customers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('customers')
export class CustomersController {
  constructor(private readonly svc: CustomersService) {}

  @Get()
  findAll(@TenantId() tid: string, @Query('search') search?: string) {
    return this.svc.findAll(tid, search);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @TenantId() tid: string) {
    return this.svc.findById(id, tid);
  }

  @Post()
  create(@TenantId() tid: string, @Body() body: any) {
    return this.svc.create(tid, body);
  }

  @Patch(':id')
  update(@Param('id') id: string, @TenantId() tid: string, @Body() body: any) {
    return this.svc.update(id, tid, body);
  }

  @Post(':id/loyalty')
  adjustLoyalty(
    @Param('id') id: string,
    @TenantId() tid: string,
    @Body() body: { points: number; type: 'earn' | 'spend' | 'adjust'; orderId?: string },
  ) {
    return this.svc.adjustLoyalty(id, tid, body.points, body.type, body.orderId);
  }

  @Get(':id/loyalty')
  getLoyaltyHistory(@Param('id') id: string) {
    return this.svc.getLoyaltyHistory(id);
  }
}
