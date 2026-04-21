import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { Order, OrderItem } from './entities/order.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { InventoryModule } from '../inventory/inventory.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, OrderItem]), 
    NotificationsModule,
    InventoryModule
  ],
  providers: [OrdersService],
  controllers: [OrdersController],
  exports: [OrdersService],
})
export class OrdersModule {}
