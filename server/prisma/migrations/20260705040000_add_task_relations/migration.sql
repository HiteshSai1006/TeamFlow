-- CreateEnum
CREATE TYPE "RelationType" AS ENUM ('BLOCKS');

-- AlterEnum
ALTER TYPE "ActivityEventType" ADD VALUE 'TASK_DEPENDENCY_ADDED';
ALTER TYPE "ActivityEventType" ADD VALUE 'TASK_DEPENDENCY_REMOVED';

-- CreateTable
CREATE TABLE "TaskRelation" (
    "id" SERIAL NOT NULL,
    "sourceTaskId" INTEGER NOT NULL,
    "targetTaskId" INTEGER NOT NULL,
    "type" "RelationType" NOT NULL DEFAULT 'BLOCKS',

    CONSTRAINT "TaskRelation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TaskRelation_sourceTaskId_targetTaskId_key" ON "TaskRelation"("sourceTaskId", "targetTaskId");

-- AddForeignKey
ALTER TABLE "TaskRelation" ADD CONSTRAINT "TaskRelation_sourceTaskId_fkey" FOREIGN KEY ("sourceTaskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskRelation" ADD CONSTRAINT "TaskRelation_targetTaskId_fkey" FOREIGN KEY ("targetTaskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
