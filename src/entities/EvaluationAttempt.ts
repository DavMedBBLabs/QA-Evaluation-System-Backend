import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, OneToMany } from 'typeorm';
import { User } from './User';
import { Stage } from './Stage';
import { UserResponse } from './UserResponse';
import { Feedback } from './Feedback';

@Entity('evaluation_attempts')
export class EvaluationAttempt {
  @PrimaryGeneratedColumn()
  id: number = 0;

  @Column({ name: 'user_id', type: 'integer' })
  userId: number = 0;

  @Column({ name: 'stage_id', type: 'integer' })
  stageId: number = 0;

  @Column({ name: 'attempt_id', type: 'varchar', unique: true })
  attemptId: string = '';

  @Column({ name: 'start_time', type: 'timestamp' })
  startTime: Date = new Date();

  @Column({ name: 'end_time', type: 'timestamp', nullable: true })
  endTime: Date | null = null;

  @Column({ name: 'time_spent_seconds', type: 'integer', nullable: true })
  timeSpentSeconds: number | null = null;

  @Column({ type: 'integer', nullable: true })
  score: number | null = null;

  @Column({ name: 'is_completed', type: 'boolean', default: false })
  isCompleted: boolean = false;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date = new Date();

  @ManyToOne(() => User, user => user.evaluationAttempts)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => Stage, stage => stage.evaluationAttempts)
  @JoinColumn({ name: 'stage_id' })
  stage: Stage;

  @OneToMany(() => UserResponse, response => response.attempt)
  userResponses: UserResponse[];

  @OneToMany(() => Feedback, feedback => feedback.attempt)
  feedbacks: Feedback[];
}
