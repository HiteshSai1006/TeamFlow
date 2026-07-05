-- CreateEnum
CREATE TYPE "RCASeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "RCAStatus" AS ENUM ('DRAFT', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'CLOSED');

-- CreateEnum
CREATE TYPE "RCASectionType" AS ENUM ('TIMELINE', 'CONTRIBUTING_FACTORS', 'CORRECTIVE_ACTIONS', 'PREVENTIVE_MEASURES');

-- CreateEnum
CREATE TYPE "ReviewDecision" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "RCA" (
    "id" SERIAL NOT NULL,
    "projectId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "severity" "RCASeverity" NOT NULL,
    "status" "RCAStatus" NOT NULL DEFAULT 'DRAFT',
    "reviewRound" INTEGER NOT NULL DEFAULT 1,
    "createdById" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RCA_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RCASection" (
    "id" SERIAL NOT NULL,
    "rcaId" INTEGER NOT NULL,
    "type" "RCASectionType" NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RCASection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Review" (
    "id" SERIAL NOT NULL,
    "rcaId" INTEGER NOT NULL,
    "reviewerId" INTEGER NOT NULL,
    "round" INTEGER NOT NULL,
    "decision" "ReviewDecision" NOT NULL DEFAULT 'PENDING',
    "comment" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RCASection_rcaId_type_key" ON "RCASection"("rcaId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "Review_rcaId_reviewerId_round_key" ON "Review"("rcaId", "reviewerId", "round");

-- AddForeignKey
ALTER TABLE "RCA" ADD CONSTRAINT "RCA_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RCA" ADD CONSTRAINT "RCA_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RCASection" ADD CONSTRAINT "RCASection_rcaId_fkey" FOREIGN KEY ("rcaId") REFERENCES "RCA"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_rcaId_fkey" FOREIGN KEY ("rcaId") REFERENCES "RCA"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
