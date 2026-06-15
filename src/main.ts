import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

import { ExpressAdapter } from '@bull-board/express';
import { createBullBoard } from '@bull-board/api';
import { BullAdapter } from '@bull-board/api/bullAdapter';

import { getQueueToken } from '@nestjs/bull';
import type { Queue } from 'bull';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Optional but recommended
  app.enableCors();

  // Get your queue instance
  const slaQueue = app.get<Queue>(getQueueToken('sla-queue'));

  // Setup Bull Board
  const serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath('/admin/queues');

  createBullBoard({
    queues: [new BullAdapter(slaQueue)],
    serverAdapter,
  });

  app.use('/admin/queues', serverAdapter.getRouter());

  // IMPORTANT: listen on 0.0.0.0 for ngrok
  await app.listen(process.env.PORT || 3001, '0.0.0.0');
}
bootstrap();