-- AlterEnum
ALTER TYPE "GameEventType" ADD VALUE 'PLAYER_SENT_TO_JAIL';

-- AlterTable
ALTER TABLE "GamePlayerAssignment" ADD COLUMN     "isInJail" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "jailTurns" INTEGER NOT NULL DEFAULT 0;
