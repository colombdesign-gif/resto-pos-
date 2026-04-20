import { Controller, Post, Body, Param, Headers, HttpCode, Logger } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { DataSource } from 'typeorm';
import { InjectDataSource } from '@nestjs/typeorm';

@ApiTags('Integrations')
@Controller('integrations')
export class IntegrationsController {
  private readonly logger = new Logger(IntegrationsController.name);

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  // ─── YEMEKSEPETİ WEBHOOK ─────────────────────────────────
  @Post('webhook/yemeksepeti')
  @HttpCode(200)
  async handleYemeksepeti(@Body() payload: any, @Headers() headers: any) {
    this.logger.log('Yemeksepeti webhook alındı');
    await this.logIntegration('yemeksepeti', 'order.received', payload);
    // TODO: Yemeksepeti sipariş dönüşümü ve kayıt
    return { received: true };
  }

  // ─── GETİR WEBHOOK ────────────────────────────────────────
  @Post('webhook/getir')
  @HttpCode(200)
  async handleGetir(@Body() payload: any) {
    this.logger.log('Getir webhook alındı');
    await this.logIntegration('getir', 'order.received', payload);
    return { received: true };
  }

  // ─── TRENDYOL WEBHOOK ────────────────────────────────────
  @Post('webhook/trendyol')
  @HttpCode(200)
  async handleTrendyol(@Body() payload: any) {
    this.logger.log('Trendyol webhook alındı');
    await this.logIntegration('trendyol', 'order.received', payload);
    return { received: true };
  }

  private async logIntegration(source: string, event: string, payload: any) {
    try {
      await this.dataSource.query(
        `INSERT INTO integration_logs (source, event, payload, status) VALUES ($1,$2,$3,'success')`,
        [source, event, JSON.stringify(payload)],
      );
    } catch (e) {
      this.logger.error('Integration log hatası:', e.message);
    }
  }
}
