import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Order, OrderItem } from './entities/order.entity';
import { EventsGateway } from '../../websocket/events.gateway';

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    @InjectRepository(OrderItem)
    private readonly itemRepo: Repository<OrderItem>,
    private readonly dataSource: DataSource,
    private readonly eventsGateway: EventsGateway,
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
  async create(tenantId: string, data: {
    branch_id: string;
    table_id?: string;
    type: string;
    waiter_id?: string;
    customer_id?: string;
    customer_name?: string;
    customer_phone?: string;
    customer_note?: string;
    source?: string;
    items: {
      product_id: string;
      station_id?: string;
      quantity: number;
      unit_price: number;
      notes?: string;
      modifiers?: any[];
    }[];
  }) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Sipariş numarası al
      const numResult = await queryRunner.query(
        `SELECT COALESCE(MAX(order_number), 999) + 1 AS next FROM orders WHERE branch_id = $1`,
        [data.branch_id],
      );
      const orderNumber = numResult[0].next;

      // Tutarları hesapla
      let subtotal = 0;
      let taxTotal = 0;
      const itemsData = [];

      for (const item of data.items) {
        const itemTotal = Number(item.unit_price) * item.quantity;
        subtotal += itemTotal;

        // Ürün vergi oranını çek
        const [productRow] = await queryRunner.query(
          `SELECT tax_rate, station_id FROM products WHERE id = $1`,
          [item.product_id],
        );
        const taxRate = productRow?.tax_rate || 8;
        const itemTax = (itemTotal * taxRate) / (100 + taxRate);
        taxTotal += itemTax;

        itemsData.push({
          ...item,
          station_id: item.station_id || productRow?.station_id,
          total_price: itemTotal,
          status: 'pending',
          modifiers: item.modifiers || [],
        });
      }

      const total = subtotal;

      // Siparişi oluştur
      const [orderRow] = await queryRunner.query(
        `INSERT INTO orders 
          (tenant_id, branch_id, table_id, order_number, type, status, waiter_id,
           customer_id, customer_name, customer_phone, customer_note, source,
           subtotal, tax_total, total)
         VALUES ($1,$2,$3,$4,$5,'pending',$6,$7,$8,$9,$10,$11,$12,$13,$14)
         RETURNING *`,
        [
          tenantId, data.branch_id, data.table_id || null, orderNumber,
          data.type, data.waiter_id || null,
          data.customer_id || null, data.customer_name || null,
          data.customer_phone || null, data.customer_note || null,
          data.source || 'pos', subtotal, taxTotal, total,
        ],
      );

      // Ürünleri kaydet
      for (const item of itemsData) {
        await queryRunner.query(
          `INSERT INTO order_items 
            (order_id, product_id, station_id, quantity, unit_price, total_price, status, notes, modifiers)
           VALUES ($1,$2,$3,$4,$5,$6,'pending',$7,$8)`,
          [
            orderRow.id, item.product_id, item.station_id, item.quantity,
            item.unit_price, item.total_price, item.notes || null,
            JSON.stringify(item.modifiers),
          ],
        );
      }

      // Masa durumunu "occupied" yap
      if (data.table_id) {
        await queryRunner.query(
          `UPDATE tables SET status = 'occupied' WHERE id = $1`,
          [data.table_id],
        );
      }

      await queryRunner.commitTransaction();

      // Tam siparişi yükle
      const fullOrder = await this.findById(orderRow.id, tenantId);

      // Gerçek zamanlı bildirim → tüm istemciler
      this.eventsGateway.emitToTenant(tenantId, 'order.created', fullOrder);
      // Mutfak ekranına özel bildirim
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
    const order = await this.findById(orderId, tenantId);
    if (['closed', 'cancelled'].includes(order.status)) {
      throw new BadRequestException('Kapalı siparişe ürün eklenemez');
    }

    let addedSubtotal = 0;
    for (const item of items) {
      const itemTotal = Number(item.unit_price) * item.quantity;
      addedSubtotal += itemTotal;

      const newItem = this.itemRepo.create({
        order_id: orderId,
        product_id: item.product_id,
        station_id: item.station_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total_price: itemTotal,
        notes: item.notes,
        modifiers: item.modifiers || [],
        status: 'pending',
      });
      await this.itemRepo.save(newItem);
    }

    // Toplam güncelle
    await this.orderRepo.update(orderId, {
      subtotal: Number(order.subtotal) + addedSubtotal,
      total: Number(order.total) + addedSubtotal,
    });

    const updated = await this.findById(orderId, tenantId);
    this.eventsGateway.emitToTenant(tenantId, 'order.updated', updated);
    this.eventsGateway.emitToKitchen(order.branch_id, 'kitchen.new_items', {
      orderId,
      items: updated.items.filter((i) => i.status === 'pending'),
    });

    return updated;
  }

  // ─── SİPARİŞ DURUMU GÜNCELLE ─────────────────────────────
  async updateStatus(id: string, tenantId: string, status: string) {
    const order = await this.findById(id, tenantId);

    const updates: any = { status };
    if (status === 'closed') {
      updates.closed_at = new Date();
      // Masayı serbest bırak
      if (order.table_id) {
        await this.dataSource.query(
          `UPDATE tables SET status = 'available' WHERE id = $1`,
          [order.table_id],
        );
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
  async getActiveOrdersForKitchen(branchId: string, stationId?: string) {
    const qb = this.orderRepo.createQueryBuilder('o')
      .leftJoinAndSelect('o.items', 'items')
      .where('o.branch_id = :branchId', { branchId })
      .andWhere('o.status IN (:...statuses)', { statuses: ['pending', 'confirmed', 'preparing'] })
      .orderBy('o.created_at', 'ASC');

    if (stationId) {
      qb.andWhere('items.station_id = :stationId', { stationId });
    }

    return qb.getMany();
  }
}
