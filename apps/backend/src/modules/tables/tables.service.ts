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

    // FIX: branch üzerinden doğru tenant_id'yi bul ve ona gönder
    const [branch] = await this.dataSource.query(
      `SELECT tenant_id FROM branches WHERE id = $1`, [saved.branch_id],
    );
    if (branch) {
      this.eventsGateway.emitToTenant(branch.tenant_id, 'table.status_changed', saved);
    }
    return saved;
  }

  async updateStatus(id: string, status: string) {
    const table = await this.findById(id);
    table.status = status;
    const saved = await this.tableRepo.save(table);
    const [branch] = await this.dataSource.query(
      `SELECT tenant_id FROM branches WHERE id = $1`, [saved.branch_id],
    );
    if (branch) {
      this.eventsGateway.emitToTenant(branch.tenant_id, 'table.status_changed', saved);
    }
    return saved;
  }

  async mergeTables(sourceId: string, targetId: string) {
    const source = await this.findById(sourceId);
    const target = await this.findById(targetId);

    if (source.branch_id !== target.branch_id) {
      throw new BadRequestException('Farklı şubelerdeki masalar birleştirilemez');
    }

    // FIX: Kaynak masadaki aktif siparişleri kontrol et
    const activeOrders = await this.dataSource.query(
      `SELECT id FROM orders WHERE table_id = $1 AND status NOT IN ('closed', 'cancelled') LIMIT 1`,
      [sourceId],
    );
    if (activeOrders.length > 0) {
      throw new BadRequestException('Aktif siparişi olan masa birleştirilemez. Önce siparişi kapatın.');
    }

    const merged = [...(target.merged_with || []), sourceId];
    await this.tableRepo.update(targetId, { merged_with: merged, status: 'occupied' });
    await this.tableRepo.update(sourceId, { status: 'occupied' });

    return this.findById(targetId);
  }

  async splitTable(id: string) {
    const table = await this.findById(id);
    const mergedIds = table.merged_with || [];

    // FIX: Aktif sipariş kontrolü — siparişi olan masayı "available" yapma
    for (const mergedId of mergedIds) {
      const activeOrders = await this.dataSource.query(
        `SELECT id FROM orders WHERE table_id = $1 AND status NOT IN ('closed', 'cancelled') LIMIT 1`,
        [mergedId],
      );
      const newStatus = activeOrders.length > 0 ? 'occupied' : 'available';
      await this.tableRepo.update(mergedId, { status: newStatus });
    }

    // Ana masa için de kontrol
    const mainActiveOrders = await this.dataSource.query(
      `SELECT id FROM orders WHERE table_id = $1 AND status NOT IN ('closed', 'cancelled') LIMIT 1`,
      [id],
    );
    const mainStatus = mainActiveOrders.length > 0 ? 'occupied' : 'available';
    await this.tableRepo.update(id, { merged_with: [], status: mainStatus });

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
