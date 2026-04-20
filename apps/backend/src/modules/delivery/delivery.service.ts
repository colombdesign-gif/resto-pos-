import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { EventsGateway } from '../../websocket/events.gateway';

@Entity('deliveries')
export class Delivery {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() order_id: string;
  @Column() tenant_id: string;
  @Column({ nullable: true }) courier_id: string;
  @Column({ default: 'waiting' }) status: string;
  @Column({ type: 'text' }) address: string;
  @Column({ nullable: true }) city: string;
  @Column({ nullable: true }) district: string;
  @Column({ nullable: true, type: 'decimal', precision: 10, scale: 8 }) lat: number;
  @Column({ nullable: true, type: 'decimal', precision: 11, scale: 8 }) lng: number;
  @Column({ nullable: true, type: 'text' }) notes: string;
  @Column({ nullable: true }) estimated_minutes: number;
  @Column({ nullable: true }) assigned_at: Date;
  @Column({ nullable: true }) delivered_at: Date;
  @CreateDateColumn() created_at: Date;
  @UpdateDateColumn() updated_at: Date;
}

@Injectable()
export class DeliveryService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly eventsGateway: EventsGateway,
  ) {}

  async findAll(tenantId: string, courierId?: string) {
    let query = `
      SELECT d.*, o.order_number, o.total,
             u.name as courier_name
      FROM deliveries d
      JOIN orders o ON o.id = d.order_id
      LEFT JOIN users u ON u.id = d.courier_id
      WHERE d.tenant_id = $1
    `;
    const params = [tenantId];
    if (courierId) {
      query += ` AND d.courier_id = $2`;
      params.push(courierId);
    }
    query += ` ORDER BY d.created_at DESC LIMIT 50`;
    return this.dataSource.query(query, params);
  }

  async createDelivery(tenantId: string, data: Partial<Delivery>) {
    const [result] = await this.dataSource.query(
      `INSERT INTO deliveries (order_id, tenant_id, address, city, district, lat, lng, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [data.order_id, tenantId, data.address, data.city, data.district, data.lat || null, data.lng || null, data.notes || null],
    );
    return result;
  }

  async assignCourier(deliveryId: string, courierId: string, tenantId: string) {
    const [result] = await this.dataSource.query(
      `UPDATE deliveries SET courier_id = $1, status = 'assigned', assigned_at = NOW()
       WHERE id = $2 AND tenant_id = $3 RETURNING *`,
      [courierId, deliveryId, tenantId],
    );
    this.eventsGateway.emitToTenant(tenantId, 'delivery.status_changed', result);
    return result;
  }

  async updateStatus(deliveryId: string, status: string, tenantId: string) {
    const updates: any = { status };
    if (status === 'delivered') updates.delivered_at = new Date();
    if (status === 'on_way') updates.picked_up_at = new Date();

    const [result] = await this.dataSource.query(
      `UPDATE deliveries SET status = $1, updated_at = NOW()
       WHERE id = $2 AND tenant_id = $3 RETURNING *`,
      [status, deliveryId, tenantId],
    );

    if (status === 'delivered') {
      await this.dataSource.query(
        `UPDATE orders SET status = 'delivered' WHERE id = (SELECT order_id FROM deliveries WHERE id = $1)`,
        [deliveryId],
      );
    }

    this.eventsGateway.emitToTenant(tenantId, 'delivery.status_changed', result);
    return result;
  }
}
