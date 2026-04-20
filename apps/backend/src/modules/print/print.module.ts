import { Module } from '@nestjs/common';
import { PrintService } from './print.service';
import { PrintController } from './print.controller';

@Module({
  providers: [PrintService],
  controllers: [PrintController],
  exports: [PrintService],
})
export class PrintModule {}
