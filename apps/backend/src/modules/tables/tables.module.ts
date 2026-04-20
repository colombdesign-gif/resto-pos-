import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TablesService } from './tables.service';
import { TablesController } from './tables.controller';
import { Table } from './entities/table.entity';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [TypeOrmModule.forFeature([Table]), NotificationsModule],
  providers: [TablesService],
  controllers: [TablesController],
  exports: [TablesService, TypeOrmModule],
})
export class TablesModule {}
