import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Order, OrderItem } from '../orders/entities/order.entity';
import { EventsGateway } from '../../websocket/events.gateway';

@Injectable()
export class KitchenService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    @InjectRepository(OrderItem)
    private readonly itemRepo: Repository<OrderItem>,
    private readonly eventsGateway: EventsGateway,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Mutfaktaki aktif siparişler
   * - order_items: pending / preparing / ready olanlar gösterilir
   *   (delivered / served / cancelled gizlenir — bunlar teslim edilmiş)
   * - orders: pending / confirmed / preparing / ready durumundakiler
   *   (delivered/closed olanlar mutfaktan düşer)
   */
  async getKitchenOrders(branchId: string, stationId?: string, tenantId?: string) {
    let query = `
      SELECT 
        o.id, o.order_number, o.type, o.status, o.table_id,
        o.customer_note, o.kitchen_note, o.created_at,
        t.name as table_name,
        json_agg(
          json_build_object(
            'id', oi.id,
            'product_id', oi.product_id,
            'quantity', oi.quantity,
            'status', oi.status,
            'notes', oi.notes,
            'modifiers', oi.modifiers,
            'station_id', oi.station_id,
            'product_name', p.name,
            'created_at', oi.created_at
          ) ORDER BY oi.created_at ASC
        ) as items
      FROM orders o
      LEFT JOIN tables t ON t.id = o.table_id
      LEFT JOIN order_items oi ON oi.order_id = o.id
      LEFT JOIN products p ON p.id = oi.product_id
      WHERE ($1::uuid IS NULL OR o.branch_id = $1)
        AND o.status IN ('pending', 'confirmed', 'preparing', 'ready')
        AND oi.status NOT IN ('delivered', 'served', 'cancelled')
    `;

    const params: any[] = [branchId];
    let paramIdx = 2;

    if (tenantId) {
      query += ` AND o.tenant_id = $${paramIdx}`;
      params.push(tenantId);
      paramIdx++;
    }

    if (stationId) {
      query += ` AND oi.station_id = $${paramIdx}`;
      params.push(stationId);
    }

    query += ` GROUP BY o.id, o.order_number, o.type, o.status, o.table_id,
               o.customer_note, o.kitchen_note, o.created_at, t.name
               HAVING COUNT(oi.id) FILTER (WHERE oi.status NOT IN ('delivered', 'served', 'cancelled')) > 0
               ORDER BY o.created_at ASC`;

    return this.dataSource.query(query, params);
  }

  /**
   * Mutfak ekranından ürün durumu güncelle (Mutfak → hazır işareti)
   * order_items.status: pending|preparing|ready|served|delivered|cancelled
   */
  async updateItemStatus(itemId: string, status: string, tenantId: string) {
    const item = await this.itemRepo.findOne({ where: { id: itemId } });
    if (!item) throw new NotFoundException('Ürün bulunamadı');

    // Tenant doğrulaması
    const order = await this.orderRepo.findOne({
      where: { id: item.order_id, tenant_id: tenantId },
      relations: ['items'],
    });
    if (!order) throw new NotFoundException('Sipariş bulunamadı veya yetki yok');

    await this.itemRepo.update(itemId, { status });

    // Tüm aktif ürünler hazırsa → sipariş durumunu 'ready' yap
    // Tüm aktif ürünler teslim/iptal → sipariş 'delivered'
    const activeItems = order.items.filter((i) => i.status !== 'cancelled');
    
    const effectiveStatus = (i: OrderItem) => i.id === itemId ? status : i.status;
    
    const allDone = activeItems.every(
      (i) => ['delivered', 'served', 'cancelled'].includes(effectiveStatus(i)),
    );
    const allReady = activeItems.every(
      (i) => ['ready', 'delivered', 'served', 'cancelled'].includes(effectiveStatus(i)),
    );

    if (allDone) {
      // Tüm ürünler bitti (teslim/iptal)
      const nonCancelledCount = activeItems.filter(i => ['delivered', 'served'].includes(effectiveStatus(i))).length;
      const newStatus = nonCancelledCount > 0 ? 'delivered' : 'cancelled';
      
      await this.orderRepo.update(order.id, { status: newStatus });
      this.eventsGateway.emitToTenant(tenantId, 'order.status_changed', {
        ...order, status: newStatus,
      });
      // Mutfağa bildir (KDS yenilensin)
      this.eventsGateway.emitToKitchen(order.branch_id, 'kitchen.order_updated', {
        ...order, status: newStatus,
      });
    } else if (allReady && order.status === 'preparing') {
      // Tüm ürünler hazır, henüz teslim edilmedi → order 'ready'
      await this.orderRepo.update(order.id, { status: 'ready' });
      this.eventsGateway.emitToTenant(tenantId, 'order.status_changed', {
        ...order, status: 'ready',
      });
      // Mutfağa bildir
      this.eventsGateway.emitToKitchen(order.branch_id, 'kitchen.order_updated', {
        ...order, status: 'ready',
      });
    }

    // Güncel full order'ı WebSocket ile dağıt
    const updatedOrder = await this.orderRepo.findOne({
      where: { id: order.id },
      relations: ['items'],
    });
    this.eventsGateway.emitToTenant(tenantId, 'order.updated', updatedOrder);
    this.eventsGateway.emitToTenant(tenantId, 'order.item_status_changed', {
      orderId: item.order_id,
      itemId,
      status,
    });

    return { itemId, status, orderId: item.order_id };
  }

  /**
   * Sipariş durumunu "preparing" yap (mutfak onayladı)
   */
  async startPreparing(orderId: string, tenantId: string) {
    const existing = await this.orderRepo.findOne({
      where: { id: orderId, tenant_id: tenantId },
    });
    if (!existing) throw new NotFoundException('Sipariş bulunamadı');

    await this.orderRepo.update(orderId, { status: 'preparing' });
    await this.itemRepo.update(
      { order_id: orderId, status: 'pending' },
      { status: 'preparing' },
    );

    const order = await this.orderRepo.findOne({
      where: { id: orderId },
      relations: ['items'],
    });

    this.eventsGateway.emitToTenant(tenantId, 'order.status_changed', order);
    return order;
  }
}
