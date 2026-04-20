import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';

@Entity('orders')
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  tenant_id: string;

  @Column()
  branch_id: string;

  @Column({ nullable: true })
  table_id: string;

  @Column({ default: 0 })
  order_number: number;

  @Column({ default: 'dine_in' })
  type: string; // dine_in | takeaway | delivery | qr

  @Column({ default: 'pending' })
  status: string; // pending | confirmed | preparing | ready | delivered | cancelled | closed

  @Column({ nullable: true })
  waiter_id: string;

  @Column({ nullable: true })
  customer_id: string;

  @Column({ nullable: true })
  customer_name: string;

  @Column({ nullable: true })
  customer_phone: string;

  @Column({ nullable: true, type: 'text' })
  customer_note: string;

  @Column({ nullable: true, type: 'text' })
  kitchen_note: string;

  @Column({ type: 'numeric', precision: 10, scale: 2, default: 0 })
  subtotal: number;

  @Column({ type: 'numeric', precision: 10, scale: 2, default: 0 })
  tax_total: number;

  @Column({ type: 'numeric', precision: 10, scale: 2, default: 0 })
  discount_total: number;

  @Column({ type: 'numeric', precision: 10, scale: 2, default: 0 })
  total: number;

  @Column({ type: 'numeric', precision: 10, scale: 2, default: 0 })
  paid_amount: number;

  @Column({ default: 'pos' })
  source: string; // pos | yemeksepeti | getir | trendyol | qr | phone

  @Column({ nullable: true })
  external_id: string;

  @Column({ default: false })
  is_printed: boolean;

  @OneToMany(() => OrderItem, (item) => item.order, { eager: true })
  items: OrderItem[];

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @Column({ nullable: true })
  closed_at: Date;
}

@Entity('order_items')
export class OrderItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  order_id: string;

  @ManyToOne(() => Order, (o) => o.items)
  @JoinColumn({ name: 'order_id' })
  order: Order;

  @Column()
  product_id: string;

  @Column({ nullable: true })
  station_id: string;

  @Column({ default: 1 })
  quantity: number;

  @Column({ type: 'numeric', precision: 10, scale: 2 })
  unit_price: number;

  @Column({ type: 'numeric', precision: 10, scale: 2 })
  total_price: number;

  @Column({ default: 'pending' })
  status: string; // pending | preparing | ready | served | cancelled

  @Column({ nullable: true, type: 'text' })
  notes: string;

  @Column({ type: 'jsonb', default: [] })
  modifiers: any[];

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
