import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Tenant } from '../../tenants/entities/tenant.entity';

@Entity('categories')
export class Category {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  tenant_id: string;

  @Column()
  name: string;

  @Column({ default: '🍽️' })
  icon: string;

  @Column({ default: '#6366f1' })
  color: string;

  @Column({ default: 0 })
  sort_order: number;

  @Column({ default: true })
  is_active: boolean;

  @CreateDateColumn()
  created_at: Date;
}

@Entity('stations')
export class Station {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  branch_id: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  printer_ip: string;

  @Column({ default: 9100 })
  printer_port: number;

  @Column({ default: true })
  is_active: boolean;

  @CreateDateColumn()
  created_at: Date;
}

@Entity('products')
export class Product {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  tenant_id: string;

  @Column({ nullable: true })
  station_id: string;

  @Column({ nullable: true })
  category_id: string;

  @Column()
  name: string;

  @Column({ nullable: true, type: 'text' })
  description: string;

  @Column({ type: 'numeric', precision: 10, scale: 2, default: 0 })
  price: number;

  @Column({ type: 'numeric', precision: 5, scale: 2, default: 8.00 })
  tax_rate: number;

  @Column({ nullable: true })
  image_url: string;

  @Column({ nullable: true })
  barcode: string;

  @Column({ default: true })
  is_active: boolean;

  @Column({ default: true })
  is_available: boolean;

  @Column({ default: 10 })
  prep_time_minutes: number;

  @Column({ default: 0 })
  sort_order: number;

  @CreateDateColumn()
  created_at: Date;
}
