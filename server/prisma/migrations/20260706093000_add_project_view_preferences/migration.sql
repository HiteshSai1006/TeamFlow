-- CreateEnum
CREATE TYPE "TaskViewMode" AS ENUM ('KANBAN', 'CALENDAR', 'LIST');

-- CreateTable
CREATE TABLE "ProjectViewPreference" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "projectId" INTEGER NOT NULL,
    "viewMode" "TaskViewMode" NOT NULL DEFAULT 'KANBAN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectViewPreference_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProjectViewPreference_userId_projectId_key" ON "ProjectViewPreference"("userId", "projectId");

-- AddForeignKey
ALTER TABLE "ProjectViewPreference" ADD CONSTRAINT "ProjectViewPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectViewPreference" ADD CONSTRAINT "ProjectViewPreference_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
