import { Injectable, InternalServerErrorException, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Trigger } from './triggers.entity';
import { Webhook } from '../webhooks/webhooks.entity';
import axios from 'axios';

@Injectable()
export class TriggersService implements OnModuleInit {

  constructor(
    @InjectRepository(Trigger)
    private triggerRepository: Repository<Trigger>,
    @InjectRepository(Webhook)
    private webhookRepository: Repository<Webhook>,
  ) {}

  // =========================================================
  // Helper: Zendesk Base URL
  // =========================================================
  private getZendeskBaseUrl(): string {
    return `https://${process.env.ZENDESK_SUBDOMAIN}.zendesk.com/api/v2`;
  }




  // =========================================================
  // Helper: Zendesk Auth Header
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


/// =========================================================
// Helper: Check existing trigger (to prevent duplicates)
// =========================================================
private async checkExistingTrigger(
  triggerName: string,
  categoryId?: number,
): Promise<Trigger | null> {

  const domain = process.env.ZENDESK_SUBDOMAIN;

  const existing = await this.triggerRepository.findOne({
    where: {
      name: triggerName,
      domain: domain,
    },
  });

  if (!existing) {
    return null;
  }

  console.log(`[TriggersService] ${triggerName} already exists for ${domain}.`);

  // update category if missing
  if (categoryId && !existing.categoryId) {
    existing.categoryId = categoryId;
    return await this.triggerRepository.save(existing);
  }

  return existing;
}




  // =========================================================
  // Global trigger (runs at app start)
  // =========================================================

  // Ensure the category for SLA triggers exists (creates if missing)
  private async ensureTriggerCategory(): Promise<number> {
    const name = 'SLA_APP_Triggers';
    try {
      // first check existing categories
      const listResp = await axios.get(
        `${this.getZendeskBaseUrl()}/trigger_categories.json`,
        { headers: this.getAuthHeader() }
      );
      const existing = (listResp.data.trigger_categories || []).find((c: any) => c.name === name);
      if (existing) {
        return existing.id;
      }
      // create new category
      const createResp = await axios.post(
        `${this.getZendeskBaseUrl()}/trigger_categories.json`,
        { trigger_category: { name } },
        { headers: this.getAuthHeader() }
      );
      return createResp.data.trigger_category.id;
    } catch (err: any) {
      console.error('[TriggersService] Failed to ensure trigger category:', err.response?.data || err.message);
      throw err;
    }
  }

  async onModuleInit() {
    console.log('[TriggersService] Initializing global trigger...');
    try {
      await this.createGlobalWarningTrigger();
    } catch (err: any) {
      console.error('[TriggersService] Failed to ensure global trigger:', err.message);
    }
  }

  private async createGlobalWarningTrigger(): Promise<Trigger> {
    // ensure category exists and we have its id
    const categoryId = await this.ensureTriggerCategory();

    const existing = await this.checkExistingTrigger(
  'SLA-Warning',
  categoryId,
);

if (existing) {
  return existing;
}

    const payload: any = {
      trigger: {
        title: 'SLA-Warning',
        description: 'Sending email to ticket assignee before SLA is breached.',
        category_id: categoryId,
        conditions: {
          all: [
            { field: 'current_tags', operator: 'includes', value: 'sla_warning_alert' },
            {field: 'current_tags', operator: 'not_includes', value: 'sla_warning_notified'},
            { field: 'update_type', operator: 'is', value: 'Change' },
          ],
          any: [],
        },
        actions: [
          {
            field: 'notification_group',
            value: [
              'group_id',
              'SLA-Warning',
              'SLA süresi dolmak üzere. Lütfen ticket\'ı çözün veya kapatın.',
            ],
          },
           {
                "field": "current_tags",
                "value": "sla_warning_notified"
            }
        ],
      },
    };

    try {
      const response = await axios.post(
        `${this.getZendeskBaseUrl()}/triggers.json`,
        payload,
        { headers: this.getAuthHeader() }
      );

      const triggerId = String(response.data.trigger.id);

      const trigger = this.triggerRepository.create({
        name: 'SLA-Warning',
        zendeskTriggerId: triggerId,
        isActive: true,
        categoryId,
        domain: process.env.ZENDESK_SUBDOMAIN
      });

      return await this.triggerRepository.save(trigger);

    } catch (error: any) {
      console.error(
        '[TriggersService] Failed to create global trigger:',
        error.response?.data || error.message
      );
      throw error;
    }
  }


  private mapAlertRecipients(alertRecipients: any[]) {
  return {
    users: (alertRecipients || [])
      .filter(r => r.type === 'user')
      .map(r => r.value),
    groups: (alertRecipients || [])
      .filter(r => r.type === 'group')
      .map(r => r.value),
    placeholders: (alertRecipients || [])
      .filter(r => r.type === 'placeholder')
      .map(r => r.value),
  };
}

