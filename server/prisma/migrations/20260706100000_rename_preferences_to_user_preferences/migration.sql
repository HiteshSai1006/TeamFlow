-- Rename existing table
ALTER TABLE "UserNotificationPreference" RENAME TO "UserPreference";

-- Rename constraints and indexes
ALTER TABLE "UserPreference" RENAME CONSTRAINT "UserNotificationPreference_pkey" TO "UserPreference_pkey";
ALTER TABLE "UserPreference" RENAME CONSTRAINT "UserNotificationPreference_userId_fkey" TO "UserPreference_userId_fkey";
ALTER INDEX "UserNotificationPreference_userId_key" RENAME TO "UserPreference_userId_key";

-- Create Enum
CREATE TYPE "ThemeMode" AS ENUM ('LIGHT', 'DARK');

-- Add new columns
ALTER TABLE "UserPreference" ADD COLUMN "theme" "ThemeMode" NOT NULL DEFAULT 'LIGHT';
ALTER TABLE "UserPreference" ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
