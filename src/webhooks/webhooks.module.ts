import { Module } from '@nestjs/common';
import { WebhooksController } from './webhooks.controller';
import { WebhooksService } from './webhooks.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Webhook } from './webhooks.entity';
import { TriggersModule } from '../triggers/triggers.module'; 

@Module({

 imports: [TypeOrmModule.forFeature([Webhook]),TriggersModule],
  controllers: [WebhooksController],
  providers: [WebhooksService]
})
export class WebhooksModule {}
