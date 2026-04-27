import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Order } from '../orders/entities/order.entity';
import { ConfigService } from '@nestjs/config';
import { EventsGateway } from '../../websocket/events.gateway';

// Iyzico Node.js SDK
const Iyzipay = require('iyzipay');

@Injectable()
export class PaymentsService {
  private iyzipay: any;

  constructor(
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
    private readonly eventsGateway: EventsGateway,
  ) {
    this.iyzipay = new Iyzipay({
      apiKey: configService.get('IYZICO_API_KEY') || 'sandbox-api-key',
      secretKey: configService.get('IYZICO_SECRET_KEY') || 'sandbox-secret-key',
      uri: configService.get('IYZICO_BASE_URL') || 'https://sandbox-api.iyzipay.com',
    });
  }

  // ─── ÖDEME AL ─────────────────────────────────────────────
  async processPayment(orderId: string, tenantId: string, data: {
    method: 'cash' | 'card' | 'iyzico' | 'mixed';
    amount: number;
    change_amount?: number;
    reference?: string;
    notes?: string;
    // Iyzico için
    cardToken?: string;
    buyerInfo?: {
      name: string;
      email: string;
      phone: string;
      identityNumber?: string;
      address?: string;
      city?: string;
    };
  }) {
    const order = await this.orderRepo.findOne({
      where: { id: orderId, tenant_id: tenantId },
      relations: ['items'],
    });
    if (!order) throw new NotFoundException('Sipariş bulunamadı');

    if (order.status === 'closed') {
      throw new BadRequestException('Bu sipariş zaten kapatılmış');
    }

    const remainingAmount = Number(order.total) - Number(order.paid_amount);
    if (data.amount > remainingAmount + 0.01) {
      throw new BadRequestException('Ödeme tutarı kalan tutarı aşıyor');
    }

    let iyzicoPaymentId: string | null = null;

    // ─── İYZİCO ÖDEMESİ ───────────────────────────────────
    if (data.method === 'iyzico' && data.cardToken) {
      const iyzicoResult = await this.processIyzicoPayment(
        order,
        data.amount,
        data.cardToken,
        data.buyerInfo,
      );
      if (iyzicoResult.status !== 'success') {
        throw new BadRequestException(
          iyzicoResult.errorMessage || 'Kart ödemesi başarısız',
        );
      }
      iyzicoPaymentId = iyzicoResult.paymentId;
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Ana ödeme kaydı
      const [paymentRow] = await queryRunner.query(
        `INSERT INTO payments (order_id, tenant_id, method, amount, change_amount, reference, iyzico_payment_id, status, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'completed', $8) RETURNING id`,
        [
          orderId, tenantId, data.method, data.amount,
          data.change_amount || 0, data.reference || null,
          iyzicoPaymentId, data.notes || null,
        ],
      );

      // 2. Parçalı ödeme detayı (Sub-payment item)
      // Mixed ödemelerde frontend farklı yöntemleri tek tek gönderebilir veya 
      // bu endpoint tek bir yöntemi "ödeme parçası" olarak işleyebilir.
      await queryRunner.query(
        `INSERT INTO payment_items (payment_id, method, amount)
         VALUES ($1, $2, $3)`,
        [paymentRow.id, data.method === 'mixed' ? 'cash' : data.method, data.amount],
      );

      const newPaidAmount = Number(order.paid_amount) + data.amount;
      const isFullyPaid = newPaidAmount >= Number(order.total) - 0.01;

      // 3. Sipariş güncelle
      if (isFullyPaid) {
        await queryRunner.query(
          `UPDATE orders SET paid_amount = $1, status = 'closed', closed_at = NOW() WHERE id = $2`,
          [newPaidAmount, orderId],
        );
        // Sadece başka aktif siparişi yoksa masayı serbest bırak
        if (order.table_id) {
          const otherActiveOrders = await queryRunner.query(
            `SELECT id FROM orders WHERE table_id = $1 AND status NOT IN ('closed', 'cancelled') AND id != $2 LIMIT 1`,
            [order.table_id, order.id],
          );

          if (otherActiveOrders.length === 0) {
            await queryRunner.query(
              `UPDATE tables SET status = 'available' WHERE id = $1`,
              [order.table_id],
            );
            this.eventsGateway.emitToTenant(tenantId, 'table.status_changed', {
              id: order.table_id,
              status: 'available',
            });
          }
        }
        // NOT: Stok düşümü artık sipariş oluşturulduğunda veya ürün eklendiğinde yapılıyor (OrdersService).
        // Burada tekrar stok düşmek mükerrer (double-deduct) hatasına yol açar.
      } else {
        await queryRunner.query(
          `UPDATE orders SET paid_amount = $1 WHERE id = $2`,
          [newPaidAmount, orderId],
        );
      }

      await queryRunner.commitTransaction();

      const updatedOrder = await this.orderRepo.findOne({
        where: { id: orderId },
        relations: ['items'],
      });
      this.eventsGateway.emitToTenant(tenantId, 'order.payment_received', updatedOrder);
      // Mutfağa bildir (Özellikle kapatılan siparişlerin KDS'den düşmesi için)
      this.eventsGateway.emitToKitchen(order.branch_id, 'kitchen.order_updated', updatedOrder);

      return {
        success: true,
        order: updatedOrder,
        payment: {
          method: data.method,
          amount: data.amount,
          change: data.change_amount || 0,
          isFullyPaid,
          remaining: Math.max(0, Number(order.total) - newPaidAmount),
        },
      };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  // ─── İYZİCO ENTEGRASYONU ──────────────────────────────────
  private processIyzicoPayment(
    order: Order,
    amount: number,
    cardToken: string,
    buyerInfo?: any,
  ): Promise<any> {
    return new Promise((resolve) => {
      const request = {
        locale: Iyzipay.LOCALE.TR,
        conversationId: order.id,
        price: amount.toFixed(2),
        paidPrice: amount.toFixed(2),
        currency: Iyzipay.CURRENCY.TRY,
        installment: '1',
        basketId: order.id,
        paymentChannel: Iyzipay.PAYMENT_CHANNEL.WEB,
        paymentGroup: Iyzipay.PAYMENT_GROUP.PRODUCT,
        paymentCard: {
          cardToken,
        },
        buyer: {
          id: buyerInfo?.id || 'B' + order.id.substring(0, 8),
          name: buyerInfo?.name || 'Misafir',
          surname: buyerInfo?.name || 'Müşteri',
          email: buyerInfo?.email || 'musteri@restopos.com',
          identityNumber: buyerInfo?.identityNumber || '11111111111',
          lastLoginDate: new Date().toISOString().replace('T', ' ').split('.')[0],
          registrationDate: new Date().toISOString().replace('T', ' ').split('.')[0],
          registrationAddress: buyerInfo?.address || 'Türkiye',
          ip: '85.34.78.112',
          city: buyerInfo?.city || 'Istanbul',
          country: 'Turkey',
          zipCode: '34732',
        },
        shippingAddress: {
          contactName: buyerInfo?.name || 'Misafir Müşteri',
          city: buyerInfo?.city || 'Istanbul',
          country: 'Turkey',
          address: buyerInfo?.address || 'Restoran',
          zipCode: '34732',
        },
        billingAddress: {
          contactName: buyerInfo?.name || 'Misafir Müşteri',
          city: buyerInfo?.city || 'Istanbul',
          country: 'Turkey',
          address: buyerInfo?.address || 'Restoran',
          zipCode: '34732',
        },
        basketItems: [
          {
            id: order.id,
            name: `Sipariş #${order.order_number}`,
            category1: 'Restoran',
            itemType: Iyzipay.BASKET_ITEM_TYPE.PHYSICAL,
            price: amount.toFixed(2),
          },
        ],
      };

      this.iyzipay.payment.create(request, (err: any, result: any) => {
        if (err) {
          resolve({ status: 'failure', errorMessage: err.message });
        } else {
          resolve(result);
        }
      });
    });
  }

  // ÖNEMLİ: deductStock metodu kaldırıldı.
  // Stok düşümü artık OrdersService.create() içinde InventoryService.deductStockByRecipe() ile yapılıyor.
  // Bu, mükerrer stok düşümünü engeller.

  // ─── KASA AÇ ─────────────────────────────────────────────
  async openCashSession(branchId: string, userId: string, openingCash: number) {
    const existing = await this.dataSource.query(
      `SELECT id FROM cash_sessions WHERE branch_id = $1 AND status = 'open'`,
      [branchId],
    );
    if (existing.length > 0) {
      throw new BadRequestException('Bu şubede zaten açık bir kasa var');
    }

    const [session] = await this.dataSource.query(
      `INSERT INTO cash_sessions (branch_id, opened_by, opening_cash, status)
       VALUES ($1, $2, $3, 'open') RETURNING *`,
      [branchId, userId, openingCash],
    );
    return session;
  }

  // ─── KASA KAPAT ──────────────────────────────────────────
  async closeCashSession(branchId: string, userId: string, closingCash: number, notes: string) {
    const [session] = await this.dataSource.query(
      `SELECT * FROM cash_sessions WHERE branch_id = $1 AND status = 'open'`,
      [branchId],
    );
    if (!session) throw new NotFoundException('Açık kasa bulunamadı');

    // Beklenen nakit hesapla
    const [cashResult] = await this.dataSource.query(
      `SELECT COALESCE(SUM(p.amount), 0) as total
       FROM payments p
       JOIN orders o ON o.id = p.order_id
       WHERE o.branch_id = $1 AND p.method = 'cash' AND p.created_at >= $2`,
      [branchId, session.opened_at],
    );
    const expectedCash = Number(session.opening_cash) + Number(cashResult.total);

    const [updated] = await this.dataSource.query(
      `UPDATE cash_sessions 
       SET status = 'closed', closed_by = $1, closing_cash = $2, 
           expected_cash = $3, closed_at = NOW(), notes = $4
       WHERE id = $5 RETURNING *`,
      [userId, closingCash, expectedCash, notes, session.id],
    );
    return updated;
  }

  // ─── GÜNLÜK KASA RAPORU (FIX: sipariş toplamları ayrı hesaplanıyor) ──
  async getDailyReport(branchId: string, date: string) {
    // Ödeme dökümü (yöntem bazlı)
    const paymentBreakdown = await this.dataSource.query(
      `SELECT
         COALESCE(SUM(CASE WHEN p.method = 'cash' THEN p.amount ELSE 0 END), 0) as cash_total,
         COALESCE(SUM(CASE WHEN p.method = 'card' THEN p.amount ELSE 0 END), 0) as card_total,
         COALESCE(SUM(CASE WHEN p.method = 'iyzico' THEN p.amount ELSE 0 END), 0) as iyzico_total,
         COALESCE(SUM(p.amount), 0) as collected_total
       FROM payments p
       JOIN orders o ON o.id = p.order_id
       WHERE o.branch_id = $1 AND DATE(o.created_at) = $2
         AND p.status = 'completed'`,
      [branchId, date],
    );

    // Sipariş istatistikleri (ayrı sorgu — JOIN şişmesini engeller)
    const [orderStats] = await this.dataSource.query(
      `SELECT
         COUNT(*) as order_count,
         COALESCE(SUM(total), 0) as total_revenue,
         COALESCE(SUM(tax_total), 0) as tax_total,
         COALESCE(SUM(discount_total), 0) as discount_total
       FROM orders
       WHERE branch_id = $1 AND DATE(created_at) = $2 AND status = 'closed'`,
      [branchId, date],
    );

    return { ...orderStats, ...(paymentBreakdown[0] || {}) };
  }

  // ─── ÖDEME GEÇMİŞİ (FIX: tenant izolasyonu eklendi) ──────
  async getOrderPayments(orderId: string, tenantId?: string) {
    let query = `
      SELECT p.*, u.name as processed_by_name
      FROM payments p
      LEFT JOIN users u ON u.id = p.processed_by
      WHERE p.order_id = $1
    `;
    const params: any[] = [orderId];

    if (tenantId) {
      query += ` AND p.tenant_id = $2`;
      params.push(tenantId);
    }

    query += ` ORDER BY p.created_at ASC`;
    return this.dataSource.query(query, params);
  }
}
