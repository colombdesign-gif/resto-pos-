import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  async canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    try {
      // super.canActivate hem boolean dönebilir hem Promise dönebilir.
      // İçerisinde passport.authenticate('jwt') çalışır ve request.user'ı doldurur.
      const result = await super.canActivate(context);
      if (result) return true;
    } catch (err) {
      // Eğer rota public ise hata fırlatma, sadece request.user boş kalacaktır.
      if (isPublic) {
        return true;
      }
      throw err;
    }

    return isPublic;
  }
}
