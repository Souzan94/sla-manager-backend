import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SlaRule } from './slarules.entity';
import { NotFoundException } from '@nestjs/common';
import { TriggersService } from '../triggers/triggers.service'; 
@Injectable()
export class SlarulesService {

constructor(
  @InjectRepository(SlaRule)
  private ruleRepository: Repository<SlaRule>,
  private triggersService: TriggersService,  
) {}



async addSLARule(data: any) {
  try {
    // 1️⃣ Save SLA rule to DB first (no Zendesk trigger IDs yet)
    const newRule = this.ruleRepository.create({
      name: data.name,
      description: data.description,
      scheduleId: data.scheduleId,
      totalResolutionTimeHours: data.totalResolutionTimeHours,
      warningTimeHours: data.warningTimeHours,
      breachTags: data.breachTags,
      alertRecipients: data.alertRecipients,
      emailSubject: data.emailSubject,
      emailBody: data.emailBody,
      createdBy: data.createdBy,
      domain: data.domain,
    });

    const savedRule = await this.ruleRepository.save(newRule);

    // 2️⃣ Create Zendesk trigger for this SLA rule and include the saved rule id
    const triggerPayload = {
      name: data.name,
      description: data.description,
      scheduleId: data.scheduleId,
      totalResolutionTimeHours: data.totalResolutionTimeHours,
      warningTimeHours: data.warningTimeHours,
      breachTags: data.breachTags || [],
      alertRecipients: data.alertRecipients || [],
      timeZone: data.timeZone,
      appId: data.appId,
      ruleId: savedRule.id,
    };

    const triggerId = await this.triggersService.createTriggerForRule(triggerPayload);

    // 3️⃣ Persist the Zendesk trigger id on the saved rule
    savedRule.zendeskTriggerId = String(triggerId);
    await this.ruleRepository.save(savedRule);

    // 4️⃣ Create SLA-breach trigger (pass original data and saved rule id)
    const breachTriggerId = await this.triggersService.createBreachTriggerForRule(
      data,
      savedRule.id,
    );

    savedRule.zendeskBreachTriggerId = breachTriggerId;
    await this.ruleRepository.save(savedRule);

    return {
      message: 'Rule created successfully',
      data: savedRule,
    };

  } catch (error) {
    console.error('Error creating SLA rule and trigger:', error);
    throw error;
  }
}

async getSLARules(domain?: string) {
  try {
    const findOptions: any = {
      order: { id: 'DESC' }, // newest first
    };

    if (domain) {
      findOptions.where = { domain };
    }

    const rules = await this.ruleRepository.find(findOptions);

    return rules;

  } catch (error) {
    console.error('Error fetching SLA rules:', error);
    throw error;
  }
}



 async deleteRule(id: number) {
    // 1️⃣ Find the rule
    const rule = await this.ruleRepository.findOne({ where: { id } });
    if (!rule) throw new NotFoundException(`SLA Rule ${id} not found`);

    const zendeskTriggerId = rule.zendeskTriggerId;
const zendeskBreachTriggerId = rule.zendeskBreachTriggerId;
    // 2️⃣ Delete the trigger if it exists
    if (zendeskTriggerId) {
      await this.triggersService.deleteTrigger(zendeskTriggerId);
    }
    if (zendeskBreachTriggerId) { 
      await this.triggersService.deleteTrigger(zendeskBreachTriggerId);
    }


    // 3️⃣ Delete the rule from DB
    const result = await this.ruleRepository.delete(id);
    if (result.affected === 0)
      throw new NotFoundException(`SLA Rule ${id} not found`);

    return { message: 'SLA Rule deleted successfully' };
  }





async updateRule(id: number, updateData: any) {
  const existingRule = await this.ruleRepository.findOne({ where: { id } });

  if (!existingRule) {
    throw new Error(`Rule with ID ${id} not found`);
  }

  // 1️⃣ Update the trigger in Zendesk if it exists
  if (existingRule.zendeskTriggerId) {
    await this.triggersService.updateTriggerForRule(
      existingRule.zendeskTriggerId,
      updateData
    );
  }
   if (existingRule.zendeskBreachTriggerId) {
    await this.triggersService.updateBreachTriggerForRule(
      existingRule.zendeskBreachTriggerId,
      updateData,
      existingRule.id
    );
  }

  // 2️⃣ Update the rule in DB
  Object.assign(existingRule, updateData);
  const updatedRule = await this.ruleRepository.save(existingRule);

  return {
    message: 'Rule updated successfully',
    data: updatedRule,
  };
}


}
