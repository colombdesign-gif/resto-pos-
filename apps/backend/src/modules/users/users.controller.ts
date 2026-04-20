import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { TenantId } from '../../common/decorators';

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Roles('admin', 'manager')
  findAll(@TenantId() tenantId: string) {
    return this.usersService.findAll(tenantId);
  }

  @Get(':id')
  @Roles('admin', 'manager')
  findOne(@Param('id') id: string, @TenantId() tenantId: string) {
    return this.usersService.findById(id, tenantId);
  }

  @Post()
  @Roles('admin')
  create(@TenantId() tenantId: string, @Body() body: any) {
    return this.usersService.create(tenantId, body);
  }

  @Patch(':id')
  @Roles('admin', 'manager')
  update(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @Body() body: any,
  ) {
    return this.usersService.update(id, tenantId, body);
  }

  @Delete(':id')
  @Roles('admin')
  remove(@Param('id') id: string, @TenantId() tenantId: string) {
    return this.usersService.remove(id, tenantId);
  }
}