  // =========================================================
  //     trigger for pausing SLA 
  // =========================================================

async createPauseTrigger(pauseWebhookId: string): Promise<Trigger> {
  const categoryId = await this.ensureTriggerCategory();
  // Check if trigger already exists
const existing = await this.checkExistingTrigger(
  'SLA_Pause_Trigger',
  categoryId,
);

if (existing) {
  return existing;
}

  const payload = {
    trigger: {
      title: 'SLA Pause Trigger',
      description: 'Pause SLA jobs when ticket is changed from Open to Pending',
      category_id: categoryId,
      conditions: {
        all: [
        
 { field: 'status', operator: 'value', value: 'pending' }, // this triggers when status changes to pending
    { field: 'status', operator: 'value_previous', value: 'open' }, // track previous status
    { field: 'current_tags', operator: 'includes', value: 'sla_rule_applied' }// check tag
          
        ],
        any: [],
      },
      actions: [
        {
          field: 'notification_webhook',
          value: [
            pauseWebhookId,
            JSON.stringify({
              payload: {
                ticket: '{{ticket.id}}',
                domain: process.env.ZENDESK_SUBDOMAIN,
              },
            }),
          ],
        },
      ],
    },
  };

  try {
    const response = await axios.post(
      `${this.getZendeskBaseUrl()}/triggers.json`,
      payload,
      { headers: this.getAuthHeader() }
    );

    const trigger = this.triggerRepository.create({
      name: 'SLA_Pause_Trigger',
      zendeskTriggerId: String(response.data.trigger.id),
      isActive: true,
      categoryId,
      domain: process.env.ZENDESK_SUBDOMAIN
    });

    return await this.triggerRepository.save(trigger); // simplified

  } catch (error: any) {
  console.error(
    '[TriggersService] Failed to create Pause trigger:',
    JSON.stringify(error.response?.data, null, 2) || error.message
  );
  throw new Error(`Failed to create Pause trigger: ${error.message}`);
}
}


 // =========================================================
  //     triggr for resuming SLA
  // =========================================================

async createResumeTrigger(resumeWebhookId: string): Promise<Trigger> {
  const categoryId = await this.ensureTriggerCategory();

  // Check if trigger already exists
  const existing = await this.checkExistingTrigger(
  'SLA_Resume_Trigger',
  categoryId,
);

if (existing) {
  return existing;
}

  const payload = {
    trigger: {
      title: 'SLA Resume Trigger',
      description: 'Resume SLA jobs when ticket is changed from Pending to Open',
      category_id: categoryId,
      conditions: {
        all: [
          { field: 'status', operator: 'changed', value: 'open' },
    { field: 'status', operator: 'value_previous', value: 'pending' },
    { field: 'current_tags', operator: 'includes', value: 'sla_rule_applied'}
        ],
        any: [],
      },
      actions: [
        {
          field: 'notification_webhook',
          value: [
            resumeWebhookId,
            JSON.stringify({
              payload: {
                ticket: '{{ticket.id}}',
                domain: process.env.ZENDESK_SUBDOMAIN,
              },
            }),
          ],
        },
      ],
    },
  };

  try {
    const response = await axios.post(
      `${this.getZendeskBaseUrl()}/triggers.json`,
      payload,
      { headers: this.getAuthHeader() }
    );

    const trigger = this.triggerRepository.create({
      name: 'SLA_Resume_Trigger',
      zendeskTriggerId: String(response.data.trigger.id),
      isActive: true,
      categoryId,
      domain: process.env.ZENDESK_SUBDOMAIN
    });

    return await this.triggerRepository.save(trigger);

  } catch (error: any) {
    console.error(
      '[TriggersService] Failed to create Resume trigger:',
      error.response?.data || error.message
    );
    throw new Error(`Failed to create Resume trigger: ${error.message}`);
  }
}



