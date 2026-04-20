import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { InjectDataSource } from '@nestjs/typeorm';

@Injectable()
export class PrintService {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Sipariş fişi HTML'i üretir — tarayıcı baskısı veya termal yazıcı için
   */
  async generateReceiptHtml(orderId: string): Promise<string> {
    const [order] = await this.dataSource.query(
      `SELECT o.*, t.name as table_name, b.name as branch_name,
              tn.name as tenant_name, b.address as branch_address,
              b.phone as branch_phone, tn.tax_number, tn.tax_office
       FROM orders o
       LEFT JOIN tables t ON t.id = o.table_id
       LEFT JOIN branches b ON b.id = o.branch_id
       LEFT JOIN tenants tn ON tn.id = o.tenant_id
       WHERE o.id = $1`,
      [orderId],
    );

    const items = await this.dataSource.query(
      `SELECT oi.*, p.name as product_name, p.tax_rate
       FROM order_items oi
       JOIN products p ON p.id = oi.product_id
       WHERE oi.order_id = $1 AND oi.status != 'cancelled'`,
      [orderId],
    );

    const payments = await this.dataSource.query(
      `SELECT * FROM payments WHERE order_id = $1 ORDER BY created_at ASC`,
      [orderId],
    );

    const now = new Date().toLocaleString('tr-TR');
    const subtotal = items.reduce((s: number, i: any) => s + Number(i.total_price), 0);
    const taxTotal = items.reduce((s: number, i: any) => {
      const tax = (Number(i.total_price) * Number(i.tax_rate)) / (100 + Number(i.tax_rate));
      return s + tax;
    }, 0);

    const paymentLines = payments.map((p: any) =>
      `<tr><td>${this.methodLabel(p.method)}</td><td style="text-align:right">₺${Number(p.amount).toFixed(2)}</td></tr>`
    ).join('');

    const itemLines = items.map((item: any) =>
      `<tr>
        <td>${item.product_name}</td>
        <td style="text-align:center">${item.quantity}</td>
        <td style="text-align:right">₺${Number(item.unit_price).toFixed(2)}</td>
        <td style="text-align:right">₺${Number(item.total_price).toFixed(2)}</td>
      </tr>`
    ).join('');

    return `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8">
<title>Fiş #${order.order_number}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Courier New', monospace; font-size: 12px; width: 80mm; margin: 0 auto; }
  .center { text-align: center; }
  .bold { font-weight: bold; }
  .line { border-top: 1px dashed #000; margin: 4px 0; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 2px 0; }
  .total-row { font-weight: bold; font-size: 14px; }
  h1 { font-size: 16px; }
  @media print { body { width: 80mm; } }
</style>
</head>
<body>
  <div class="center">
    <h1>${order.tenant_name}</h1>
    <div>${order.branch_name}</div>
    ${order.branch_address ? `<div>${order.branch_address}</div>` : ''}
    ${order.branch_phone ? `<div>Tel: ${order.branch_phone}</div>` : ''}
    ${order.tax_number ? `<div>VKN: ${order.tax_number}</div>` : ''}
  </div>

  <div class="line"></div>

  <div>FİŞ NO: #${order.order_number}</div>
  ${order.table_name ? `<div>MASA: ${order.table_name}</div>` : ''}
  <div>TARİH: ${now}</div>
  <div>TÜR: ${this.typeLabel(order.type)}</div>

  <div class="line"></div>

  <table>
    <thead>
      <tr>
        <th style="text-align:left">ÜRÜN</th>
        <th style="text-align:center">AD</th>
        <th style="text-align:right">BİRİM</th>
        <th style="text-align:right">TOPLAM</th>
      </tr>
    </thead>
    <tbody>${itemLines}</tbody>
  </table>

  <div class="line"></div>

  <table>
    <tr><td>ARA TOPLAM</td><td style="text-align:right">₺${subtotal.toFixed(2)}</td></tr>
    <tr><td>KDV</td><td style="text-align:right">₺${taxTotal.toFixed(2)}</td></tr>
    <tr class="total-row"><td>GENEL TOPLAM</td><td style="text-align:right">₺${Number(order.total).toFixed(2)}</td></tr>
  </table>

  <div class="line"></div>

  <table>
    <thead><tr><th style="text-align:left">ÖDEME</th><th style="text-align:right">TUTAR</th></tr></thead>
    <tbody>${paymentLines}</tbody>
  </table>

  <div class="line"></div>

  <div class="center">
    <div>Teşekkür ederiz!</div>
    <div>Bizi tercih ettiğiniz için teşekkürler.</div>
    <br>
    <div style="font-size:10px">RestoPOS ile yönetilmektedir</div>
    <div style="font-size:10px">www.restopos.com.tr</div>
  </div>

  <script>window.onload = () => window.print();</script>
</body>
</html>`;
  }

  /**
   * Mutfak çıktısı (KDS baskısı)
   */
  async generateKitchenTicketHtml(orderId: string): Promise<string> {
    const [order] = await this.dataSource.query(
      `SELECT o.*, t.name as table_name
       FROM orders o
       LEFT JOIN tables t ON t.id = o.table_id
       WHERE o.id = $1`,
      [orderId],
    );

    const items = await this.dataSource.query(
      `SELECT oi.*, p.name as product_name, s.name as station_name
       FROM order_items oi
       JOIN products p ON p.id = oi.product_id
       LEFT JOIN stations s ON s.id = oi.station_id
       WHERE oi.order_id = $1 AND oi.status != 'cancelled'`,
      [orderId],
    );

    const itemLines = items.map((item: any) =>
      `<div class="item">
        <span class="qty">${item.quantity}x</span>
        <span class="name">${item.product_name}</span>
        ${item.notes ? `<div class="note">⚠️ NOT: ${item.notes}</div>` : ''}
        ${item.station_name ? `<div class="station">[${item.station_name}]</div>` : ''}
      </div>`
    ).join('');

    const now = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

    return `<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<style>
  body { font-family: 'Courier New', monospace; font-size: 14px; width: 80mm; }
  .header { font-size: 20px; font-weight: bold; border-bottom: 2px solid #000; padding-bottom: 6px; margin-bottom: 8px; }
  .item { margin: 6px 0; }
  .qty { font-weight: bold; font-size: 18px; margin-right: 6px; }
  .note { color: #333; font-style: italic; padding-left: 20px; font-size: 12px; }
  .station { color: #666; padding-left: 20px; font-size: 11px; }
</style>
</head>
<body>
  <div class="header">
    SİPARİŞ #${order.order_number}
    ${order.table_name ? `— ${order.table_name}` : `— ${this.typeLabel(order.type)}`}
    <div style="font-size:14px">${now}</div>
  </div>
  ${order.customer_note ? `<div style="background:#fffde7;padding:4px;margin-bottom:8px">⚠️ ${order.customer_note}</div>` : ''}
  ${itemLines}
  <script>window.onload = () => window.print();</script>
</body></html>`;
  }

  private typeLabel(type: string): string {
    const map: Record<string, string> = {
      dine_in: 'Masa Servisi', takeaway: 'Paket Servis', delivery: 'Teslimat', qr: 'QR Sipariş',
    };
    return map[type] || type;
  }

  private methodLabel(method: string): string {
    const map: Record<string, string> = {
      cash: 'Nakit', card: 'Kart', iyzico: 'Online', mixed: 'Karma',
    };
    return map[method] || method;
  }
}
