import { Module, MiddlewareConsumer, RequestMethod } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';

// Modules
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { TenantsModule } from './modules/tenants/tenants.module';
import { BranchesModule } from './modules/branches/branches.module';
import { FloorPlansModule } from './modules/floor-plans/floor-plans.module';
import { TablesModule } from './modules/tables/tables.module';
import { MenuModule } from './modules/menu/menu.module';
import { StationsModule } from './modules/stations/stations.module';
import { OrdersModule } from './modules/orders/orders.module';
import { KitchenModule } from './modules/kitchen/kitchen.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { CustomersModule } from './modules/customers/customers.module';
import { DeliveryModule } from './modules/delivery/delivery.module';
import { ReportsModule } from './modules/reports/reports.module';
import { IntegrationsModule } from './modules/integrations/integrations.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { AuditModule } from './modules/audit/audit.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { PrintModule } from './modules/print/print.module';

// Middleware
import { TenantMiddleware } from './common/middlewares/tenant.middleware';

@Module({
  imports: [
    // Config
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),

    // Database
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        url: configService.get<string>('DATABASE_URL'),
        autoLoadEntities: true,
        synchronize: false, // Prod'da false, migration kullan
        logging: configService.get('NODE_ENV') === 'development',
        ssl:
          configService.get('NODE_ENV') === 'production'
            ? { rejectUnauthorized: false }
            : false,
        extra: {
          max: 20,
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 2000,
        },
      }),
      inject: [ConfigService],
    }),

    // Rate limiting
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // 1 dakika
        limit: 100,
      },
    ]),

    // Cron jobs
    ScheduleModule.forRoot(),

    // Feature modules
    AuthModule,
    UsersModule,
    TenantsModule,
    BranchesModule,
    FloorPlansModule,
    TablesModule,
    MenuModule,
    StationsModule,
    OrdersModule,
    KitchenModule,
    PaymentsModule,
    InventoryModule,
    CustomersModule,
    DeliveryModule,
    ReportsModule,
    IntegrationsModule,
    NotificationsModule,
    AuditModule,
    AnalyticsModule,
    PrintModule,
  ],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(TenantMiddleware)
      .exclude(
        { path: 'api/auth/login', method: RequestMethod.POST },
        { path: 'api/auth/register', method: RequestMethod.POST },
        { path: 'api/auth/refresh', method: RequestMethod.POST },
        { path: 'api/menu/public/:slug', method: RequestMethod.GET },
        { path: 'api/integrations/webhook/:source', method: RequestMethod.POST },
      )
      .forRoutes('*');
  }
}
