import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Table } from './entities/table.entity';
import { EventsGateway } from '../../websocket/events.gateway';

@Injectable()
export class TablesService {
  constructor(
    @InjectRepository(Table)
    private readonly tableRepo: Repository<Table>,
    private readonly dataSource: DataSource,
    private readonly eventsGateway: EventsGateway,
  ) {}

  async findAll(branchId: string) {
    return this.tableRepo.find({
      where: { branch_id: branchId, is_active: true },
      order: { name: 'ASC' },
    });
  }

  async findById(id: string) {
    const table = await this.tableRepo.findOne({ where: { id, is_active: true } });
    if (!table) throw new NotFoundException('Masa bulunamadı');
    return table;
  }

  async create(branchId: string, data: Partial<Table>) {
    const table = this.tableRepo.create({ ...data, branch_id: branchId });
    return this.tableRepo.save(table);
  }

  async update(id: string, data: Partial<Table>) {
    const table = await this.findById(id);
    Object.assign(table, data);
    const saved = await this.tableRepo.save(table);

    // Gerçek zamanlı güncelleme
    this.eventsGateway.emitToTenant(saved.branch_id, 'table.status_changed', saved);
    return saved;
  }

  async updateStatus(id: string, status: string) {
    const table = await this.findById(id);
    table.status = status;
    const saved = await this.tableRepo.save(table);
    this.eventsGateway.emitToTenant(saved.branch_id, 'table.status_changed', saved);
    return saved;
  }

  async mergeTables(sourceId: string, targetId: string) {
    const source = await this.findById(sourceId);
    const target = await this.findById(targetId);

    if (source.branch_id !== target.branch_id) {
      throw new BadRequestException('Farklı şubelerdeki masalar birleştirilemez');
    }

    // Hedef masaya source'u ekle
    const merged = [...(target.merged_with || []), sourceId];
    await this.tableRepo.update(targetId, { merged_with: merged, status: 'occupied' });
    await this.tableRepo.update(sourceId, { status: 'occupied' });

    return this.findById(targetId);
  }

  async splitTable(id: string) {
    const table = await this.findById(id);
    const mergedIds = table.merged_with || [];

    // Birleştirilmiş masaları serbest bırak
    for (const mergedId of mergedIds) {
      await this.tableRepo.update(mergedId, { status: 'available' });
    }

    await this.tableRepo.update(id, { merged_with: [], status: 'available' });
    return this.findById(id);
  }

  async remove(id: string) {
    await this.tableRepo.update(id, { is_active: false });
    return { message: 'Masa silindi' };
  }

  async updatePositions(positions: { id: string; x: number; y: number }[]) {
    for (const pos of positions) {
      await this.tableRepo.update(pos.id, {
        position_x: pos.x,
        position_y: pos.y,
      });
    }
    return { message: 'Pozisyonlar güncellendi' };
  }
}
