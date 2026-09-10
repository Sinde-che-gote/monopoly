-- CreateEnum
CREATE TYPE "CommunityChestAction" AS ENUM ('RECEIVE_MONEY', 'PAY_MONEY', 'MOVE_TO_GO', 'MOVE_TO_JAIL', 'GET_OUT_OF_JAIL');

-- CreateTable
CREATE TABLE "CommunityChestCard" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" INTEGER NOT NULL DEFAULT 0,
    "action" "CommunityChestAction" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommunityChestCard_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CommunityChestCard_action_idx" ON "CommunityChestCard"("action");

-- CreateIndex
CREATE INDEX "CommunityChestCard_isActive_idx" ON "CommunityChestCard"("isActive");
