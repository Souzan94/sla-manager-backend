import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('zendesk_triggers') 
export class Trigger {

  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'bigint' })  // <- change here
  zendeskTriggerId: string;    // <- also change type to string

  @Column()
  name: string;

  @Column({ default: false })
  isActive: boolean;

  // keep track of the Zendesk trigger category used for global rules
  @Column({ type: 'bigint', nullable: true })
  categoryId?: number;

    @Column()
    domain: string;
}