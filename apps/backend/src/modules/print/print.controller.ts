import { Controller, Get, Param, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { PrintService } from './print.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Print')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('print')
export class PrintController {
  constructor(private readonly svc: PrintService) {}

  @Get('receipt/:orderId')
  async getReceipt(@Param('orderId') orderId: string, @Res() res: Response) {
    const html = await this.svc.generateReceiptHtml(orderId);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  }

  @Get('kitchen/:orderId')
  async getKitchenTicket(@Param('orderId') orderId: string, @Res() res: Response) {
    const html = await this.svc.generateKitchenTicketHtml(orderId);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  }
}
