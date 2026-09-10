import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const gameId =
      typeof body.gameId === "string" ? body.gameId.trim() : "";

    const playerName =
      typeof body.playerName === "string"
        ? body.playerName.trim()
        : "";

    const pawnCode =
      typeof body.pawnCode === "string"
        ? body.pawnCode.trim()
        : "";

    const pawnName =
      typeof body.pawnName === "string"
        ? body.pawnName.trim()
        : "";

    if (!gameId || !playerName || !pawnCode || !pawnName) {
      return NextResponse.json(
        {
          success: false,
          error:
            "gameId, playerName, pawnCode and pawnName are required",
        },
        { status: 400 },
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      // --------------------------------------------------
      // 1. Verify the game
      // --------------------------------------------------

      const game = await tx.game.findUnique({
        where: {
          id: gameId,
        },
        include: {
          rules: true,
        },
      });

      if (!game) {
        throw new Error("GAME_NOT_FOUND");
      }

      // --------------------------------------------------
      // 2. Check whether pawn code already exists
      // --------------------------------------------------

      const existingPawn = await tx.pawn.findUnique({
        where: {
          pawnCode,
        },
      });

      if (existingPawn) {
        throw new Error("PAWN_CODE_ALREADY_EXISTS");
      }

      // --------------------------------------------------
      // 3. Create the player
      // --------------------------------------------------

      const player = await tx.player.create({
        data: {
          name: playerName,
        },
      });

      // --------------------------------------------------
      // 4. Create the pawn
      // --------------------------------------------------

      const pawn = await tx.pawn.create({
        data: {
          pawnCode,
          name: pawnName,
          status: "ACTIVE",
        },
      });

      // --------------------------------------------------
      // 5. Determine turn order
      // --------------------------------------------------

      const lastPlayer = await tx.gamePlayerAssignment.findFirst({
        where: {
          gameId,
        },
        orderBy: {
          turnOrder: "desc",
        },
      });

      const turnOrder = (lastPlayer?.turnOrder ?? 0) + 1;

      // --------------------------------------------------
      // 6. Starting cash
      // --------------------------------------------------

      const startingCash =
        game.rules?.startingCash ?? 1500;

      // --------------------------------------------------
      // 7. Assign player + pawn to game
      // --------------------------------------------------

      const assignment =
        await tx.gamePlayerAssignment.create({
          data: {
            gameId,
            playerId: player.id,
            pawnId: pawn.id,
            startingCash,
            balance: startingCash,
            turnOrder,
            isActive: true,
          },
          include: {
            player: true,
            pawn: true,
          },
        });

      // --------------------------------------------------
      // 8. Create game event
      // --------------------------------------------------

      await tx.gameEvent.create({
        data: {
          gameId,
          type: "PLAYER_ADDED",
          description: `Player ${playerName} added to the game`,
          metadata: {
            playerId: player.id,
            pawnId: pawn.id,
            pawnCode,
          },
        },
      });

      return assignment;
    });

    return NextResponse.json(
      {
        success: true,
        player: result.player,
        pawn: result.pawn,
        assignment: result,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("ADD_PLAYER_ERROR:", error);

    if (
      error instanceof Error &&
      error.message === "GAME_NOT_FOUND"
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Game not found",
        },
        { status: 404 },
      );
    }

    if (
      error instanceof Error &&
      error.message === "PAWN_CODE_ALREADY_EXISTS"
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Pawn code already exists",
        },
        { status: 409 },
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: "Unable to add player",
      },
      { status: 500 },
    );
  }
}
export async function GET() {
  try {
    const players = await prisma.gamePlayerAssignment.findMany({
      include: {
        player: true,
        pawn: true,
        game: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json({
      success: true,
      players,
    });
  } catch (error) {
    console.error("GET_PLAYERS_ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Unable to fetch players",
      },
      { status: 500 },
    );
  }
}