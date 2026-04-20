import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tenant } from './entities/tenant.entity';

@Injectable()
export class TenantsService {
  constructor(
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
  ) {}

  async findById(id: string): Promise<Tenant> {
    const tenant = await this.tenantRepo.findOne({ where: { id } });
    if (!tenant) throw new NotFoundException('İşletme bulunamadı');
    return tenant;
  }

  async updateSettings(id: string, settings: Record<string, any>) {
    const tenant = await this.findById(id);
    tenant.settings = { ...tenant.settings, ...settings };
    return this.tenantRepo.save(tenant);
  }

  async update(id: string, data: Partial<Tenant>) {
    await this.tenantRepo.update(id, data);
    return this.findById(id);
  }
}
