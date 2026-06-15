import { Controller ,Get,Post, Body} from '@nestjs/common';
import { WebhooksService } from './webhooks.service';

@Controller('webhooks')
export class WebhooksController {

constructor(private readonly webhookService: WebhooksService) {}




  @Get()
  getWebhook() {
    return this.webhookService.getWebhook();
  }






}
