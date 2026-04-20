import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Category, Station, Product } from './entities/menu.entities';

@Injectable()
export class MenuService {
  constructor(
    @InjectRepository(Category)
    private readonly categoryRepo: Repository<Category>,
    @InjectRepository(Station)
    private readonly stationRepo: Repository<Station>,
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
  ) {}

  // ─── KATEGORİLER ─────────────────────────────────────────
  getCategories(tenantId: string) {
    return this.categoryRepo.find({
      where: { tenant_id: tenantId, is_active: true },
      order: { sort_order: 'ASC', created_at: 'ASC' },
    });
  }

  createCategory(tenantId: string, data: Partial<Category>) {
    const cat = this.categoryRepo.create({ ...data, tenant_id: tenantId });
    return this.categoryRepo.save(cat);
  }

  async updateCategory(id: string, tenantId: string, data: Partial<Category>) {
    await this.categoryRepo.update({ id, tenant_id: tenantId }, data);
    return this.categoryRepo.findOne({ where: { id } });
  }

  async removeCategory(id: string, tenantId: string) {
    await this.categoryRepo.update({ id, tenant_id: tenantId }, { is_active: false });
    return { message: 'Kategori silindi' };
  }

  // ─── İSTASYONLAR ─────────────────────────────────────────
  getStations(branchId: string) {
    return this.stationRepo.find({
      where: { branch_id: branchId, is_active: true },
    });
  }

  createStation(branchId: string, data: Partial<Station>) {
    const station = this.stationRepo.create({ ...data, branch_id: branchId });
    return this.stationRepo.save(station);
  }

  async updateStation(id: string, data: Partial<Station>) {
    await this.stationRepo.update(id, data);
    return this.stationRepo.findOne({ where: { id } });
  }

  // ─── ÜRÜNLER ──────────────────────────────────────────────
  async getProducts(tenantId: string, query?: {
    categoryId?: string;
    stationId?: string;
    search?: string;
    available?: boolean;
  }) {
    const qb = this.productRepo.createQueryBuilder('p')
      .where('p.tenant_id = :tenantId', { tenantId })
      .andWhere('p.is_active = true');

    if (query?.categoryId) {
      qb.andWhere('p.category_id = :categoryId', { categoryId: query.categoryId });
    }
    if (query?.stationId) {
      qb.andWhere('p.station_id = :stationId', { stationId: query.stationId });
    }
    if (query?.search) {
      qb.andWhere('p.name ILIKE :search', { search: `%${query.search}%` });
    }
    if (query?.available !== undefined) {
      qb.andWhere('p.is_available = :available', { available: query.available });
    }

    return qb.orderBy('p.sort_order', 'ASC').addOrderBy('p.name', 'ASC').getMany();
  }

  async getProductById(id: string, tenantId: string) {
    const product = await this.productRepo.findOne({
      where: { id, tenant_id: tenantId, is_active: true },
    });
    if (!product) throw new NotFoundException('Ürün bulunamadı');
    return product;
  }

  createProduct(tenantId: string, data: Partial<Product>) {
    const product = this.productRepo.create({ ...data, tenant_id: tenantId });
    return this.productRepo.save(product);
  }

  async updateProduct(id: string, tenantId: string, data: Partial<Product>) {
    await this.productRepo.update({ id, tenant_id: tenantId }, data);
    return this.productRepo.findOne({ where: { id } });
  }

  async toggleAvailability(id: string, tenantId: string) {
    const product = await this.getProductById(id, tenantId);
    product.is_available = !product.is_available;
    return this.productRepo.save(product);
  }

  async removeProduct(id: string, tenantId: string) {
    await this.productRepo.update({ id, tenant_id: tenantId }, { is_active: false });
    return { message: 'Ürün silindi' };
  }

  // ─── PUBLIC MENÜ (QR) ────────────────────────────────────
  async getPublicMenu(slug: string) {
    // tenant slug'ına göre kategoriler ve ürünleri getir
    const products = await this.productRepo.query(
      `SELECT p.*, c.name as category_name, c.icon as category_icon
       FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
       JOIN tenants t ON t.id = p.tenant_id
       WHERE t.slug = $1 AND p.is_active = true AND p.is_available = true
       ORDER BY c.sort_order, p.sort_order`,
      [slug],
    );

    const categories = await this.categoryRepo.query(
      `SELECT c.* FROM categories c
       JOIN tenants t ON t.id = c.tenant_id
       WHERE t.slug = $1 AND c.is_active = true
       ORDER BY c.sort_order`,
      [slug],
    );

    return { categories, products };
  }
}
