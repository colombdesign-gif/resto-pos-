import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, Query, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { MenuService } from './menu.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { TenantId, Public } from '../../common/decorators';

@ApiTags('Menu')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('menu')
export class MenuController {
  constructor(private readonly svc: MenuService) {}

  // ─── KATEGORİLER ──────────────────────────────────────────
  @Get('categories')
  getCategories(@TenantId() tid: string) {
    return this.svc.getCategories(tid);
  }

  @Post('categories')
  @Roles('admin', 'manager')
  createCategory(@TenantId() tid: string, @Body() body: any) {
    return this.svc.createCategory(tid, body);
  }

  @Patch('categories/:id')
  @Roles('admin', 'manager')
  updateCategory(@Param('id') id: string, @TenantId() tid: string, @Body() body: any) {
    return this.svc.updateCategory(id, tid, body);
  }

  @Delete('categories/:id')
  @Roles('admin', 'manager')
  removeCategory(@Param('id') id: string, @TenantId() tid: string) {
    return this.svc.removeCategory(id, tid);
  }

  // ─── İSTASYONLAR ──────────────────────────────────────────
  @Get('stations/branch/:branchId')
  getStations(@Param('branchId') branchId: string) {
    return this.svc.getStations(branchId);
  }

  @Post('stations/branch/:branchId')
  @Roles('admin', 'manager')
  createStation(@Param('branchId') branchId: string, @Body() body: any) {
    return this.svc.createStation(branchId, body);
  }

  @Patch('stations/:id')
  @Roles('admin', 'manager')
  updateStation(@Param('id') id: string, @Body() body: any) {
    return this.svc.updateStation(id, body);
  }

  // ─── ÜRÜNLER ──────────────────────────────────────────────
  @Get('products')
  getProducts(
    @TenantId() tid: string,
    @Query('categoryId') categoryId?: string,
    @Query('stationId') stationId?: string,
    @Query('search') search?: string,
  ) {
    return this.svc.getProducts(tid, { categoryId, stationId, search });
  }

  @Get('products/:id')
  getProduct(@Param('id') id: string, @TenantId() tid: string) {
    return this.svc.getProductById(id, tid);
  }

  @Post('products')
  @Roles('admin', 'manager')
  createProduct(@TenantId() tid: string, @Body() body: any) {
    return this.svc.createProduct(tid, body);
  }

  @Patch('products/:id')
  @Roles('admin', 'manager')
  updateProduct(@Param('id') id: string, @TenantId() tid: string, @Body() body: any) {
    return this.svc.updateProduct(id, tid, body);
  }

  @Post('products/:id/toggle')
  toggleAvailability(@Param('id') id: string, @TenantId() tid: string) {
    return this.svc.toggleAvailability(id, tid);
  }

  @Delete('products/:id')
  @Roles('admin', 'manager')
  removeProduct(@Param('id') id: string, @TenantId() tid: string) {
    return this.svc.removeProduct(id, tid);
  }

  // ─── PUBLIC QR MENÜ ───────────────────────────────────────
  @Public()
  @Get('public/:slug')
  getPublicMenu(@Param('slug') slug: string) {
    return this.svc.getPublicMenu(slug);
  }
}
