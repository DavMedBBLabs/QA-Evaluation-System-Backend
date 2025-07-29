import { MigrationInterface, QueryRunner } from "typeorm";

export class AddQuestionFieldsSafe1711740000001 implements MigrationInterface {
    name = 'AddQuestionFieldsSafe1711740000001'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Check if columns already exist
        const hasTotalQuestions = await queryRunner.hasColumn('stages', 'total_questions');
        const hasOpenQuestions = await queryRunner.hasColumn('stages', 'open_questions');
        const hasClosedQuestions = await queryRunner.hasColumn('stages', 'closed_questions');

        if (!hasTotalQuestions) {
            await queryRunner.query(`ALTER TABLE "stages" ADD COLUMN "total_questions" integer DEFAULT 10`);
        }

        if (!hasOpenQuestions) {
            await queryRunner.query(`ALTER TABLE "stages" ADD COLUMN "open_questions" integer DEFAULT 5`);
        }

        if (!hasClosedQuestions) {
            await queryRunner.query(`ALTER TABLE "stages" ADD COLUMN "closed_questions" integer DEFAULT 5`);
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Check if columns exist before dropping
        const hasTotalQuestions = await queryRunner.hasColumn('stages', 'total_questions');
        const hasOpenQuestions = await queryRunner.hasColumn('stages', 'open_questions');
        const hasClosedQuestions = await queryRunner.hasColumn('stages', 'closed_questions');

        if (hasTotalQuestions) {
            await queryRunner.query(`ALTER TABLE "stages" DROP COLUMN "total_questions"`);
        }

        if (hasOpenQuestions) {
            await queryRunner.query(`ALTER TABLE "stages" DROP COLUMN "open_questions"`);
        }

        if (hasClosedQuestions) {
            await queryRunner.query(`ALTER TABLE "stages" DROP COLUMN "closed_questions"`);
        }
    }
} 