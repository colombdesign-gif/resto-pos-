import { Injectable, NestMiddleware, UnauthorizedException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tenant } from '../../modules/tenants/entities/tenant.entity';

declare global {
  namespace Express {
    interface Request {
      tenantId?: string;
      tenant?: Tenant;
    }
  }
}

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
  ) {}

  async use(req: Request, res: Response, next: NextFunction) {
    // JWT'den tenantId alınır (JwtStrategy'de set edilir)
    // Ya da X-Tenant-ID header'ından
    const tenantIdFromHeader = req.headers['x-tenant-id'] as string;

    if (tenantIdFromHeader) {
      const tenant = await this.tenantRepo.findOne({
        where: { id: tenantIdFromHeader, is_active: true },
      });
      if (!tenant) {
        throw new UnauthorizedException('Geçersiz veya pasif işletme');
      }
      req.tenantId = tenant.id;
      req.tenant = tenant;
    }

    next();
  }
}