  // =========================================================
  // Per-rule trigger (called from SlaRulesService)
  // =========================================================
  async createTriggerForRule(ruleData: any): Promise<string> {
    console.log('Creating trigger for rule:', ruleData);

    // make sure we have the category (same as global)
    const categoryId = await this.ensureTriggerCategory();

    const { users, groups, placeholders } =
     this.mapAlertRecipients(ruleData.alertRecipients);
    // 1) Try to get webhookId from DB by name (prefer rule-specific webhook)
    const webhookName = `SLA_MAIN_WEBHOOK`;
    let webhookId: string | undefined;

    try {
const dbWebhook = await this.webhookRepository.findOne({
    where: {
      name: webhookName,
      domain: process.env.ZENDESK_SUBDOMAIN
    },
  });
      if (dbWebhook) {
        webhookId = dbWebhook.webhookId;
        console.log('[TriggersService] Using webhookId from DB for', webhookName, webhookId);
      } 
    } catch (dbErr: any) {
      console.warn('[TriggersService] Error querying webhook DB:', dbErr.message || dbErr);
    }


    // Ensure the SLA breach tag for this rule is included in onBreachTags
    const ruleId = ruleData.ruleId ?? ruleData.id ?? undefined;
    const onBreachTags = Array.from(
      new Set([...(ruleData.breachTags || []), ...(ruleId ? [`sla_breach_${ruleId}`] : [])])
    );

    const payload: any = {
      trigger: {
        title: `SLA: ${ruleData.name}`,
        description: ruleData.description,
        category_id: categoryId,
        conditions: {
          all: [{ field: 'update_type', operator: 'is', value: 'Create' }],
          any: [],
        },
        actions: [
          {
            field: 'notification_webhook',
            value: [
              webhookId,
              JSON.stringify({
                payload: {
                  Item: {
                    ticket: '{{ticket.id}}',
                    scheduleId: ruleData.scheduleId,
                    responseTime: ruleData.totalResolutionTimeHours,
                    warningTime: ruleData.warningTimeHours,
                    domain: process.env.ZENDESK_SUBDOMAIN,
                    createdDate: '{{ticket.created_at_with_timestamp}}',
                    timeZone: ruleData.timeZone,
                    appId: ruleData.appId,
                    onBreachTags,
                    users: users || [],
                    groups: groups || [],
                    placeholders: placeholders || [],
                  },
                },
              }),
            ],
          },
          {
  field: 'current_tags',
  value: ['sla_rule_applied'],
},
        ],
      },
    };

    try {
      const response = await axios.post(
        `${this.getZendeskBaseUrl()}/triggers.json`,
        payload,
        { headers: this.getAuthHeader() }
      );

      const triggerId = String(response.data.trigger.id);

      const trigger = this.triggerRepository.create({
        name: `SLA: ${ruleData.name}`,
        zendeskTriggerId: triggerId,
        isActive: true,
        categoryId,
        domain: process.env.ZENDESK_SUBDOMAIN
      });

      await this.triggerRepository.save(trigger);

      return triggerId;

    } catch (error: any) {
      console.error(
        `[TriggersService] Failed to create trigger for rule "${ruleData.name}":`,
        error.response?.data || error.message
      );
      throw error;
    }
  }




async updateTriggerForRule(triggerId: string, ruleData: any) {
  try {
    const url = `${this.getZendeskBaseUrl()}/triggers/${triggerId}.json`;

    // 1️⃣ Fetch the existing trigger
    const existingTriggerRes = await axios.get(url, { headers: this.getAuthHeader() });
    const existingTrigger = existingTriggerRes.data.trigger;

    // 2️⃣ Extract the webhook payload JSON string and parse it
    const webhookPayloadStr = existingTrigger.actions[0].value[1];
    const webhookPayload = JSON.parse(webhookPayloadStr);

    // 3️⃣ Map alertRecipients to users/groups/placeholders
    const { users, groups, placeholders } = this.mapAlertRecipients(ruleData.alertRecipients);

    // 4️⃣ Update only SLA-specific fields inside the payload
    webhookPayload.payload.Item.scheduleId = ruleData.scheduleId;
    webhookPayload.payload.Item.responseTime = ruleData.totalResolutionTimeHours;
    webhookPayload.payload.Item.warningTime = ruleData.warningTimeHours;
    webhookPayload.payload.Item.onBreachTags = ruleData.breachTags || [];
    webhookPayload.payload.Item.users = users;
    webhookPayload.payload.Item.groups = groups;
    webhookPayload.payload.Item.placeholders = placeholders;

    // 5️⃣ Stringify the updated payload back into the action
    existingTrigger.actions[0].value[1] = JSON.stringify(webhookPayload);
console.log('Updated webhook payload:', existingTrigger.actions[0].value[1]);
    // 6️⃣ Update the trigger title
    const updatedTrigger = {
      trigger: {
        ...existingTrigger,
        title: `SLA: ${ruleData.name}`,
      },
    };

    // 7️⃣ Send the update request to Zendesk
    await axios.put(url, updatedTrigger, { headers: this.getAuthHeader() });

    console.log(`[TriggersService] Trigger ${triggerId} updated successfully`);
  } catch (error) {
    console.error(
      `[TriggersService] Failed to update trigger ${triggerId}:`,
      error.response?.data || error.message
    );
    throw new Error('Failed to update Zendesk trigger');
  }
}


/////=========================================================    
// SLA-breach trigger (Triggered  when SLA rule is breached)
////=========================================================

async createBreachTriggerForRule(
  ruleData: any,
  ruleId: number
): Promise<string> {
  try {
    // ensure category available
    const categoryId = await this.ensureTriggerCategory();
    const payload: any = this.buildBreachTriggerPayload(ruleData, ruleId);
    payload.trigger.category_id = categoryId;

    const response = await axios.post(
      `${this.getZendeskBaseUrl()}/triggers.json`,
      payload,
      { headers: this.getAuthHeader() }
    );

    const triggerId = String(response.data.trigger.id);

    console.log(
      `[TriggersService] SLA-breach trigger created: ${triggerId}`
    );

    // Save in DB
    const trigger = this.triggerRepository.create({
      name: `SLA_Breached: ${ruleData.name}`,
      zendeskTriggerId: triggerId,
      isActive: true,
      categoryId,
      domain: process.env.ZENDESK_SUBDOMAIN
    });

    await this.triggerRepository.save(trigger);

    return triggerId;
  } catch (error) {
    console.error(
      `[TriggersService] Failed to create SLA-breach trigger for rule ${ruleData.name}:`,
      error.response?.data || error.message
    );
    throw error;
  }
}


///=========================================================
 // Update breach trigger (called when SLA rule is updated)
//=========================================================
async updateBreachTriggerForRule(
  triggerId: string,
  ruleData: any,
  ruleId: number
): Promise<void> {
  try {
    const payload = this.buildBreachTriggerPayload(ruleData, ruleId);

    await axios.put(
      `${this.getZendeskBaseUrl()}/triggers/${triggerId}.json`,
      payload,
      { headers: this.getAuthHeader() }
    );

    console.log(
      `[TriggersService] SLA-breach trigger updated: ${triggerId}`
    );
  } catch (error) {
    console.error(
      `[TriggersService] Failed to update SLA-breach trigger ${triggerId}:`,
      error.response?.data || error.message
    );
    throw error;
  }
}
///=========================================================
// build payload for breach trigger
//=========================================================



private buildBreachTriggerPayload(ruleData: any, ruleId: number) {
  const tag = `sla_breach_${ruleId}`;

  const { users, groups, placeholders } =
    this.mapAlertRecipients(ruleData.alertRecipients);

  const subject =
    ruleData.emailSubject || `SLA Breached: ${ruleData.name}`;

  const body =
    ruleData.emailBody ||
    `SLA for rule ${ruleData.name} has been breached.`;

  const actions: any[] = [];

  users.forEach(userId => {
    actions.push({
      field: "notification_user",
      value: [userId, subject, body],
    });
  });

  groups.forEach(groupId => {
    actions.push({
      field: "notification_group",
      value: [groupId, subject, body],
    });
  });

  placeholders.forEach(ph => {
    let placeholderValue;

    if (ph === "assignee") placeholderValue = "assignee_id";
    else if (ph === "current_user") placeholderValue = "current_user";
    else if (ph === "requester") placeholderValue = "requester_id";

    actions.push({
      field: "notification_user",
      value: [placeholderValue, subject, body],
    });
  });
 actions.push({
  
  field: "current_tags",
 value: "sla_breached_notified"
    });


  return {
    trigger: {
      title: `SLA-Breached - ${ruleData.name}`,
      description: `Send notification to selected recipients when SLA expires.`,
      conditions: {
        all: [
          {
            field: "current_tags",
            operator: "includes",
            value: tag,
          },
         {field: 'current_tags', 
          operator: 'not_includes',
           value: 'sla_breached_notified'},
          {
            field: "update_type",
            operator: "is",
            value: "Change",
          },
        ],
        any: [],
      },
      actions,
    },
  };
}

  
async deleteTrigger(triggerId: string) {
  try {
    const domain = process.env.ZENDESK_SUBDOMAIN;

    const url = `${this.getZendeskBaseUrl()}/triggers/${triggerId}.json`;

    // 1️⃣ Delete trigger from Zendesk
    await axios.delete(url, { headers: this.getAuthHeader() });

    // 2️⃣ Delete trigger from DB for the same domain
    const existing = await this.triggerRepository.findOne({
      where: {
        zendeskTriggerId: triggerId,
        domain: domain,
      },
    });

    if (existing) {
      await this.triggerRepository.delete(existing.id);
      console.log(
        `[TriggersService] Trigger ${triggerId} deleted from DB for domain ${domain}`
      );
    } else {
      console.log(
        `[TriggersService] Trigger ${triggerId} not found in DB for domain ${domain}`
      );
    }

  } catch (error) {
    console.error(
      'Failed to delete Zendesk trigger:',
      error.response?.data || error.message
    );

    throw new InternalServerErrorException(
      'Failed to delete Zendesk trigger'
    );
  }
}
}