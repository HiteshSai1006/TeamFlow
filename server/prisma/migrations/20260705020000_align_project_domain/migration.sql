-- Convert all existing OWNER ProjectMember roles to MANAGER
UPDATE "ProjectMember" SET "role" = 'MANAGER' WHERE "role"::text = 'OWNER';

-- AlterEnum
BEGIN;
CREATE TYPE "ProjectRole_new" AS ENUM ('MANAGER', 'MEMBER', 'REVIEWER');
ALTER TABLE "ProjectMember" ALTER COLUMN "role" TYPE "ProjectRole_new" USING ("role"::text::"ProjectRole_new");
ALTER TYPE "ProjectRole" RENAME TO "ProjectRole_old";
ALTER TYPE "ProjectRole_new" RENAME TO "ProjectRole";
DROP TYPE "ProjectRole_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "Project" DROP CONSTRAINT "Project_teamId_fkey";

-- DropForeignKey
ALTER TABLE "Team" DROP CONSTRAINT "Team_createdById_fkey";

-- AlterTable
ALTER TABLE "Project" DROP COLUMN "teamId";

-- DropTable
DROP TABLE "Team";