import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Branch } from '../../branches/entities/branch.entity';

@Entity('tables')
export class Table {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  branch_id: string;

  @ManyToOne(() => Branch)
  @JoinColumn({ name: 'branch_id' })
  branch: Branch;

  @Column({ nullable: true })
  floor_plan_id: string;

  @Column()
  name: string;

  @Column({ default: 4 })
  capacity: number;

  @Column({ default: 'available' })
  status: string; // available | occupied | reserved | cleaning

  @Column({ default: 100 })
  position_x: number;

  @Column({ default: 100 })
  position_y: number;

  @Column({ default: 100 })
  width: number;

  @Column({ default: 80 })
  height: number;

  @Column({ default: 'rectangle' })
  shape: string;

  @Column({ nullable: true })
  qr_code: string;

  @Column({ type: 'jsonb', default: [] })
  merged_with: string[];

  @Column({ default: true })
  is_active: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
