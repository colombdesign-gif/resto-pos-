import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User } from './entities/user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  async findAll(tenantId: string) {
    const users = await this.userRepo.find({
      where: { tenant_id: tenantId },
      order: { created_at: 'DESC' },
    });
    return users.map(({ password_hash, ...u }) => u);
  }

  async findById(id: string, tenantId: string) {
    const user = await this.userRepo.findOne({
      where: { id, tenant_id: tenantId },
    });
    if (!user) throw new NotFoundException('Kullanıcı bulunamadı');
    const { password_hash, ...rest } = user as any;
    return rest;
  }

  async create(tenantId: string, data: any) {
    const existing = await this.userRepo.findOne({
      where: { email: data.email },
    });
    if (existing) throw new ConflictException('Bu e-posta zaten kullanımda');

    const passwordHash = await bcrypt.hash(data.password || 'Restopos123!', 12);
    const user = this.userRepo.create({
      ...data,
      tenant_id: tenantId,
      password_hash: passwordHash,
    });
    const saved = await this.userRepo.save(user);
    const { password_hash, ...rest } = saved as any;
    return rest;
  }

  async update(id: string, tenantId: string, data: any) {
    const user = await this.userRepo.findOne({
      where: { id, tenant_id: tenantId },
    });
    if (!user) throw new NotFoundException('Kullanıcı bulunamadı');

    if (data.password) {
      data.password_hash = await bcrypt.hash(data.password, 12);
      delete data.password;
    }

    await this.userRepo.update(id, data);
    return this.findById(id, tenantId);
  }

  async remove(id: string, tenantId: string) {
    const user = await this.userRepo.findOne({
      where: { id, tenant_id: tenantId },
    });
    if (!user) throw new NotFoundException('Kullanıcı bulunamadı');
    await this.userRepo.update(id, { is_active: false });
    return { message: 'Kullanıcı pasif yapıldı' };
  }
}
