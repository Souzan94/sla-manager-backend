import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'Holidays' })
export class Holidays {

  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column()
  domain: string;

@CreateDateColumn()
  startDate: Date;



@CreateDateColumn()
  endDate: Date;


}