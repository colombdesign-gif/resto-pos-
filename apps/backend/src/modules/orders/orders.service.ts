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

  // ─── AKTİF MASA SİPARİŞİ (FIX: tüm aktif durumları ara) ──
  async findActiveByTable(tableId: string) {
    // Tüm "açık" durumları kontrol et — sadece pending/preparing değil
    const activeStatuses = ['pending', 'confirmed', 'preparing', 'ready'];
    return this.orderRepo.findOne({
      where: activeStatuses.map(s => ({ table_id: tableId, status: s })),
      relations: ['items'],
      order: { created_at: 'DESC' },
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
      // 1. Sipariş numarası al — FOR UPDATE ile race condition engelle
      const numResult = await queryRunner.query(
        `SELECT COALESCE(MAX(order_number), 999) + 1 AS next 
         FROM orders 
         WHERE branch_id = $1 
         FOR UPDATE`,
        [data.branch_id],
      );
      const orderNumber = numResult[0].next;

      // 2. Tutarları hesapla
      let subtotal = 0;
      let taxTotal = 0;
      const itemsData: any[] = [];

      for (const item of data.items) {
        const itemTotal = Number(item.unit_price) * item.quantity;
        subtotal += itemTotal;
        const [productRow] = await queryRunner.query(
          `SELECT tax_rate, station_id FROM products WHERE id = $1`,
          [item.product_id],
        );
        const taxRate = productRow?.tax_rate || 8;
        taxTotal += (itemTotal * taxRate) / (100 + taxRate);
        itemsData.push({
          ...item,
          station_id: item.station_id || productRow?.station_id,
          total_price: itemTotal,
        });
      }

      // 3. Siparişi kaydet
      const [orderRow] = await queryRunner.query(
        `INSERT INTO orders 
          (tenant_id, branch_id, table_id, order_number, type, status, waiter_id,
           customer_id, customer_name, customer_phone, customer_note, source,
           subtotal, tax_total, total)
         VALUES ($1,$2,$3,$4,$5,'pending',$6,$7,$8,$9,$10,$11,$12,$13,$14)
         RETURNING *`,
        [
          tenantId, data.branch_id, data.table_id || null, orderNumber,
          data.type || 'dine_in', data.waiter_id || null,
          data.customer_id || null, data.customer_name || null,
          data.customer_phone || null, data.customer_note || null,
          data.source || 'pos', subtotal, taxTotal, subtotal,
        ],
      );

      // 4. Ürünleri kaydet + stok düşümü
      for (const item of itemsData) {
        await queryRunner.query(
          `INSERT INTO order_items 
            (order_id, product_id, station_id, quantity, unit_price, total_price, status, notes, modifiers)
           VALUES ($1,$2,$3,$4,$5,$6,'pending',$7,$8)`,
          [
            orderRow.id, item.product_id, item.station_id || null,
            item.quantity, item.unit_price, item.total_price,
            item.notes || null, JSON.stringify(item.modifiers || []),
          ],
        );

        // STOK DÜŞÜMÜ (Atomic — reçete varsa düşer, yoksa skip)
        await this.inventoryService.deductStockByRecipe(
          item.product_id, item.quantity, tenantId, orderRow.id, queryRunner.manager,
        );
      }

      // 5. Masayı occupied yap
      if (data.table_id) {
        await queryRunner.query(
          `UPDATE tables SET status = 'occupied' WHERE id = $1`,
          [data.table_id],
        );
      }

      await queryRunner.commitTransaction();

      const fullOrder = await this.findById(orderRow.id, tenantId);
      this.eventsGateway.emitToTenant(tenantId, 'order.created', fullOrder);
      this.eventsGateway.emitToKitchen(data.branch_id, 'kitchen.new_order', fullOrder);
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
      if (['closed', 'cancelled'].includes(order.status)) {
        throw new BadRequestException('Kapalı siparişe ürün eklenemez');
      }

      let addedSubtotal = 0;
      for (const item of items) {
        const itemTotal = Number(item.unit_price) * item.quantity;
        addedSubtotal += itemTotal;

        await queryRunner.query(
          `INSERT INTO order_items 
            (order_id, product_id, station_id, quantity, unit_price, total_price, status, notes, modifiers)
           VALUES ($1,$2,$3,$4,$5,$6,'pending',$7,$8)`,
          [
            orderId, item.product_id, item.station_id || null,
            item.quantity, item.unit_price, itemTotal,
            item.notes || null, JSON.stringify(item.modifiers || []),
          ],
        );

        await this.inventoryService.deductStockByRecipe(
          item.product_id, item.quantity, tenantId, orderId, queryRunner.manager,
        );
      }

      await queryRunner.query(
        `UPDATE orders SET subtotal = subtotal + $1, total = total + $1 WHERE id = $2`,
        [addedSubtotal, orderId],
      );

      await queryRunner.commitTransaction();

      const updated = await this.findById(orderId, tenantId);
      this.eventsGateway.emitToTenant(tenantId, 'order.updated', updated);
      this.eventsGateway.emitToKitchen(order.branch_id, 'kitchen.new_items', {
        orderId,
        items: updated.items.filter(i => i.status === 'pending'),
      });
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

    // FIX: Ödenmemiş sipariş kapatılamaz
    if (status === 'closed') {
      const remaining = Number(order.total) - Number(order.paid_amount);
      if (remaining > 0.01) {
        throw new BadRequestException(
          `Ödeme tamamlanmadan sipariş kapatılamaz. Kalan: ₺${remaining.toFixed(2)}`,
        );
      }
    }

    // İptal durumunda stok iadesi
    if (status === 'cancelled' && order.status !== 'cancelled') {
      for (const item of order.items) {
        if (item.status !== 'cancelled') {
          await this.inventoryService.returnStockByRecipe(
            item.product_id, item.quantity, tenantId, id,
          );
        }
      }
    }

    const updates: any = { status };
    if (status === 'closed') {
      updates.closed_at = new Date();
      if (order.table_id) {
        await this.dataSource.query(
          `UPDATE tables SET status = 'available' WHERE id = $1`,
          [order.table_id],
        );
        this.eventsGateway.emitToTenant(tenantId, 'table.status_changed', {
          id: order.table_id, status: 'available',
        });
      }
    }

    await this.orderRepo.update(id, updates);
    const updated = await this.findById(id, tenantId);
    this.eventsGateway.emitToTenant(tenantId, 'order.status_changed', updated);
    return updated;
  }

  // ─── ÜRÜN İPTAL (FIX: Transaction ile) ─────────────────────
  async cancelItem(orderId: string, itemId: string, tenantId: string) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const order = await this.findById(orderId, tenantId);
      const item = order.items.find((i) => i.id === itemId);
      if (!item) throw new NotFoundException('Ürün bulunamadı');
      if (item.status === 'cancelled') return order;

      // STOK İADESİ (atomic)
      await this.inventoryService.returnStockByRecipe(
        item.product_id, item.quantity, tenantId, orderId, queryRunner.manager,
      );

      await queryRunner.query(
        `UPDATE order_items SET status = 'cancelled', updated_at = NOW() WHERE id = $1`,
        [itemId],
      );

      const cancelledTotal = Number(item.total_price);
      await queryRunner.query(
        `UPDATE orders SET 
          subtotal = GREATEST(0, subtotal - $1), 
          total = GREATEST(0, total - $1),
          updated_at = NOW()
         WHERE id = $2`,
        [cancelledTotal, orderId],
      );

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

  // ─── AKTİF SİPARİŞLER (MUTFAK) ───────────────────────────
  async getActiveOrdersForKitchen(branchId: string, tenantId?: string) {
    const qb = this.orderRepo.createQueryBuilder('o')
      .leftJoinAndSelect('o.items', 'items')
      .where('o.branch_id = :branchId', { branchId })
      .andWhere('o.status IN (:...statuses)', {
        statuses: ['pending', 'confirmed', 'preparing'],
      })
      .orderBy('o.created_at', 'ASC');

    if (tenantId) {
      qb.andWhere('o.tenant_id = :tenantId', { tenantId });
    }

    return qb.getMany();
  }
}

