import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TriggersModule } from './triggers/triggers.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { HolidaysModule } from './holidays/holidays.module';
import { SchedulesModule } from './schedules/schedules.module';
import { SlarulesModule } from './slarules/slarules.module';
import { SlaJobsModule } from './sla-jobs/sla-jobs.module';
import { BullModule } from '@nestjs/bull';
import { SlaJobsProcessor } from './sla-jobs/sla-jobs.processor';
import { AuthModule } from './auth/auth.module';


@Module({
  imports: [
    // ✅ Load .env file globally
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    // ✅ Database
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('DB_HOST'),
        port: configService.get<number>('DB_PORT'),
        username: configService.get<string>('DB_USERNAME'),
        password: configService.get<string>('DB_PASSWORD'),
        database: configService.get<string>('DB_DATABASE'),
        autoLoadEntities: true,
        synchronize:
          configService.get<string>('TYPEORM_SYNCHRONIZE') === 'true',
      }),
    }),

    //  (Redis connection)
  BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        redis: {
          host: configService.get<string>('REDIS_HOST'),
          port: configService.get<number>('REDIS_PORT'),
        },
      }),
    }),

    TriggersModule,
    WebhooksModule,
    HolidaysModule,
    SchedulesModule,
    SlarulesModule,
    SlaJobsModule,
    AuthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}