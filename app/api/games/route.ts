
import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const name =
      typeof body.name === "string"
        ? body.name.trim()
        : "";

    if (!name) {
      return NextResponse.json(
        {
          success: false,
          error: "Game name is required",
        },
        { status: 400 },
      );
    }

    const game = await prisma.$transaction(async (tx) => {
      const createdGame = await tx.game.create({
        data: {
          name,
          status: "SETUP",
        },
      });

      const startingCash = 1500;

      await tx.gameRules.create({
        data: {
          gameId: createdGame.id,
          currency: "INR",
          currencySymbol: "₹",
          startingCash,
          goSalary: 200,
          totalHouses: 32,
          totalHotels: 12,
          totalTowers: 0,
          towerMode: false,
          freeParkingEnabled: false,
          jailEnabled: true,
          auctionEnabled: true,
          mortgageEnabled: true,
          allowNegativeBalance: false,
          allowBankerOverride: false,
        },
      });

      await tx.bankInventory.create({
        data: {
          gameId: createdGame.id,
          housesTotal: 32,
          housesUsed: 0,
          hotelsTotal: 12,
          hotelsUsed: 0,
          towersTotal: 0,
          towersUsed: 0,
        },
      });

      await tx.gameEvent.create({
        data: {
          gameId: createdGame.id,
          type: "GAME_CREATED",
          description: `Game ${name} created`,
          metadata: {
            gameName: name,
          },
        },
      });

      return createdGame;
    });

    return NextResponse.json(
      {
        success: true,
        game,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("CREATE_GAME_ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Unable to create game",
      },
      { status: 500 },
    );
  }
}

export async function GET() {
  try {
    const games = await prisma.game.findMany({
      include: {
        rules: true,
        board: true,
        players: {
          include: {
            player: true,
            pawn: true,
          },
          orderBy: {
            turnOrder: "asc",
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json({
      success: true,
      games,
    });
  } catch (error) {
    console.error("GET_GAMES_ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Unable to fetch games",
      },
      { status: 500 },
    );
  }
}
