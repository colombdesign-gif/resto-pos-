import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { TablesService } from './tables.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('Tables')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('tables')
export class TablesController {
  constructor(private readonly svc: TablesService) {}

  @Get('branch/:branchId')
  findAll(@Param('branchId') branchId: string) {
    return this.svc.findAll(branchId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.svc.findById(id);
  }

  @Post('branch/:branchId')
  @Roles('admin', 'manager')
  create(@Param('branchId') branchId: string, @Body() body: any) {
    return this.svc.create(branchId, body);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: any) {
    return this.svc.update(id, body);
  }

  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @Body() body: { status: string }) {
    return this.svc.updateStatus(id, body.status);
  }

  @Post('merge')
  mergeTables(@Body() body: { sourceId: string; targetId: string }) {
    return this.svc.mergeTables(body.sourceId, body.targetId);
  }

  @Post(':id/split')
  splitTable(@Param('id') id: string) {
    return this.svc.splitTable(id);
  }

  @Patch('positions/bulk')
  updatePositions(@Body() body: { positions: { id: string; x: number; y: number }[] }) {
    return this.svc.updatePositions(body.positions);
  }

  @Delete(':id')
  @Roles('admin', 'manager')
  remove(@Param('id') id: string) {
    return this.svc.remove(id);
  }
}
