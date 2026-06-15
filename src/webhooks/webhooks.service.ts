import { Injectable, OnModuleInit, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import axios from 'axios';
import { Webhook } from './webhooks.entity';
import { TriggersService } from '../triggers/triggers.service'; 

@Injectable()
export class WebhooksService implements OnModuleInit {

  constructor(
    @InjectRepository(Webhook)
    private webhookRepository: Repository<Webhook>,
      private triggersService: TriggersService,  
  ) {}

  // =========================================================
  // On App Startup
  // =========================================================
async onModuleInit() {

  const mainWebhookId = await this.createWebhook(
    'SLA_MAIN_WEBHOOK',
    process.env.WEBHOOK_ENDPOINT!
  );

  const pauseWebhookId = await this.createWebhook(
    'SLA_PAUSE_WEBHOOK',
    process.env.PAUSE_WEBHOOK_ENDPOINT!
  );

  const resumeWebhookId = await this.createWebhook(
    'SLA_RESUME_WEBHOOK',
    process.env.RESUME_WEBHOOK_ENDPOINT!
  );

  // create triggers
await this.triggersService.createPauseTrigger(pauseWebhookId);
await this.triggersService.createResumeTrigger(resumeWebhookId);
}

  // =========================================================
  // Ensure Webhook Exists (Run Once)
  // =========================================================
 async createWebhook(webhookName: string, endpoint: string): Promise<string> {
  try {

   const existingWebhook = await this.webhookRepository.findOne({
  where: {
    name: webhookName,
    domain: process.env.ZENDESK_SUBDOMAIN,
  },
});

if (existingWebhook) {
  console.log(`[WebhookService] ${webhookName} already exists for ${process.env.ZENDESK_SUBDOMAIN}.`);
  return existingWebhook.webhookId;
}

    console.log(`[WebhookService] Creating Zendesk webhook: ${webhookName}`);

    const payload = {
      webhook: {
        endpoint: endpoint,
        http_method: "POST",
        name: webhookName,
        request_format: "json",
        status: "active",
        subscriptions: ["conditional_ticket_events"],
      },
    };

    const response = await axios.post(
      `${this.getZendeskBaseUrl()}/webhooks`,
      payload,
      { headers: this.getAuthHeader() }
    );

    const webhookId = String(response.data.webhook.id);

    const webhook = this.webhookRepository.create({
      name: webhookName,
      webhookId: webhookId,
      domain: process.env.ZENDESK_SUBDOMAIN
    });

    await this.webhookRepository.save(webhook);

    console.log(`[WebhookService] ${webhookName} created successfully.`);

    return webhookId;   // ✅ return new ID

  } catch (error: any) {
    console.error(
      `[WebhookService] Failed to create ${webhookName}:`,
      error.response?.data || error.message
    );
    throw error;
  }
}



  // =========================================================
  // Zendesk Base URL
  // =========================================================
  private getZendeskBaseUrl(): string {
    return `https://${process.env.ZENDESK_SUBDOMAIN}.zendesk.com/api/v2`;
  }

  // =========================================================
  // Zendesk Auth Header
  // =========================================================
  private getAuthHeader() {
    const token = Buffer.from(
      `${process.env.ZENDESK_EMAIL}/token:${process.env.ZENDESK_API_TOKEN}`
    ).toString('base64');

    return {
      Authorization: `Basic ${token}`,
      'Content-Type': 'application/json',
    };
  }


  async getWebhook() {
    return this.webhookRepository.find();
  }




}
