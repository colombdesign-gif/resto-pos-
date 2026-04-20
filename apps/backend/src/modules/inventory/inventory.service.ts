import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('ingredients')
export class Ingredient {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() tenant_id: string;
  @Column() name: string;
  @Column({ default: 'adet' }) unit: string;
  @Column({ type: 'numeric', precision: 12, scale: 3, default: 0 }) current_stock: number;
  @Column({ type: 'numeric', precision: 12, scale: 3, default: 0 }) critical_stock: number;
  @Column({ type: 'numeric', precision: 10, scale: 4, default: 0 }) cost_per_unit: number;
  @Column({ nullable: true }) supplier: string;
  @CreateDateColumn() created_at: Date;
  @UpdateDateColumn() updated_at: Date;
}

@Entity('recipes')
export class Recipe {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() product_id: string;
  @Column() ingredient_id: string;
  @Column({ type: 'numeric', precision: 12, scale: 3 }) quantity: number;
}

@Injectable()
export class InventoryService {
  constructor(
    @InjectRepository(Ingredient)
    private readonly ingredientRepo: Repository<Ingredient>,
    @InjectRepository(Recipe)
    private readonly recipeRepo: Repository<Recipe>,
    private readonly dataSource: DataSource,
  ) {}

  // ─── MALZEME CRUD ─────────────────────────────────────────
  findAll(tenantId: string) {
    return this.ingredientRepo.find({
      where: { tenant_id: tenantId },
      order: { name: 'ASC' },
    });
  }

  async findById(id: string, tenantId: string) {
    const item = await this.ingredientRepo.findOne({ where: { id, tenant_id: tenantId } });
    if (!item) throw new NotFoundException('Malzeme bulunamadı');
    return item;
  }

  create(tenantId: string, data: Partial<Ingredient>) {
    const item = this.ingredientRepo.create({ ...data, tenant_id: tenantId });
    return this.ingredientRepo.save(item);
  }

  async update(id: string, tenantId: string, data: Partial<Ingredient>) {
    await this.findById(id, tenantId);
    await this.ingredientRepo.update({ id, tenant_id: tenantId }, data);
    return this.findById(id, tenantId);
  }

  async remove(id: string, tenantId: string) {
    await this.findById(id, tenantId);
    await this.ingredientRepo.delete({ id, tenant_id: tenantId });
    return { message: 'Malzeme silindi' };
  }

  // ─── KRİTİK STOK UYARILARI ───────────────────────────────
  async getCriticalAlerts(tenantId: string) {
    return this.ingredientRepo
      .createQueryBuilder('i')
      .where('i.tenant_id = :tenantId', { tenantId })
      .andWhere('i.current_stock <= i.critical_stock')
      .orderBy('i.current_stock', 'ASC')
      .getMany();
  }

  // ─── STOK HAREKETİ ────────────────────────────────────────
  async addTransaction(tenantId: string, data: {
    ingredient_id: string;
    type: 'in' | 'out' | 'adjustment' | 'waste';
    quantity: number;
    note?: string;
    created_by?: string;
  }) {
    const ingredient = await this.findById(data.ingredient_id, tenantId);
    const previousStock = Number(ingredient.current_stock);

    let newStock: number;
    if (data.type === 'in') {
      newStock = previousStock + data.quantity;
    } else if (data.type === 'out' || data.type === 'waste') {
      newStock = Math.max(0, previousStock - data.quantity);
    } else {
      newStock = data.quantity; // adjustment = direkt set
    }

    await this.ingredientRepo.update(data.ingredient_id, { current_stock: newStock });

    await this.dataSource.query(
      `INSERT INTO stock_transactions 
       (tenant_id, ingredient_id, type, quantity, previous_stock, new_stock, note, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [tenantId, data.ingredient_id, data.type, data.quantity, previousStock, newStock, data.note || null, data.created_by || null],
    );

    return { previous: previousStock, new: newStock, ingredient };
  }

  // ─── REÇETE CRUD ──────────────────────────────────────────
  async getRecipe(productId: string) {
    return this.dataSource.query(
      `SELECT r.*, i.name as ingredient_name, i.unit, i.cost_per_unit
       FROM recipes r
       JOIN ingredients i ON i.id = r.ingredient_id
       WHERE r.product_id = $1`,
      [productId],
    );
  }

  async saveRecipe(productId: string, items: { ingredient_id: string; quantity: number }[]) {
    // Mevcut reçeteyi sil
    await this.recipeRepo.delete({ product_id: productId });
    // Yeni reçeteyi kaydet
    for (const item of items) {
      await this.recipeRepo.save(
        this.recipeRepo.create({
          product_id: productId,
          ingredient_id: item.ingredient_id,
          quantity: item.quantity,
        }),
      );
    }
    return this.getRecipe(productId);
  }

  // ─── STOK HAREKETLERİ GEÇMİŞİ ────────────────────────────
  async getTransactions(tenantId: string, ingredientId?: string) {
    let query = `
      SELECT st.*, i.name as ingredient_name, i.unit, u.name as user_name
      FROM stock_transactions st
      JOIN ingredients i ON i.id = st.ingredient_id
      LEFT JOIN users u ON u.id = st.created_by
      WHERE st.tenant_id = $1
    `;
    const params: any[] = [tenantId];
    if (ingredientId) {
      query += ` AND st.ingredient_id = $2`;
      params.push(ingredientId);
    }
    query += ` ORDER BY st.created_at DESC LIMIT 200`;
    return this.dataSource.query(query, params);
  }
}
