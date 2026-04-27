import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

@WebSocketGateway({
  cors: {
    origin: '*',
    credentials: true,
  },
  namespace: '/',
})
export class EventsGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(EventsGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  afterInit(server: Server) {
    this.logger.log('WebSocket Gateway başlatıldı');
  }

  async handleConnection(client: Socket) {
    try {
      const token =
        client.handshake.auth?.token ||
        client.handshake.headers?.authorization?.replace('Bearer ', '');

      if (!token) {
        client.disconnect();
        return;
      }

      const payload = this.jwtService.verify(token, {
        secret: this.configService.get<string>('JWT_SECRET'),
      });

      // Kullanıcıyı tenant odasına al
      client.join(`tenant:${payload.tenant_id}`);

      // Rol bazlı oda
      if (payload.role === 'kitchen') {
        client.join(`kitchen:${payload.tenant_id}`);
      }
      if (payload.role === 'courier') {
        client.join(`courier:${payload.tenant_id}`);
      }

      client.data.user = payload;
      this.logger.log(`Bağlandı: ${payload.email} (${payload.role})`);
    } catch {
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Bağlantı kesildi: ${client.id}`);
  }

  // ─── Belirli bir tenant'a yayın ───────────────────────────
  emitToTenant(tenantId: string, event: string, data: any) {
    this.server.to(`tenant:${tenantId}`).emit(event, data);
  }

  // ─── Mutfak ekranına yayın ────────────────────────────────
  emitToKitchen(tenantIdOrBranchId: string, event: string, data: any) {
    this.server.to(`kitchen:${tenantIdOrBranchId}`).emit(event, data);
    this.server.to(`tenant:${tenantIdOrBranchId}`).emit(event, data);
  }

  // ─── Client mesajlarını dinle ─────────────────────────────
  @SubscribeMessage('join_branch')
  handleJoinBranch(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { branchId: string },
  ) {
    const user = client.data.user;
    client.join(`branch:${data.branchId}`);
    
    // Mutfak personeli ise şubeye özel mutfak odasına katıl
    if (user?.role === 'kitchen' || user?.role === 'admin' || user?.role === 'manager') {
      client.join(`kitchen:${data.branchId}`);
      this.logger.log(`${user.email} mutfak odasına katıldı: ${data.branchId}`);
    }
    
    return { joined: data.branchId };
  }

  @SubscribeMessage('kitchen_item_ready')
  handleItemReady(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { itemId: string; orderId: string },
  ) {
    const user = client.data.user;
    this.emitToTenant(user.tenant_id, 'order.item_ready', data);
  }

  @SubscribeMessage('ping')
  handlePing() {
    return { pong: true, ts: Date.now() };
  }
}
