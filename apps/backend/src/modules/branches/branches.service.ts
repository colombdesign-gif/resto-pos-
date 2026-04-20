import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Branch } from './entities/branch.entity';

@Injectable()
export class BranchesService {
  constructor(
    @InjectRepository(Branch)
    private readonly branchRepo: Repository<Branch>,
  ) {}

  findAll(tenantId: string) {
    return this.branchRepo.find({
      where: { tenant_id: tenantId, is_active: true },
      order: { created_at: 'ASC' },
    });
  }

  async findById(id: string, tenantId: string) {
    const branch = await this.branchRepo.findOne({
      where: { id, tenant_id: tenantId },
    });
    if (!branch) throw new NotFoundException('Şube bulunamadı');
    return branch;
  }

  create(tenantId: string, data: Partial<Branch>) {
    const branch = this.branchRepo.create({ ...data, tenant_id: tenantId });
    return this.branchRepo.save(branch);
  }

  async update(id: string, tenantId: string, data: Partial<Branch>) {
    await this.findById(id, tenantId);
    await this.branchRepo.update(id, data);
    return this.findById(id, tenantId);
  }

  async remove(id: string, tenantId: string) {
    await this.findById(id, tenantId);
    await this.branchRepo.update(id, { is_active: false });
    return { message: 'Şube silindi' };
  }
}
