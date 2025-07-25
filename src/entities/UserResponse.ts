import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { EvaluationAttempt } from './EvaluationAttempt';
import { Question } from './Question';
import { User } from './User';

@Entity('user_responses')
export class UserResponse {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => EvaluationAttempt, attempt => attempt.userResponses, { nullable: false })
  @JoinColumn({ name: 'attempt_id' })
  attempt: EvaluationAttempt;

  @ManyToOne(() => Question, question => question.userResponses, { nullable: false })
  @JoinColumn({ name: 'question_id' })
  question: Question;

  @ManyToOne(() => User, user => user.userResponses, { nullable: false })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'text' })
  response: string;

  @Column({ name: 'is_correct', type: 'boolean', nullable: true })
  isCorrect: boolean | null;

  @Column({ name: 'points_earned', type: 'integer', default: 0 })
  pointsEarned: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;
}