import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';


@Entity({ name: 'webhooks' })
export class Webhook {



 @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column()
  webhookId: string;

    @Column()
  domain: string;

}