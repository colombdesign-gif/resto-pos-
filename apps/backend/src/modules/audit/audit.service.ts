import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@Injectable()
export class AuditLogService {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async log(data: {
    tenant_id: string;
    user_id?: string;
    user_email?: string;
    action: string;          // 'CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'PAYMENT'
    resource: string;        // 'order', 'payment', 'user', etc.
    resource_id?: string;
    old_values?: any;
    new_values?: any;
    ip_address?: string;
    user_agent?: string;
    metadata?: any;
  }) {
    try {
      await this.dataSource.query(
        `INSERT INTO audit_logs
           (tenant_id, user_id, user_email, action, resource, resource_id,
            old_values, new_values, ip_address, user_agent, metadata)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [
          data.tenant_id,
          data.user_id || null,
          data.user_email || null,
          data.action,
          data.resource,
          data.resource_id || null,
          data.old_values ? JSON.stringify(data.old_values) : null,
          data.new_values ? JSON.stringify(data.new_values) : null,
          data.ip_address || null,
          data.user_agent || null,
          data.metadata ? JSON.stringify(data.metadata) : null,
        ],
      );
    } catch (err) {
      // Audit log hataları sistemi durdurmamalı
      console.error('Audit log hatası:', err.message);
    }
  }

  async findLogs(tenantId: string, filters?: {
    userId?: string;
    resource?: string;
    action?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
  }) {
    let query = `
      SELECT al.*, u.name as user_name
      FROM audit_logs al
      LEFT JOIN users u ON u.id = al.user_id
      WHERE al.tenant_id = $1
    `;
    const params: any[] = [tenantId];
    let idx = 2;

    if (filters?.userId) { query += ` AND al.user_id = $${idx++}`; params.push(filters.userId); }
    if (filters?.resource) { query += ` AND al.resource = $${idx++}`; params.push(filters.resource); }
    if (filters?.action) { query += ` AND al.action = $${idx++}`; params.push(filters.action); }
    if (filters?.startDate) { query += ` AND DATE(al.created_at) >= $${idx++}`; params.push(filters.startDate); }
    if (filters?.endDate) { query += ` AND DATE(al.created_at) <= $${idx++}`; params.push(filters.endDate); }

    query += ` ORDER BY al.created_at DESC LIMIT $${idx}`;
    params.push(filters?.limit || 100);

    return this.dataSource.query(query, params);
  }
}
