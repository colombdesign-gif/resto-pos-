import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class ReportsService {
  constructor(private readonly dataSource: DataSource) {}

  // ─── SATIŞ RAPORU ─────────────────────────────────────────
  async getSalesReport(tenantId: string, params: {
    branchId?: string;
    startDate: string;
    endDate: string;
    groupBy?: 'day' | 'week' | 'month';
  }) {
    const { branchId, startDate, endDate, groupBy = 'day' } = params;

    const groupFormat = groupBy === 'month' ? 'YYYY-MM' : groupBy === 'week' ? 'IYYY-IW' : 'YYYY-MM-DD';

    let query = `
      SELECT
        TO_CHAR(o.created_at, '${groupFormat}') as period,
        COUNT(DISTINCT o.id) as order_count,
        COALESCE(SUM(o.total), 0) as revenue,
        COALESCE(SUM(o.tax_total), 0) as tax,
        COALESCE(SUM(o.discount_total), 0) as discount,
        COALESCE(AVG(o.total), 0) as avg_order_value
      FROM orders o
      WHERE o.tenant_id = $1
        AND o.status = 'closed'
        AND DATE(o.created_at) BETWEEN $2 AND $3
    `;
    const params_arr: any[] = [tenantId, startDate, endDate];

    if (branchId) {
      query += ` AND o.branch_id = $4`;
      params_arr.push(branchId);
    }

    query += ` GROUP BY period ORDER BY period ASC`;
    return this.dataSource.query(query, params_arr);
  }

  // ─── ÜRÜN ANALİZİ ─────────────────────────────────────────
  async getProductReport(tenantId: string, params: {
    branchId?: string;
    startDate: string;
    endDate: string;
    limit?: number;
  }) {
    const { branchId, startDate, endDate, limit = 20 } = params;

    return this.dataSource.query(
      `SELECT
         p.id, p.name, c.name as category_name,
         SUM(oi.quantity) as total_quantity,
         SUM(oi.total_price) as total_revenue,
         COUNT(DISTINCT o.id) as order_count,
         AVG(oi.unit_price) as avg_price
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       JOIN products p ON p.id = oi.product_id
       LEFT JOIN categories c ON c.id = p.category_id
       WHERE o.tenant_id = $1
         AND o.status = 'closed'
         AND DATE(o.created_at) BETWEEN $2 AND $3
         AND oi.status != 'cancelled'
         ${branchId ? 'AND o.branch_id = $5' : ''}
       GROUP BY p.id, p.name, c.name
       ORDER BY total_revenue DESC
       LIMIT $4`,
      branchId ? [tenantId, startDate, endDate, limit, branchId] : [tenantId, startDate, endDate, limit],
    );
  }

  // ─── GARSON PERFORMANSI ───────────────────────────────────
  async getWaiterReport(tenantId: string, params: {
    branchId?: string;
    startDate: string;
    endDate: string;
  }) {
    return this.dataSource.query(
      `SELECT
         u.id, u.name,
         COUNT(DISTINCT o.id) as order_count,
         COALESCE(SUM(o.total), 0) as total_revenue,
         COALESCE(AVG(o.total), 0) as avg_order_value,
         COUNT(DISTINCT o.table_id) as tables_served
       FROM orders o
       JOIN users u ON u.id = o.waiter_id
       WHERE o.tenant_id = $1
         AND o.status = 'closed'
         AND DATE(o.created_at) BETWEEN $2 AND $3
         ${params.branchId ? 'AND o.branch_id = $4' : ''}
       GROUP BY u.id, u.name
       ORDER BY total_revenue DESC`,
      params.branchId
        ? [tenantId, params.startDate, params.endDate, params.branchId]
        : [tenantId, params.startDate, params.endDate],
    );
  }

  // ─── ŞUBE KARŞILAŞTIRMA ───────────────────────────────────
  async getBranchReport(tenantId: string, startDate: string, endDate: string) {
    return this.dataSource.query(
      `SELECT
         b.id, b.name,
         COUNT(DISTINCT o.id) as order_count,
         COALESCE(SUM(o.total), 0) as revenue,
         COALESCE(AVG(o.total), 0) as avg_order,
         COUNT(DISTINCT o.waiter_id) as active_waiters
       FROM branches b
       LEFT JOIN orders o ON o.branch_id = b.id
         AND o.status = 'closed'
         AND DATE(o.created_at) BETWEEN $2 AND $3
       WHERE b.tenant_id = $1 AND b.is_active = true
       GROUP BY b.id, b.name
       ORDER BY revenue DESC`,
      [tenantId, startDate, endDate],
    );
  }

  // ─── SAATLİK YOĞUNLUK ─────────────────────────────────────
  async getHourlyReport(tenantId: string, branchId?: string, date?: string) {
    const targetDate = date || new Date().toISOString().split('T')[0];
    return this.dataSource.query(
      `SELECT
         EXTRACT(HOUR FROM o.created_at) as hour,
         COUNT(DISTINCT o.id) as order_count,
         COALESCE(SUM(o.total), 0) as revenue
       FROM orders o
       WHERE o.tenant_id = $1
         AND DATE(o.created_at) = $2
         AND o.status = 'closed'
         ${branchId ? 'AND o.branch_id = $3' : ''}
       GROUP BY hour ORDER BY hour ASC`,
      branchId ? [tenantId, targetDate, branchId] : [tenantId, targetDate],
    );
  }

  // ─── DASHBOARD ÖZET ───────────────────────────────────────
  async getDashboardStats(tenantId: string, branchId?: string) {
    const today = new Date().toISOString().split('T')[0];
    const [today_stats] = await this.dataSource.query(
      `SELECT
         COUNT(DISTINCT o.id) as today_orders,
         COALESCE(SUM(o.total), 0) as today_revenue,
         COUNT(DISTINCT CASE WHEN o.status NOT IN ('closed','cancelled') THEN o.id END) as active_orders,
         COUNT(DISTINCT CASE WHEN t.status = 'occupied' THEN t.id END) as occupied_tables
       FROM orders o
       CROSS JOIN tables t
       WHERE o.tenant_id = $1
         AND t.branch_id ${branchId ? '= $2' : 'IS NOT NULL'}
         AND (DATE(o.created_at) = '${today}' OR o.status NOT IN ('closed','cancelled'))`,
      branchId ? [tenantId, branchId] : [tenantId],
    );

    const top_products = await this.dataSource.query(
      `SELECT p.name, SUM(oi.quantity) as qty
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       JOIN products p ON p.id = oi.product_id
       WHERE o.tenant_id = $1 AND DATE(o.created_at) = '${today}'
       GROUP BY p.name ORDER BY qty DESC LIMIT 5`,
      [tenantId],
    );

    return { today_stats, top_products };
  }
}
