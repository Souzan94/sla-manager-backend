
import { Controller,Get,Post,Delete,Put,Param, Body, Query,UseGuards } from '@nestjs/common';
import { SlarulesService } from './slarules.service';
import { JwtGuard } from '../guards/jwt.guard'; // JWT guard instead of API key

@Controller('slaRules')
export class SlarulesController {


    constructor(private readonly slaRuleService: SlarulesService) {}

@UseGuards(JwtGuard)
 @Post('add')
    addSLARule(@Body() body: any) {
    return this.slaRuleService.addSLARule(body);
  }

@UseGuards(JwtGuard)
@Get()
  getSLARules(@Query('domain') domain?: string) {
    return this.slaRuleService.getSLARules(domain);
  }

@UseGuards(JwtGuard)
  @Put(':id')
  updateRule(
    @Param('id') id: string,
    @Body() updateData: any,
  ) {
    return this.slaRuleService.updateRule(+id, updateData);
  }
 
@UseGuards(JwtGuard)
  @Delete(':id')
  deleteRule(@Param('id') id: number) {
    return this.slaRuleService.deleteRule(+id);
  }
    
}
