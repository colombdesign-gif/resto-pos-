import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { InventoryService } from './inventory.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { TenantId, CurrentUser } from '../../common/decorators';

@ApiTags('Inventory')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('inventory')
export class InventoryController {
  constructor(private readonly svc: InventoryService) {}

  @Get('ingredients')
  findAll(@TenantId() tid: string) {
    return this.svc.findAll(tid);
  }

  @Get('ingredients/alerts')
  getCriticalAlerts(@TenantId() tid: string) {
    return this.svc.getCriticalAlerts(tid);
  }

  @Get('ingredients/:id')
  findOne(@Param('id') id: string, @TenantId() tid: string) {
    return this.svc.findById(id, tid);
  }

  @Post('ingredients')
  @Roles('admin', 'manager')
  create(@TenantId() tid: string, @Body() body: any) {
    return this.svc.create(tid, body);
  }

  @Patch('ingredients/:id')
  @Roles('admin', 'manager')
  update(@Param('id') id: string, @TenantId() tid: string, @Body() body: any) {
    return this.svc.update(id, tid, body);
  }

  @Delete('ingredients/:id')
  @Roles('admin')
  remove(@Param('id') id: string, @TenantId() tid: string) {
    return this.svc.remove(id, tid);
  }

  @Post('transactions')
  addTransaction(@TenantId() tid: string, @CurrentUser('id') uid: string, @Body() body: any) {
    return this.svc.addTransaction(tid, { ...body, created_by: uid });
  }

  @Get('transactions')
  getTransactions(@TenantId() tid: string, @Query('ingredientId') iid?: string) {
    return this.svc.getTransactions(tid, iid);
  }

  @Get('products/:productId/recipe')
  getRecipe(@Param('productId') productId: string) {
    return this.svc.getRecipe(productId);
  }

  @Post('products/:productId/recipe')
  @Roles('admin', 'manager')
  saveRecipe(@Param('productId') productId: string, @Body() body: { items: any[] }) {
    return this.svc.saveRecipe(productId, body.items);
  }
}
