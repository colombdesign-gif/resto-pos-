import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Order, OrderItem } from './entities/order.entity';
import { EventsGateway } from '../../websocket/events.gateway';
import { InventoryService } from '../inventory/inventory.service';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

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
    // DB CHECK: orders.status IN ('pending','confirmed','preparing','ready','delivered','cancelled','closed')
    // 'served' DB'de YOK — 'delivered' tüm ürünler teslim edildi, ödeme bekleniyor
    const activeStatuses = ['pending', 'confirmed', 'preparing', 'ready', 'delivered'];
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
    this.logger.log(`Yeni sipariş isteği - Tenant: ${tenantId}, Data: ${JSON.stringify(data)}`);

    if (!tenantId) {
      throw new BadRequestException('İşletme kimliği (tenantId) eksik');
    }

    if (!data.branch_id || data.branch_id === '') {
      throw new BadRequestException('Şube bilgisi eksik (branch_id required)');
    }

    if (!data.items || !Array.isArray(data.items) || data.items.length === 0) {
      throw new BadRequestException('Sipariş içeriği boş olamaz');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Sipariş numarası al
      const numResult = await queryRunner.query(
        `SELECT COALESCE(MAX(order_number), 999) + 1 AS next 
         FROM orders 
         WHERE branch_id = $1`,
        [data.branch_id],
      );
      const orderNumber = numResult[0]?.next || 1000;

      // 2. Tutarları hesapla
      let subtotal = 0;
      let taxTotal = 0;
      const itemsData: any[] = [];

      for (const item of data.items) {
        const qty = Number(item.quantity) || 1;
        const price = Number(item.unit_price) || 0;
        const itemTotal = price * qty;
        
        subtotal += itemTotal;
        
        const products = await queryRunner.query(
          `SELECT tax_rate, station_id FROM products WHERE id = $1`,
          [item.product_id],
        );
        const productRow = products[0];
        
        const taxRate = Number(productRow?.tax_rate || 8);
        taxTotal += (itemTotal * taxRate) / (100 + taxRate);
        
        itemsData.push({
          ...item,
          quantity: qty,
          unit_price: price,
          station_id: item.station_id || productRow?.station_id || null,
          total_price: itemTotal,
        });
      }

      // 3. Siparişi kaydet (UUID alanlarını temizle)
      const sanitizedTableId = data.table_id === '' ? null : (data.table_id || null);
      const sanitizedWaiterId = data.waiter_id === '' ? null : (data.waiter_id || null);
      const sanitizedCustomerId = data.customer_id === '' ? null : (data.customer_id || null);

      const insertResult = await queryRunner.query(
        `INSERT INTO orders 
          (tenant_id, branch_id, table_id, order_number, type, status, waiter_id,
           customer_id, customer_name, customer_phone, customer_note, source,
           subtotal, tax_total, total)
         VALUES ($1,$2,$3,$4,$5,'pending',$6,$7,$8,$9,$10,$11,$12,$13,$14)
         RETURNING *`,
        [
          tenantId, 
          data.branch_id, 
          sanitizedTableId, 
          orderNumber,
          data.type || 'dine_in', 
          sanitizedWaiterId,
          sanitizedCustomerId, 
          data.customer_name || null,
          data.customer_phone || null, 
          data.customer_note || null,
          data.source || 'pos', 
          subtotal, 
          taxTotal, 
          subtotal,
        ],
      );
      
      const orderRow = insertResult[0];
      if (!orderRow) throw new Error('Sipariş kaydı oluşturulamadı (RETURNING empty)');

      // 4. Ürünleri kaydet + stok düşümü
      for (const item of itemsData) {
        await queryRunner.query(
          `INSERT INTO order_items 
            (order_id, product_id, station_id, quantity, unit_price, total_price, status, notes, modifiers)
           VALUES ($1,$2,$3,$4,$5,$6,'pending',$7,$8)`,
          [
            orderRow.id, 
            item.product_id, 
            item.station_id,
            item.quantity, 
            item.unit_price, 
            item.total_price,
            item.notes || null, 
            JSON.stringify(item.modifiers || []),
          ],
        );

        // STOK DÜŞÜMÜ
        await this.inventoryService.deductStockByRecipe(
          item.product_id, item.quantity, tenantId, orderRow.id, queryRunner.manager,
        );
      }

      // 5. Masayı occupied yap
      if (sanitizedTableId) {
        await queryRunner.query(
          `UPDATE tables SET status = 'occupied' WHERE id = $1`,
          [sanitizedTableId],
        );
      }

      await queryRunner.commitTransaction();

      const fullOrder = await this.findById(orderRow.id, tenantId);
      this.eventsGateway.emitToTenant(tenantId, 'order.created', fullOrder);
      this.eventsGateway.emitToKitchen(data.branch_id, 'kitchen.new_order', fullOrder);
      return fullOrder;
    } catch (err: any) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Sipariş oluşturma hatası: ${err.message}`, err.stack);
      
      if (err.code === '23502') {
        throw new BadRequestException(`Zorunlu alan eksik: ${err.column}`);
      }
      if (err.code === '22P02') {
        throw new BadRequestException('Geçersiz veri formatı (UUID hatası)');
      }
      if (err.status === 400) throw err; // BadRequestException ise aynen fırlat
      
      throw new Error(`Sipariş oluşturulamadı: ${err.message}`);
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
    if (status === 'closed' || status === 'cancelled') {
      if (status === 'closed') updates.closed_at = new Date();
      
      // Sipariş iptalinde tüm ürünleri de iptal et
      if (status === 'cancelled') {
        await this.dataSource.query(
          `UPDATE order_items SET status = 'cancelled' WHERE order_id = $1 AND status != 'cancelled'`,
          [id]
        );
      }

      if (order.table_id) {
        // Kontrol: Masada başka aktif sipariş var mı?
        const otherActiveOrders = await this.dataSource.query(
          `SELECT id FROM orders WHERE table_id = $1 AND status NOT IN ('closed', 'cancelled') AND id != $2 LIMIT 1`,
          [order.table_id, id],
        );

        if (otherActiveOrders.length === 0) {
          await this.dataSource.query(
            `UPDATE tables SET status = 'available' WHERE id = $1`,
            [order.table_id],
          );
          this.eventsGateway.emitToTenant(tenantId, 'table.status_changed', {
            id: order.table_id, status: 'available',
          });
        }
      }
    }

    await this.orderRepo.update(id, updates);
    const updated = await this.findById(id, tenantId);
    
    // Mutfağa bildir (KDS ekranı güncellensin)
    this.eventsGateway.emitToKitchen(updated.branch_id, 'kitchen.order_updated', updated);
    this.eventsGateway.emitToTenant(tenantId, 'order.status_changed', updated);
    return updated;
  }

  // ─── ÜRÜN DURUMU GÜNCELLEME (Masa/Garson) ─────────────────
  async updateItemStatus(orderId: string, itemId: string, tenantId: string, status: string) {
    // Geçerli item statüleri (order_items CHECK): pending|preparing|ready|served|delivered|cancelled
    if (!['pending', 'preparing', 'ready', 'delivered', 'served'].includes(status)) {
      throw new BadRequestException('Geçersiz sipariş kalemi durumu');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Ürün durumunu güncelle
      await queryRunner.query(
        `UPDATE order_items SET status = $1, updated_at = NOW() WHERE id = $2 AND order_id = $3`,
        [status, itemId, orderId],
      );

      // 2. Tüm ürünler delivered/served/cancelled mi? → Order 'delivered' yap
      // KRİTİK: orders tablosunda 'served' YOK (DB CHECK kısıtı ihlali → 500 hatası)
      // orders.status için SADECE: pending|confirmed|preparing|ready|delivered|cancelled|closed
      if (status === 'delivered' || status === 'served') {
        const remaining = await queryRunner.query(
          `SELECT COUNT(*) AS cnt FROM order_items
           WHERE order_id = $1 AND status NOT IN ('delivered', 'served', 'cancelled')`,
          [orderId],
        );
        const openCount = Number(remaining[0]?.cnt ?? 1);

        if (openCount === 0) {
          // Tüm ürünler teslim edildi → order 'delivered' (ödeme bekleniyor, masa hâlâ dolu)
          await queryRunner.query(
            `UPDATE orders SET status = 'delivered', updated_at = NOW()
             WHERE id = $1 AND status NOT IN ('closed', 'cancelled')`,
            [orderId],
          );
        } else {
          // Kısmi teslim — order en azından 'preparing' olsun
          await queryRunner.query(
            `UPDATE orders SET status = 'preparing', updated_at = NOW()
             WHERE id = $1 AND status = 'pending'`,
            [orderId],
          );
        }
      }

      await queryRunner.commitTransaction();

      const updated = await this.findById(orderId, tenantId);
      this.eventsGateway.emitToTenant(tenantId, 'order.updated', updated);
      this.eventsGateway.emitToKitchen(updated.branch_id, 'kitchen.order_updated', updated);
      return updated;
    } catch (err) {
      this.logger.error(`updateItemStatus hatası: ${err.message}`, err.stack);
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  // ─── ÜRÜN İPTAL (FIX: Transaction ile) ─────────────────────
  async cancelItem(orderId: string, itemId: string, tenantId: string, reason?: string, waiterId?: string) {
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

      // Audit kaydını oluştur
      if (reason) {
        // İptal notu olarak da order_items'a kaydet 
        await queryRunner.query(
          `UPDATE order_items SET notes = CONCAT(notes, ' [İptal Sebebi: ', $1::text, ']') WHERE id = $2`,
          [reason, itemId]
        );
        
        await queryRunner.query(
          `INSERT INTO audit_logs (tenant_id, user_id, action, resource, resource_id, metadata)
           VALUES ($1, $2, 'order_item_cancelled', 'order_item', $3, $4)`,
          [
             tenantId,
             waiterId || null,
             itemId,
             JSON.stringify({ reason, orderId, cancelledTotal, productId: item.product_id })
          ]
        );
      }

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

