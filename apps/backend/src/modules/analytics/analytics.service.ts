import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { InjectDataSource } from '@nestjs/typeorm';

/**
 * AI Analytics Servisi
 * Makine öğrenmesi gerektirmez — güçlü SQL sorguları ile içgörüler üretir.
 */
@Injectable()
export class AnalyticsService {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  // ─── EN ÇOK SATAN ÜRÜNLER (Zaman bazlı) ─────────────────────
  async getTopSellingProducts(tenantId: string, days = 30, limit = 10) {
    return this.dataSource.query(
      `SELECT
         p.id, p.name, p.price,
         SUM(oi.quantity) AS total_qty,
         SUM(oi.total_price) AS total_revenue,
         COUNT(DISTINCT o.id) AS order_count,
         ROUND(SUM(oi.quantity) / $3::numeric, 1) AS avg_daily_qty
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       JOIN products p ON p.id = oi.product_id
       WHERE o.tenant_id = $1
         AND o.status = 'closed'
         AND o.created_at >= NOW() - INTERVAL '1 day' * $2
         AND oi.status != 'cancelled'
       GROUP BY p.id, p.name, p.price
       ORDER BY total_revenue DESC
       LIMIT $4`,
      [tenantId, days, days, limit],
    );
  }

  // ─── ZAMAN SAATİ BAZINDA YOĞUNLUK TAHMİNİ ─────────────────────
  async getPeakHourPrediction(tenantId: string, branchId?: string) {
    const params: any[] = [tenantId];
    let branchFilter = '';
    if (branchId) { branchFilter = ' AND o.branch_id = $2'; params.push(branchId); }

    return this.dataSource.query(
      `SELECT
         EXTRACT(DOW FROM o.created_at) AS day_of_week,
         EXTRACT(HOUR FROM o.created_at) AS hour,
         COUNT(*) AS avg_orders,
         ROUND(AVG(o.total), 2) AS avg_revenue,
         CASE
           WHEN COUNT(*) > 20 THEN 'very_high'
           WHEN COUNT(*) > 12 THEN 'high'
           WHEN COUNT(*) > 6  THEN 'medium'
           ELSE 'low'
         END AS intensity
       FROM orders o
       WHERE o.tenant_id = $1
         AND o.status = 'closed'
         AND o.created_at >= NOW() - INTERVAL '90 days'
         ${branchFilter}
       GROUP BY day_of_week, hour
       ORDER BY day_of_week, hour`,
      params,
    );
  }

  // ─── OTOMATİK STOK TAHMİNİ ───────────────────────────────────
  async getStockForecast(tenantId: string) {
    // Son 30 günlük tüketim hızına bakarak kaç gün daha yetereceğini hesapla
    return this.dataSource.query(
      `WITH daily_consumption AS (
         SELECT
           r.ingredient_id,
           SUM(oi.quantity * r.quantity) / 30.0 AS daily_use
         FROM order_items oi
         JOIN orders o ON o.id = oi.order_id
         JOIN recipes r ON r.product_id = oi.product_id
         WHERE o.tenant_id = $1
           AND o.status = 'closed'
           AND o.created_at >= NOW() - INTERVAL '30 days'
           AND oi.status != 'cancelled'
         GROUP BY r.ingredient_id
       )
       SELECT
         i.id, i.name, i.unit,
         i.current_stock,
         i.critical_stock,
         dc.daily_use,
         CASE
           WHEN dc.daily_use > 0
           THEN ROUND(i.current_stock / dc.daily_use)
           ELSE NULL
         END AS days_remaining,
         CASE
           WHEN dc.daily_use > 0 AND (i.current_stock / dc.daily_use) < 7 THEN 'urgent'
           WHEN dc.daily_use > 0 AND (i.current_stock / dc.daily_use) < 14 THEN 'warning'
           ELSE 'ok'
         END AS forecast_status,
         ROUND(dc.daily_use * 14) AS suggested_order_qty  -- 2 haftalık sipariş önerisi
       FROM ingredients i
       LEFT JOIN daily_consumption dc ON dc.ingredient_id = i.id
       WHERE i.tenant_id = $1
       ORDER BY days_remaining ASC NULLS LAST`,
      [tenantId],
    );
  }

