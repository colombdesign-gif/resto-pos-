import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { KitchenService } from './kitchen.service';
import { KitchenController } from './kitchen.controller';
import { Order, OrderItem } from '../orders/entities/order.entity';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [TypeOrmModule.forFeature([Order, OrderItem]), NotificationsModule],
  providers: [KitchenService],
  controllers: [KitchenController],
})
export class KitchenModule {}
