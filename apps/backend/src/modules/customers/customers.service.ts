import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('customers')
export class Customer {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() tenant_id: string;
  @Column() name: string;
  @Column({ nullable: true }) phone: string;
  @Column({ nullable: true }) email: string;
  @Column({ nullable: true, type: 'text' }) address: string;
  @Column({ nullable: true }) city: string;
  @Column({ nullable: true }) district: string;
  @Column({ default: 0 }) loyalty_points: number;
  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 }) total_spent: number;
  @Column({ default: 0 }) total_orders: number;
  @Column({ nullable: true, type: 'text' }) notes: string;
  @Column({ nullable: true, type: 'date' }) birthday: Date;
  @Column({ default: true }) is_active: boolean;
  @CreateDateColumn() created_at: Date;
  @UpdateDateColumn() updated_at: Date;
}

@Injectable()
export class CustomersService {
  constructor(
    @InjectRepository(Customer)
    private readonly customerRepo: Repository<Customer>,
    private readonly dataSource: DataSource,
  ) {}

  findAll(tenantId: string, search?: string) {
    const qb = this.customerRepo.createQueryBuilder('c')
      .where('c.tenant_id = :tenantId', { tenantId })
      .andWhere('c.is_active = true')
      .orderBy('c.name', 'ASC');

    if (search) {
      qb.andWhere('(c.name ILIKE :s OR c.phone ILIKE :s OR c.email ILIKE :s)', { s: `%${search}%` });
    }
    return qb.getMany();
  }

  async findById(id: string, tenantId: string) {
    const customer = await this.customerRepo.findOne({ where: { id, tenant_id: tenantId } });
    if (!customer) throw new NotFoundException('Müşteri bulunamadı');

    const orders = await this.dataSource.query(
      `SELECT id, order_number, type, status, total, created_at FROM orders
       WHERE customer_id = $1 ORDER BY created_at DESC LIMIT 20`,
      [id],
    );

    return { ...customer, recentOrders: orders };
  }

  create(tenantId: string, data: Partial<Customer>) {
    const customer = this.customerRepo.create({ ...data, tenant_id: tenantId });
    return this.customerRepo.save(customer);
  }

  async update(id: string, tenantId: string, data: Partial<Customer>) {
    await this.findById(id, tenantId);
    await this.customerRepo.update({ id, tenant_id: tenantId }, data);
    return this.findById(id, tenantId);
  }

  async adjustLoyalty(id: string, tenantId: string, points: number, type: 'earn' | 'spend' | 'adjust', orderId?: string) {
    const customer = await this.customerRepo.findOne({ where: { id, tenant_id: tenantId } });
    if (!customer) throw new NotFoundException('Müşteri bulunamadı');

    const newBalance = type === 'spend'
      ? Math.max(0, customer.loyalty_points - points)
      : customer.loyalty_points + points;

    await this.customerRepo.update(id, { loyalty_points: newBalance });

    await this.dataSource.query(
      `INSERT INTO loyalty_transactions (customer_id, tenant_id, order_id, type, points, balance_after)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [id, tenantId, orderId || null, type, points, newBalance],
    );

    return { customerId: id, previousPoints: customer.loyalty_points, newBalance, change: points };
  }

  getLoyaltyHistory(customerId: string) {
    return this.dataSource.query(
      `SELECT * FROM loyalty_transactions WHERE customer_id = $1 ORDER BY created_at DESC LIMIT 50`,
      [customerId],
    );
  }
}
