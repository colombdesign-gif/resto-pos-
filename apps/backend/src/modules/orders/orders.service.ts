import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Order, OrderItem } from './entities/order.entity';
import { EventsGateway } from '../../websocket/events.gateway';
import { InventoryService } from '../inventory/inventory.service';

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    @InjectRepository(OrderItem)
    private readonly itemRepo: Repository<OrderItem>,
    private readonly dataSource: DataSource,
    private readonly eventsGateway: EventsGateway,
    private readonly inventoryService: InventoryService,
  ) {}

  // ─── TÜM SİPARİŞLERİ LİSTELE ─────────────────────────────
  async findAll(tenantId: string, filters?: {
    branchId?: string;
    status?: string;
    type?: string;
    date?: string;
    tableId?: string;
  }) {
    const qb = this.orderRepo.createQueryBuilder('o')
      .where('o.tenant_id = :tenantId', { tenantId })
      .leftJoinAndSelect('o.items', 'items')
      .orderBy('o.created_at', 'DESC')
      .take(100);

    if (filters?.branchId) qb.andWhere('o.branch_id = :branchId', { branchId: filters.branchId });
    if (filters?.status) qb.andWhere('o.status = :status', { status: filters.status });
    if (filters?.type) qb.andWhere('o.type = :type', { type: filters.type });
    if (filters?.tableId) qb.andWhere('o.table_id = :tableId', { tableId: filters.tableId });
    if (filters?.date) {
      qb.andWhere('DATE(o.created_at) = :date', { date: filters.date });
    }

    return qb.getMany();
  }

  // ─── AKTİF MASA SİPARİŞİ ─────────────────────────────────
  async findActiveByTable(tableId: string) {
    return this.orderRepo.findOne({
      where: { table_id: tableId, status: 'preparing' },
      relations: ['items'],
    }) || this.orderRepo.findOne({
      where: { table_id: tableId, status: 'pending' },
      relations: ['items'],
    });
  }

  // ─── SİPARİŞ DETAY ────────────────────────────────────────
  async findById(id: string, tenantId: string) {
    const order = await this.orderRepo.findOne({
      where: { id, tenant_id: tenantId },
      relations: ['items'],
    });
    if (!order) throw new NotFoundException('Sipariş bulunamadı');
    return order;
  }

  // ─── YENİ SİPARİŞ ────────────────────────────────────────
  async create(tenantId: string, data: any) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Sipariş numarası al (Atomic SQL)
      const numResult = await queryRunner.query(
        `SELECT COALESCE(MAX(order_number), 999) + 1 AS next FROM orders WHERE branch_id = $1`,
        [data.branch_id],
      );
      const orderNumber = numResult[0].next;

      // 2. İlk hesaplamalar ve vergi kontrolü
      let subtotal = 0;
      let taxTotal = 0;
      for (const item of data.items) {
        const itemTotal = Number(item.unit_price) * item.quantity;
        subtotal += itemTotal;
        const [productRow] = await queryRunner.query(`SELECT tax_rate FROM products WHERE id = $1`, [item.product_id]);
        const taxRate = productRow?.tax_rate || 8;
        taxTotal += (itemTotal * taxRate) / (100 + taxRate);
      }

      // 3. Siparişi Kaydet
      const [orderRow] = await queryRunner.query(
        `INSERT INTO orders 
          (tenant_id, branch_id, table_id, order_number, type, status, waiter_id, source, subtotal, tax_total, total)
         VALUES ($1,$2,$3,$4,$5,'pending',$6,$7,$8,$9,$10) RETURNING *`,
        [tenantId, data.branch_id, data.table_id || null, orderNumber, data.type, data.waiter_id || null, data.source || 'pos', subtotal, taxTotal, subtotal]
      );

      // 4. Ürünleri Kaydet ve STOK DÜŞÜMÜ Yap
      for (const item of data.items) {
        const itemTotal = Number(item.unit_price) * item.quantity;
        await queryRunner.query(
          `INSERT INTO order_items (order_id, product_id, quantity, unit_price, total_price, status, modifiers)
           VALUES ($1,$2,$3,$4,$5,'pending',$6)`,
          [orderRow.id, item.product_id, item.quantity, item.unit_price, itemTotal, JSON.stringify(item.modifiers || [])]
        );

        // STOK DÜŞÜMÜ (Atomic)
        await this.inventoryService.deductStockByRecipe(item.product_id, item.quantity, tenantId, orderRow.id, queryRunner.manager);
      }

      if (data.table_id) {
        await queryRunner.query(`UPDATE tables SET status = 'occupied' WHERE id = $1`, [data.table_id]);
      }

      await queryRunner.commitTransaction();
      const fullOrder = await this.findById(orderRow.id, tenantId);
      this.eventsGateway.emitToTenant(tenantId, 'order.created', fullOrder);
      return fullOrder;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  // ─── SİPARİŞE ÜRÜN EKLE ──────────────────────────────────
  async addItems(orderId: string, tenantId: string, items: any[]) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const order = await this.findById(orderId, tenantId);
      if (['closed', 'cancelled'].includes(order.status)) throw new BadRequestException('Kapalı siparişe ürün eklenemez');

      let addedSubtotal = 0;
      for (const item of items) {
        const itemTotal = Number(item.unit_price) * item.quantity;
        addedSubtotal += itemTotal;

        await queryRunner.manager.save(OrderItem, {
          order_id: orderId,
          product_id: item.product_id,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total_price: itemTotal,
          status: 'pending',
          modifiers: item.modifiers || [],
        });

        // STOK DÜŞÜMÜ
        await this.inventoryService.deductStockByRecipe(item.product_id, item.quantity, tenantId, orderId, queryRunner.manager);
      }

      await queryRunner.manager.update(Order, orderId, {
        subtotal: Number(order.subtotal) + addedSubtotal,
        total: Number(order.total) + addedSubtotal,
      });

      await queryRunner.commitTransaction();
      const updated = await this.findById(orderId, tenantId);
      this.eventsGateway.emitToTenant(tenantId, 'order.updated', updated);
      return updated;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  // ─── SİPARİŞ DURUMU GÜNCELLE ─────────────────────────────
  async updateStatus(id: string, tenantId: string, status: string) {
    const order = await this.findById(id, tenantId);

    // İptal durumunda stok iadesi
    if (status === 'cancelled' && order.status !== 'cancelled') {
      for (const item of order.items) {
        if (item.status !== 'cancelled') {
          await this.inventoryService.returnStockByRecipe(item.product_id, item.quantity, tenantId, id);
        }
      }
    }

    const updates: any = { status };
    if (status === 'closed') {
      updates.closed_at = new Date();
      if (order.table_id) {
        await this.dataSource.query(`UPDATE tables SET status = 'available' WHERE id = $1`, [order.table_id]);
      }
    }

    await this.orderRepo.update(id, updates);
    const updated = await this.findById(id, tenantId);
    this.eventsGateway.emitToTenant(tenantId, 'order.status_changed', updated);
    return updated;
  }

  // ─── ÜRÜN İPTAL ───────────────────────────────────────────
  async cancelItem(orderId: string, itemId: string, tenantId: string) {
    const order = await this.findById(orderId, tenantId);
    const item = order.items.find((i) => i.id === itemId);
    if (!item) throw new NotFoundException('Ürün bulunamadı');
    if (item.status === 'cancelled') return order;

    // STOK İADESİ
    await this.inventoryService.returnStockByRecipe(item.product_id, item.quantity, tenantId, orderId);

    await this.itemRepo.update(itemId, { status: 'cancelled' });
    const cancelledTotal = Number(item.total_price);

    await this.orderRepo.update(orderId, {
      subtotal: Math.max(0, Number(order.subtotal) - cancelledTotal),
      total: Math.max(0, Number(order.total) - cancelledTotal),
    });

    const updated = await this.findById(orderId, tenantId);
    this.eventsGateway.emitToTenant(tenantId, 'order.updated', updated);
    return updated;
  }

  // ─── AKTİF SİPARİŞLER (MUTFAK) ───────────────────────────
  async getActiveOrdersForKitchen(branchId: string) {
    return this.orderRepo.createQueryBuilder('o')
      .leftJoinAndSelect('o.items', 'items')
      .where('o.branch_id = :branchId', { branchId })
      .andWhere('o.status IN (:...statuses)', { statuses: ['pending', 'confirmed', 'preparing'] })
      .orderBy('o.created_at', 'ASC')
      .getMany();
  }
}
