import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('scheduled_jobs')
export class ScheduledJob {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  ticketId: string;

  @Column()
  domain: string;

  @Column()
  type: 'warning' | 'breach';

  @Column({ type: 'timestamp' })
  executeAt: Date;

  @Column({ default: 'pending' })
  status: 'pending' | 'completed' | 'failed' | 'paused';

  @Column()
  jobId: string;
  
  @Column({ type: 'simple-array', nullable: true })
  breachTags: string[];

  // --- New fields for pause/resume ---
@Column({
  type: 'bigint',
  nullable: true,
  transformer: {
    to: (value: number | null) => value,
    from: (value: string | null) => (value !== null ? Number(value) : null),
  },
})
remainingDelayMs: number | null;

@Column({ type: 'timestamp', nullable: true })
pausedAt: Date | null;
}