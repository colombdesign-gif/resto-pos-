import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MenuService } from './menu.service';
import { MenuController } from './menu.controller';
import { Category, Station, Product } from './entities/menu.entities';

@Module({
  imports: [TypeOrmModule.forFeature([Category, Station, Product])],
  providers: [MenuService],
  controllers: [MenuController],
  exports: [MenuService, TypeOrmModule],
})
export class MenuModule {}