  // ─── KAMPANYA ÖNERİSİ ─────────────────────────────────────────
  async getCampaignSuggestions(tenantId: string) {
    const suggestions: any[] = [];

    // 1. Düşük satış bildirimi (son 7 günde 5'ten az sipariş alan ürünler)
    const slowMoving = await this.dataSource.query(
      `SELECT p.id, p.name, p.price, COALESCE(SUM(oi.quantity), 0) AS qty
       FROM products p
       LEFT JOIN order_items oi ON oi.product_id = p.id
         AND oi.created_at >= NOW() - INTERVAL '7 days'
       WHERE p.tenant_id = $1 AND p.is_active = true
       GROUP BY p.id, p.name, p.price
       HAVING COALESCE(SUM(oi.quantity), 0) < 5
       ORDER BY qty ASC LIMIT 5`,
      [tenantId],
    );

    for (const item of slowMoving) {
      suggestions.push({
        type: 'discount',
        product_id: item.id,
        product_name: item.name,
        current_price: item.price,
        suggestion: `${item.name} için %15 indirim kampanyası`,
        reason: `Son 7 günde sadece ${item.qty} adet satıldı`,
        suggested_price: Math.round(item.price * 0.85),
      });
    }

    // 2. Saat bazlı kampanya (en düşük trafikli saat)
    const quietHours = await this.dataSource.query(
      `SELECT EXTRACT(HOUR FROM created_at) AS hour, COUNT(*) AS cnt
       FROM orders WHERE tenant_id = $1 AND created_at >= NOW() - INTERVAL '30 days'
       GROUP BY hour HAVING COUNT(*) < 5
       ORDER BY cnt ASC LIMIT 3`,
      [tenantId],
    );

    for (const h of quietHours) {
      suggestions.push({
        type: 'happy_hour',
        hour: h.hour,
        suggestion: `Saat ${h.hour}:00 - ${h.hour + 1}:00 arası "Happy Hour" kampanyası`,
        reason: `Bu saatte aylık ortalama sadece ${h.cnt} sipariş alınıyor`,
      });
    }

    return suggestions;
  }

  // ─── GELİR TAHMİNİ ───────────────────────────────────────────
  async getRevenueForecast(tenantId: string, days = 7) {
    // Son 4 haftanın aynı günlerini kullanarak gelecek tahmini
    const historical = await this.dataSource.query(
      `SELECT
         EXTRACT(DOW FROM created_at) AS day_of_week,
         AVG(daily_total) AS avg_revenue
       FROM (
         SELECT DATE(created_at) AS d,
                EXTRACT(DOW FROM created_at) AS day_of_week,
                SUM(total) AS daily_total
         FROM orders
         WHERE tenant_id = $1
           AND status = 'closed'
           AND created_at >= NOW() - INTERVAL '28 days'
         GROUP BY d, day_of_week
       ) sub
       GROUP BY day_of_week
       ORDER BY day_of_week`,
      [tenantId],
    );

    const forecast = [];
    const today = new Date();
    for (let i = 0; i < days; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      const dayOfWeek = date.getDay();
      const hist = historical.find((h: any) => Number(h.day_of_week) === dayOfWeek);
      forecast.push({
        date: date.toISOString().split('T')[0],
        day_of_week: dayOfWeek,
        predicted_revenue: hist ? Math.round(Number(hist.avg_revenue)) : 0,
        confidence: hist ? 'medium' : 'low',
      });
    }
    return forecast;
  }

  // ─── GARSON KARŞILAŞTIRMA ─────────────────────────────────────
  async getWaiterPerformance(tenantId: string, branchId?: string) {
    return this.dataSource.query(
      `SELECT
         u.id, u.name,
         COUNT(DISTINCT o.id) AS order_count,
         SUM(o.total) AS total_revenue,
         AVG(o.total) AS avg_order_value,
         COUNT(DISTINCT o.table_id) AS unique_tables,
         AVG(EXTRACT(EPOCH FROM (o.closed_at - o.created_at)) / 60) AS avg_service_minutes
       FROM orders o
       JOIN users u ON u.id = o.waiter_id
       WHERE o.tenant_id = $1
         AND o.status = 'closed'
         AND o.created_at >= NOW() - INTERVAL '30 days'
         ${branchId ? 'AND o.branch_id = $2' : ''}
       GROUP BY u.id, u.name
       ORDER BY total_revenue DESC`,
      branchId ? [tenantId, branchId] : [tenantId],
    );
  }

  // ─── MENU MIX ANALİZİ (Boston Matrix) ───────────────────────
  async getMenuMixAnalysis(tenantId: string) {
    const products = await this.dataSource.query(
      `SELECT
         p.id, p.name, p.price,
         COALESCE(SUM(oi.quantity), 0) AS total_qty,
         COALESCE(SUM(oi.total_price), 0) AS total_revenue,
         COALESCE(AVG(oi.total_price / NULLIF(oi.quantity, 0)), p.price) AS actual_avg_price
       FROM products p
       LEFT JOIN order_items oi ON oi.product_id = p.id
         AND oi.created_at >= NOW() - INTERVAL '30 days'
       WHERE p.tenant_id = $1 AND p.is_active = true
       GROUP BY p.id, p.name, p.price`,
      [tenantId],
    );

    if (!products.length) return [];

    const avgQty = products.reduce((s: number, p: any) => s + Number(p.total_qty), 0) / products.length;
    const avgRevenue = products.reduce((s: number, p: any) => s + Number(p.total_revenue), 0) / products.length;

    return products.map((p: any) => ({
      ...p,
      category:
        Number(p.total_qty) >= avgQty && Number(p.total_revenue) >= avgRevenue ? 'star' :     // Yüksek satış + Yüksek gelir
        Number(p.total_qty) >= avgQty && Number(p.total_revenue) < avgRevenue  ? 'plow-horse': // Yüksek satış + Düşük gelir
        Number(p.total_qty) < avgQty  && Number(p.total_revenue) >= avgRevenue ? 'puzzle' :    // Düşük satış + Yüksek gelir
        'dog', // Düşük satış + Düşük gelir
    }));
  }
}
