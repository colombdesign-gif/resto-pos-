import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { User } from '../users/entities/user.entity';
import { Tenant } from '../tenants/entities/tenant.entity';
import { RegisterDto, LoginDto, RefreshTokenDto } from './dto/auth.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly dataSource: DataSource,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.userRepo.findOne({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('Bu e-posta adresi zaten kullanımda');
    }

    const slug = this.generateSlug(dto.businessName);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Tenant oluştur
      const tenant = queryRunner.manager.create(Tenant, {
        name: dto.businessName,
        slug,
        plan: 'trial',
      });
      await queryRunner.manager.save(tenant);

      // Admin kullanıcı oluştur
      const passwordHash = await bcrypt.hash(dto.password, 12);
      const user = queryRunner.manager.create(User, {
        tenant_id: tenant.id,
        email: dto.email,
        name: dto.name,
        phone: dto.phone,
        password_hash: passwordHash,
        role: 'admin',
      });
      await queryRunner.manager.save(user);

      // Varsayılan şube oluştur
      await queryRunner.manager.query(
        `INSERT INTO branches (tenant_id, name, is_active) VALUES ($1, $2, true)`,
        [tenant.id, dto.businessName],
      );

      await queryRunner.commitTransaction();

      const tokens = await this.generateTokens(user);

      return {
        user: this.sanitizeUser(user),
        tenant,
        ...tokens,
      };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async login(dto: LoginDto) {
    const user = await this.userRepo.findOne({
      where: { email: dto.email },
    });

    if (!user || !user.is_active) {
      throw new UnauthorizedException('E-posta veya şifre hatalı');
    }

    const isMatch = await bcrypt.compare(dto.password, user.password_hash);
    if (!isMatch) {
      throw new UnauthorizedException('E-posta veya şifre hatalı');
    }

    // Son giriş güncelle
    await this.userRepo.update(user.id, { last_login: new Date() });

    const tokens = await this.generateTokens(user);

    const tenant = await this.tenantRepo.findOne({
      where: { id: user.tenant_id },
    });

    return {
      user: this.sanitizeUser(user),
      tenant,
      ...tokens,
    };
  }

  async refreshToken(dto: RefreshTokenDto) {
    try {
      const payload = this.jwtService.verify(dto.refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      });

      const user = await this.userRepo.findOne({
        where: { id: payload.sub, is_active: true },
      });

      if (!user) {
        throw new UnauthorizedException('Geçersiz token');
      }

      return this.generateTokens(user);
    } catch {
      throw new UnauthorizedException('Token geçersiz veya süresi dolmuş');
    }
  }

  async getMe(userId: string) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('Kullanıcı bulunamadı');

    const tenant = await this.tenantRepo.findOne({
      where: { id: user.tenant_id },
    });

    return { user: this.sanitizeUser(user), tenant };
  }

  private async generateTokens(user: User) {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      tenant_id: user.tenant_id,
    };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_SECRET'),
      expiresIn: this.configService.get<string>('JWT_EXPIRES_IN') || '15m',
    });

    const refreshToken = this.jwtService.sign(
      { sub: user.id },
      {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
        expiresIn:
          this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') || '7d',
      },
    );

    return { accessToken, refreshToken };
  }

  private sanitizeUser(user: User) {
    const { password_hash, ...rest } = user as any;
    return rest;
  }

  private generateSlug(name: string): string {
    return (
      name
        .toLowerCase()
        .replace(/ğ/g, 'g')
        .replace(/ü/g, 'u')
        .replace(/ş/g, 's')
        .replace(/ı/g, 'i')
        .replace(/ö/g, 'o')
        .replace(/ç/g, 'c')
        .replace(/[^a-z0-9]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '') +
      '-' +
      Math.random().toString(36).substr(2, 6)
    );
  }
}
