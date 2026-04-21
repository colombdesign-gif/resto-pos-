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

  // Mutfaktaki aktif siparişler
  // FIX: tenantId filtresi eklendi
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
      WHERE o.branch_id = $1
        AND o.status IN ('pending', 'confirmed', 'preparing')
        AND oi.status NOT IN ('served', 'cancelled')
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

    query += ` GROUP BY o.id, o.order_number, o.type, o.status, o.table_id, o.customer_note, o.kitchen_note, o.created_at, t.name
               ORDER BY o.created_at ASC`;

    return this.dataSource.query(query, params);
  }

  // Ürün durumunu güncelle (Mutfak hazır işareti)
  // FIX: tenant doğrulaması eklendi
  async updateItemStatus(itemId: string, status: string, tenantId: string) {
    const item = await this.itemRepo.findOne({ where: { id: itemId } });
    if (!item) throw new NotFoundException('Ürün bulunamadı');

    // Tenant doğrulaması: item'ın order'ı tenant'a ait mi?
    const order = await this.orderRepo.findOne({
      where: { id: item.order_id, tenant_id: tenantId },
      relations: ['items'],
    });
    if (!order) throw new NotFoundException('Sipariş bulunamadı');

    await this.itemRepo.update(itemId, { status });

    // Tüm ürünler hazırsa sipariş durumunu "ready" yap
    const activeItems = order.items.filter((i) => i.status !== 'cancelled');
    const allReady = activeItems.every(
      (i) => i.id === itemId ? status === 'ready' || status === 'served' : i.status === 'ready' || i.status === 'served'
    );

    if (allReady && order.status === 'preparing') {
      await this.orderRepo.update(order.id, { status: 'ready' });
      this.eventsGateway.emitToTenant(tenantId, 'order.status_changed', {
        ...order,
        status: 'ready',
      });
    }

    this.eventsGateway.emitToTenant(tenantId, 'order.item_status_changed', {
      orderId: item.order_id,
      itemId,
      status,
    });

    return { itemId, status };
  }

  // Sipariş durumunu "preparing" yap (mutfak onayladı)
  // FIX: tenant doğrulaması eklendi
  async startPreparing(orderId: string, tenantId: string) {
    // Siparişin tenant'a ait olduğunu doğrula
    const existing = await this.orderRepo.findOne({
      where: { id: orderId, tenant_id: tenantId },
    });
    if (!existing) throw new NotFoundException('Sipariş bulunamadı');

    await this.orderRepo.update(orderId, { status: 'preparing' });
    await this.itemRepo.update({ order_id: orderId, status: 'pending' }, { status: 'preparing' });

    const order = await this.orderRepo.findOne({
      where: { id: orderId },
      relations: ['items'],
    });

    this.eventsGateway.emitToTenant(tenantId, 'order.status_changed', order);
    return order;
  }
}
