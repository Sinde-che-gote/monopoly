/*
  Warnings:

  - You are about to drop the `TestConnection` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "GameStatus" AS ENUM ('SETUP', 'ACTIVE', 'PAUSED', 'COMPLETED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "PawnStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'LOST', 'RETIRED');

-- CreateEnum
CREATE TYPE "DeviceType" AS ENUM ('ANDROID_NFC', 'LAPTOP', 'TABLET', 'USB_NFC', 'WEB_NFC', 'DEMO');

-- CreateEnum
CREATE TYPE "PositionType" AS ENUM ('GO', 'PROPERTY', 'RAILROAD', 'UTILITY', 'TAX', 'CHANCE', 'COMMUNITY_CHEST', 'JAIL', 'FREE_PARKING', 'GO_TO_JAIL', 'OTHER');

-- CreateEnum
CREATE TYPE "PropertyType" AS ENUM ('PROPERTY', 'RAILROAD', 'UTILITY');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('BANK_TO_PLAYER', 'PLAYER_TO_BANK', 'PLAYER_TO_PLAYER', 'RENT', 'TAX', 'FINE', 'GO_PAYMENT', 'PROPERTY_PURCHASE', 'PROPERTY_SALE', 'PROPERTY_TRANSFER', 'MORTGAGE', 'UNMORTGAGE', 'HOUSE_PURCHASE', 'HOUSE_SALE', 'HOTEL_PURCHASE', 'HOTEL_SALE', 'TOWER_PURCHASE', 'TOWER_SALE', 'CUSTOM', 'CORRECTION');

-- CreateEnum
CREATE TYPE "GameEventType" AS ENUM ('GAME_CREATED', 'GAME_STARTED', 'GAME_PAUSED', 'GAME_RESUMED', 'GAME_COMPLETED', 'PLAYER_ADDED', 'PLAYER_REMOVED', 'PAWN_REGISTERED', 'NFC_SCANNED', 'MONEY_TRANSFERRED', 'PROPERTY_PURCHASED', 'PROPERTY_TRANSFERRED', 'PROPERTY_MORTGAGED', 'PROPERTY_UNMORTGAGED', 'BUILDING_PURCHASED', 'BUILDING_SOLD', 'GO_PASSED', 'POSITION_CHANGED', 'TURN_STARTED', 'TURN_ENDED', 'TRANSACTION_CORRECTED', 'CUSTOM');

-- CreateEnum
CREATE TYPE "NfcEventStatus" AS ENUM ('RECEIVED', 'RESOLVED', 'REJECTED', 'DUPLICATE', 'ERROR');

-- DropTable
DROP TABLE "TestConnection";

-- CreateTable
CREATE TABLE "Game" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "GameStatus" NOT NULL DEFAULT 'SETUP',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "Game_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameRules" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "currencySymbol" TEXT NOT NULL DEFAULT '₹',
    "startingCash" INTEGER NOT NULL DEFAULT 1500,
    "goSalary" INTEGER NOT NULL DEFAULT 200,
    "totalHouses" INTEGER NOT NULL DEFAULT 32,
    "totalHotels" INTEGER NOT NULL DEFAULT 12,
    "totalTowers" INTEGER NOT NULL DEFAULT 0,
    "towerMode" BOOLEAN NOT NULL DEFAULT false,
    "freeParkingEnabled" BOOLEAN NOT NULL DEFAULT false,
    "jailEnabled" BOOLEAN NOT NULL DEFAULT true,
    "auctionEnabled" BOOLEAN NOT NULL DEFAULT true,
    "mortgageEnabled" BOOLEAN NOT NULL DEFAULT true,
    "allowNegativeBalance" BOOLEAN NOT NULL DEFAULT false,
    "allowBankerOverride" BOOLEAN NOT NULL DEFAULT false,
    "customRules" JSONB,

    CONSTRAINT "GameRules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Board" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "Board_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Position" (
    "id" TEXT NOT NULL,
    "boardId" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "type" "PositionType" NOT NULL,
    "price" INTEGER,
    "baseRent" INTEGER,
    "mortgageValue" INTEGER,
    "colourGroup" TEXT,
    "metadata" JSONB,

    CONSTRAINT "Position_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Player" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nickname" TEXT,
    "avatarUrl" TEXT,
    "colour" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Player_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GamePlayerAssignment" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "pawnId" TEXT NOT NULL,
    "startingCash" INTEGER NOT NULL,
    "balance" INTEGER NOT NULL,
    "currentPositionId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "turnOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GamePlayerAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pawn" (
    "id" TEXT NOT NULL,
    "pawnCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "imageUrl" TEXT,
    "notes" TEXT,
    "status" "PawnStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Pawn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NfcTag" (
    "id" TEXT NOT NULL,
    "uid" TEXT NOT NULL,
    "pawnId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "registeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3),

    CONSTRAINT "NfcTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Device" (
    "id" TEXT NOT NULL,
    "deviceCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "DeviceType" NOT NULL,
    "connected" BOOLEAN NOT NULL DEFAULT false,
    "lastHeartbeat" TIMESTAMP(3),
    "lastConnectedAt" TIMESTAMP(3),
    "lastDisconnectedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Device_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Property" (
    "id" TEXT NOT NULL,
    "positionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "PropertyType" NOT NULL,
    "price" INTEGER,
    "baseRent" INTEGER,
    "mortgageValue" INTEGER,
    "colourGroup" TEXT,
    "metadata" JSONB,

    CONSTRAINT "Property_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PropertyOwnership" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "gamePlayerId" TEXT NOT NULL,
    "acquiredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "transferredAt" TIMESTAMP(3),
    "isMortgaged" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "PropertyOwnership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Building" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "houses" INTEGER NOT NULL DEFAULT 0,
    "hotels" INTEGER NOT NULL DEFAULT 0,
    "towers" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Building_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankInventory" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "housesTotal" INTEGER NOT NULL DEFAULT 32,
    "housesUsed" INTEGER NOT NULL DEFAULT 0,
    "hotelsTotal" INTEGER NOT NULL DEFAULT 12,
    "hotelsUsed" INTEGER NOT NULL DEFAULT 0,
    "towersTotal" INTEGER NOT NULL DEFAULT 0,
    "towersUsed" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BankInventory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "fromPlayerId" TEXT,
    "toPlayerId" TEXT,
    "amount" INTEGER NOT NULL,
    "type" "TransactionType" NOT NULL,
    "reason" TEXT,
    "propertyId" TEXT,
    "relatedAction" TEXT,
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Correction" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "originalTransactionId" TEXT NOT NULL,
    "correctionTransactionId" TEXT,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Correction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Turn" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "gamePlayerId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "startingPositionId" TEXT,
    "endingPositionId" TEXT,
    "actions" JSONB,

    CONSTRAINT "Turn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameEvent" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "type" "GameEventType" NOT NULL,
    "description" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GameEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NfcEvent" (
    "id" TEXT NOT NULL,
    "uid" TEXT NOT NULL,
    "nfcTagId" TEXT,
    "pawnId" TEXT,
    "gameId" TEXT,
    "deviceId" TEXT,
    "action" TEXT,
    "status" "NfcEventStatus" NOT NULL DEFAULT 'RECEIVED',
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uidHash" TEXT,

    CONSTRAINT "NfcEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Game_status_idx" ON "Game"("status");

-- CreateIndex
CREATE INDEX "Game_createdAt_idx" ON "Game"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "GameRules_gameId_key" ON "GameRules"("gameId");

-- CreateIndex
CREATE INDEX "GameRules_gameId_idx" ON "GameRules"("gameId");

-- CreateIndex
CREATE UNIQUE INDEX "Board_gameId_key" ON "Board"("gameId");

-- CreateIndex
CREATE INDEX "Board_gameId_idx" ON "Board"("gameId");

-- CreateIndex
CREATE INDEX "Position_boardId_idx" ON "Position"("boardId");

-- CreateIndex
CREATE INDEX "Position_type_idx" ON "Position"("type");

-- CreateIndex
CREATE UNIQUE INDEX "Position_boardId_index_key" ON "Position"("boardId", "index");

-- CreateIndex
CREATE INDEX "Player_name_idx" ON "Player"("name");

-- CreateIndex
CREATE INDEX "GamePlayerAssignment_gameId_idx" ON "GamePlayerAssignment"("gameId");

-- CreateIndex
CREATE INDEX "GamePlayerAssignment_playerId_idx" ON "GamePlayerAssignment"("playerId");

-- CreateIndex
CREATE INDEX "GamePlayerAssignment_pawnId_idx" ON "GamePlayerAssignment"("pawnId");

-- CreateIndex
CREATE INDEX "GamePlayerAssignment_currentPositionId_idx" ON "GamePlayerAssignment"("currentPositionId");

-- CreateIndex
CREATE UNIQUE INDEX "GamePlayerAssignment_gameId_playerId_key" ON "GamePlayerAssignment"("gameId", "playerId");

-- CreateIndex
CREATE UNIQUE INDEX "GamePlayerAssignment_gameId_pawnId_key" ON "GamePlayerAssignment"("gameId", "pawnId");

-- CreateIndex
CREATE UNIQUE INDEX "GamePlayerAssignment_gameId_turnOrder_key" ON "GamePlayerAssignment"("gameId", "turnOrder");

-- CreateIndex
CREATE UNIQUE INDEX "Pawn_pawnCode_key" ON "Pawn"("pawnCode");

-- CreateIndex
CREATE INDEX "Pawn_status_idx" ON "Pawn"("status");

-- CreateIndex
CREATE UNIQUE INDEX "NfcTag_uid_key" ON "NfcTag"("uid");

-- CreateIndex
CREATE INDEX "NfcTag_pawnId_idx" ON "NfcTag"("pawnId");

-- CreateIndex
CREATE INDEX "NfcTag_uid_idx" ON "NfcTag"("uid");

-- CreateIndex
CREATE UNIQUE INDEX "Device_deviceCode_key" ON "Device"("deviceCode");

-- CreateIndex
CREATE INDEX "Device_type_idx" ON "Device"("type");

-- CreateIndex
CREATE INDEX "Device_connected_idx" ON "Device"("connected");

-- CreateIndex
CREATE UNIQUE INDEX "Property_positionId_key" ON "Property"("positionId");

-- CreateIndex
CREATE INDEX "Property_type_idx" ON "Property"("type");

-- CreateIndex
CREATE INDEX "Property_colourGroup_idx" ON "Property"("colourGroup");

-- CreateIndex
CREATE INDEX "PropertyOwnership_gamePlayerId_idx" ON "PropertyOwnership"("gamePlayerId");

-- CreateIndex
CREATE UNIQUE INDEX "PropertyOwnership_propertyId_key" ON "PropertyOwnership"("propertyId");

-- CreateIndex
CREATE UNIQUE INDEX "Building_propertyId_key" ON "Building"("propertyId");

-- CreateIndex
CREATE UNIQUE INDEX "BankInventory_gameId_key" ON "BankInventory"("gameId");

-- CreateIndex
CREATE INDEX "BankInventory_gameId_idx" ON "BankInventory"("gameId");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_idempotencyKey_key" ON "Transaction"("idempotencyKey");

-- CreateIndex
CREATE INDEX "Transaction_gameId_idx" ON "Transaction"("gameId");

-- CreateIndex
CREATE INDEX "Transaction_fromPlayerId_idx" ON "Transaction"("fromPlayerId");

-- CreateIndex
CREATE INDEX "Transaction_toPlayerId_idx" ON "Transaction"("toPlayerId");

-- CreateIndex
CREATE INDEX "Transaction_createdAt_idx" ON "Transaction"("createdAt");

-- CreateIndex
CREATE INDEX "Transaction_type_idx" ON "Transaction"("type");

-- CreateIndex
CREATE INDEX "Correction_gameId_idx" ON "Correction"("gameId");

-- CreateIndex
CREATE INDEX "Correction_originalTransactionId_idx" ON "Correction"("originalTransactionId");

-- CreateIndex
CREATE INDEX "Turn_gameId_idx" ON "Turn"("gameId");

-- CreateIndex
CREATE INDEX "Turn_gamePlayerId_idx" ON "Turn"("gamePlayerId");

-- CreateIndex
CREATE INDEX "Turn_startedAt_idx" ON "Turn"("startedAt");

-- CreateIndex
CREATE INDEX "GameEvent_gameId_idx" ON "GameEvent"("gameId");

-- CreateIndex
CREATE INDEX "GameEvent_createdAt_idx" ON "GameEvent"("createdAt");

-- CreateIndex
CREATE INDEX "GameEvent_type_idx" ON "GameEvent"("type");

-- CreateIndex
CREATE INDEX "NfcEvent_uid_idx" ON "NfcEvent"("uid");

-- CreateIndex
CREATE INDEX "NfcEvent_nfcTagId_idx" ON "NfcEvent"("nfcTagId");

-- CreateIndex
CREATE INDEX "NfcEvent_pawnId_idx" ON "NfcEvent"("pawnId");

-- CreateIndex
CREATE INDEX "NfcEvent_gameId_idx" ON "NfcEvent"("gameId");

-- CreateIndex
CREATE INDEX "NfcEvent_deviceId_idx" ON "NfcEvent"("deviceId");

-- CreateIndex
CREATE INDEX "NfcEvent_timestamp_idx" ON "NfcEvent"("timestamp");

-- AddForeignKey
ALTER TABLE "GameRules" ADD CONSTRAINT "GameRules_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Board" ADD CONSTRAINT "Board_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Position" ADD CONSTRAINT "Position_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "Board"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GamePlayerAssignment" ADD CONSTRAINT "GamePlayerAssignment_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GamePlayerAssignment" ADD CONSTRAINT "GamePlayerAssignment_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GamePlayerAssignment" ADD CONSTRAINT "GamePlayerAssignment_pawnId_fkey" FOREIGN KEY ("pawnId") REFERENCES "Pawn"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GamePlayerAssignment" ADD CONSTRAINT "GamePlayerAssignment_currentPositionId_fkey" FOREIGN KEY ("currentPositionId") REFERENCES "Position"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NfcTag" ADD CONSTRAINT "NfcTag_pawnId_fkey" FOREIGN KEY ("pawnId") REFERENCES "Pawn"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Property" ADD CONSTRAINT "Property_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "Position"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyOwnership" ADD CONSTRAINT "PropertyOwnership_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyOwnership" ADD CONSTRAINT "PropertyOwnership_gamePlayerId_fkey" FOREIGN KEY ("gamePlayerId") REFERENCES "GamePlayerAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Building" ADD CONSTRAINT "Building_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_fromPlayerId_fkey" FOREIGN KEY ("fromPlayerId") REFERENCES "GamePlayerAssignment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_toPlayerId_fkey" FOREIGN KEY ("toPlayerId") REFERENCES "GamePlayerAssignment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Correction" ADD CONSTRAINT "Correction_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Correction" ADD CONSTRAINT "Correction_originalTransactionId_fkey" FOREIGN KEY ("originalTransactionId") REFERENCES "Transaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Turn" ADD CONSTRAINT "Turn_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Turn" ADD CONSTRAINT "Turn_gamePlayerId_fkey" FOREIGN KEY ("gamePlayerId") REFERENCES "GamePlayerAssignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameEvent" ADD CONSTRAINT "GameEvent_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NfcEvent" ADD CONSTRAINT "NfcEvent_nfcTagId_fkey" FOREIGN KEY ("nfcTagId") REFERENCES "NfcTag"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NfcEvent" ADD CONSTRAINT "NfcEvent_pawnId_fkey" FOREIGN KEY ("pawnId") REFERENCES "Pawn"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NfcEvent" ADD CONSTRAINT "NfcEvent_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NfcEvent" ADD CONSTRAINT "NfcEvent_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE SET NULL ON UPDATE CASCADE;
