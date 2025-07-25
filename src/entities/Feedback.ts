import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { EvaluationAttempt } from './EvaluationAttempt';
import { User } from './User';
import { Stage } from './Stage';

@Entity('feedback')
export class Feedback {
  @PrimaryGeneratedColumn()
  id: number = 0;

  @Column({ name: 'attempt_id', type: 'integer' })
  attemptId: number = 0;

  @Column({ name: 'user_id', type: 'integer' })
  userId: number = 0;

  @Column({ name: 'stage_id', type: 'integer' })
  stageId: number = 0;

  @Column({ type: 'integer' })
  score: number = 0;

  @Column({ name: 'total_questions', type: 'integer' })
  totalQuestions: number = 0;

  @Column({ name: 'correct_answers', type: 'integer' })
  correctAnswers: number = 0;

  @Column({ type: 'text', array: true })
  strengths: string[] = [];

  @Column({ type: 'text', array: true })
  improvements: string[] = [];

  @Column({ name: 'next_steps', type: 'text' })
  nextSteps: string = '';

  @Column({ name: 'detailed_feedback', type: 'text' })
  detailedFeedback: string = '';

  @Column({ type: 'varchar', nullable: true })
  badge: string | null = null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date = new Date();

  @ManyToOne(() => EvaluationAttempt, attempt => attempt.feedbacks)
  @JoinColumn({ name: 'attempt_id' })
  attempt: EvaluationAttempt = new EvaluationAttempt();

  @ManyToOne(() => User, user => user.feedbacks)
  @JoinColumn({ name: 'user_id' })
  user: User = new User();

  @ManyToOne(() => Stage)
  @JoinColumn({ name: 'stage_id' })
  stage: Stage = new Stage();
}
