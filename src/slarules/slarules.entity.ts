import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn
} from 'typeorm';

@Entity('sla_rules')
export class SlaRule {

  @PrimaryGeneratedColumn()
  id: number;


  @Column({ type: 'varchar', length: 150 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;


  @Column()
  scheduleId: number;


    @Column({ type: 'bigint', nullable: true })
  zendeskTriggerId: string; // Store Zendesk trigger ID as string
 
  @Column({ type: 'bigint', nullable: true })
  zendeskBreachTriggerId: string; // Store Zendesk breach trigger ID as string

  @Column({ type: 'int' })
  totalResolutionTimeHours: number;

  @Column({ type: 'int' })
  warningTimeHours: number;


  @Column({ type: 'simple-array', nullable: true })
  breachTags: string[];

 
  @Column({ type: 'json', nullable: true })
  alertRecipients: {
    value: string;
    label: string;
    type: 'user' | 'group' | 'placeholder';
  }[];


  @Column({ type: 'varchar', length: 255, nullable: true })
  emailSubject: string;

  @Column({ type: 'text', nullable: true })
  emailBody: string;

@Column({ type: 'varchar', length: 50 })
createdBy: string;

    @Column()
  domain: string;


 
}