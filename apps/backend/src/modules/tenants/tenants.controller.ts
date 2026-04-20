import { Controller, Get, Patch, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { TenantsService } from './tenants.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser, TenantId } from '../../common/decorators';

@ApiTags('Tenants')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('tenants')
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Get('me')
  async getMyTenant(@TenantId() tenantId: string) {
    return this.tenantsService.findById(tenantId);
  }

  @Patch('me')
  @Roles('admin', 'manager')
  async updateTenant(
    @TenantId() tenantId: string,
    @Body() body: any,
  ) {
    return this.tenantsService.update(tenantId, body);
  }

  @Patch('me/settings')
  @Roles('admin')
  async updateSettings(
    @TenantId() tenantId: string,
    @Body() settings: Record<string, any>,
  ) {
    return this.tenantsService.updateSettings(tenantId, settings);
  }
}
