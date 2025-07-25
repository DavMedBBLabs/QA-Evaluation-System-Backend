import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { IsEmail, IsNotEmpty, MinLength } from 'class-validator';
import { UserStage } from './UserStage';
import { EvaluationAttempt } from './EvaluationAttempt';
import { UserResponse } from './UserResponse';
import { Feedback } from './Feedback';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number = 0;

  @Column({ type: 'varchar', unique: true })
  @IsEmail()
  email: string = '';

  @Column({ name: 'password_hash', type: 'varchar' })
  @IsNotEmpty()
  @MinLength(6)
  passwordHash: string = '';

  @Column({ name: 'first_name', type: 'varchar' })
  @IsNotEmpty()
  firstName: string = '';

  @Column({ name: 'last_name', type: 'varchar' })
  @IsNotEmpty()
  lastName: string = '';

  @Column({ type: 'varchar', default: 'user' })
  role: string = 'user';

  @Column({ name: 'global_score', type: 'integer', default: 0 })
  globalScore: number = 0;

  @Column({ name: 'current_stage_id', type: 'integer', default: 1 })
  currentStageId: number = 1;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date = new Date();

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date = new Date();

  @OneToMany(() => UserStage, userStage => userStage.user)
  userStages: UserStage[];

  @OneToMany(() => EvaluationAttempt, attempt => attempt.user)
  evaluationAttempts: EvaluationAttempt[];

  @OneToMany(() => UserResponse, response => response.user)
  userResponses: UserResponse[];

  @OneToMany(() => Feedback, feedback => feedback.user)
  feedbacks: Feedback[];
}
