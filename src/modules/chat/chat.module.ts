import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { DatabaseModule } from '../../database/database.module.js';
import { ChatGateway } from './chat.gateway.js';
import { ChatService } from './chat.service.js';
import { ChatController } from './chat.controller.js';

@Module({
  imports: [DatabaseModule, JwtModule.register({})],
  controllers: [ChatController],
  providers: [ChatService, ChatGateway],
  exports: [ChatService, ChatGateway],
})
export class ChatModule {}
