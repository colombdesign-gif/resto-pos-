import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { BranchesService } from './branches.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { TenantId } from '../../common/decorators';

@ApiTags('Branches')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('branches')
export class BranchesController {
  constructor(private readonly svc: BranchesService) {}

  @Get()
  findAll(@TenantId() tenantId: string) {
    return this.svc.findAll(tenantId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @TenantId() tenantId: string) {
    return this.svc.findById(id, tenantId);
  }

  @Post()
  @Roles('admin')
  create(@TenantId() tenantId: string, @Body() body: any) {
    return this.svc.create(tenantId, body);
  }

  @Patch(':id')
  @Roles('admin', 'manager')
  update(@Param('id') id: string, @TenantId() tenantId: string, @Body() body: any) {
    return this.svc.update(id, tenantId, body);
  }

  @Delete(':id')
  @Roles('admin')
  remove(@Param('id') id: string, @TenantId() tenantId: string) {
    return this.svc.remove(id, tenantId);
  }
}
