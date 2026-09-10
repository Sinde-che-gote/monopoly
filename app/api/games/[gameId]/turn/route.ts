import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

type RouteContext = {
  params: Promise<{
    gameId: string;
  }>;
};

export async function GET(
  _request: Request,
  context: RouteContext,
) {
  try {
    const { gameId } = await context.params;

    if (!gameId) {
      return NextResponse.json(
        {
          success: false,
          error: "gameId is required",
        },
        { status: 400 },
      );
    }

    const game = await prisma.game.findUnique({
      where: {
        id: gameId,
      },
      include: {
        players: {
          where: {
            isActive: true,
          },
          orderBy: {
            turnOrder: "asc",
          },
          include: {
            player: true,
            pawn: true,
            currentPosition: true,
          },
        },
        turns: {
          where: {
            endedAt: null,
          },
          orderBy: {
            startedAt: "desc",
          },
          take: 1,
          include: {
            player: {
              include: {
                player: true,
                pawn: true,
                currentPosition: true,
              },
            },
          },
        },
      },
    });

    if (!game) {
      return NextResponse.json(
        {
          success: false,
          error: "Game not found",
        },
        { status: 404 },
      );
    }

    const currentTurn = game.turns[0] ?? null;

    return NextResponse.json({
      success: true,
      game: {
        id: game.id,
        name: game.name,
        status: game.status,
      },
      currentTurn,
      players: game.players,
    });
  } catch (error) {
    console.error("GET_TURN_ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Unable to fetch turn",
      },
      { status: 500 },
    );
  }
}

export async function POST(
  _request: Request,
  context: RouteContext,
) {
  try {
    const { gameId } = await context.params;

    if (!gameId) {
      return NextResponse.json(
        {
          success: false,
          error: "gameId is required",
        },
        { status: 400 },
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const game = await tx.game.findUnique({
        where: {
          id: gameId,
        },
        include: {
          players: {
            where: {
              isActive: true,
            },
            orderBy: {
              turnOrder: "asc",
            },
            include: {
              player: true,
              pawn: true,
              currentPosition: true,
            },
          },
          turns: {
            where: {
              endedAt: null,
            },
            orderBy: {
              startedAt: "desc",
            },
            take: 1,
          },
        },
      });

      if (!game) {
        throw new Error("GAME_NOT_FOUND");
      }

      if (game.players.length === 0) {
        throw new Error("NO_PLAYERS");
      }

      const existingTurn = game.turns[0];

      if (existingTurn) {
        return {
          game,
          turn: existingTurn,
          created: false,
        };
      }

      const firstPlayer = game.players[0];

      const updatedGame = await tx.game.update({
        where: {
          id: gameId,
        },
        data: {
          status: "ACTIVE",
          startedAt: game.startedAt ?? new Date(),
        },
      });

      const turn = await tx.turn.create({
        data: {
          gameId,
          gamePlayerId: firstPlayer.id,
          startingPositionId:
            firstPlayer.currentPositionId ?? null,
          actions: {
            type: "TURN_STARTED",
          },
        },
        include: {
          player: {
            include: {
              player: true,
              pawn: true,
              currentPosition: true,
            },
          },
        },
      });

      await tx.gameEvent.create({
        data: {
          gameId,
          type: "GAME_STARTED",
          description: "Game started",
          metadata: {
            firstPlayerId: firstPlayer.playerId,
            firstPawnId: firstPlayer.pawnId,
          },
        },
      });

      await tx.gameEvent.create({
        data: {
          gameId,
          type: "TURN_STARTED",
          description: `Turn started for ${firstPlayer.player.name}`,
          metadata: {
            turnId: turn.id,
            gamePlayerId: firstPlayer.id,
            turnOrder: firstPlayer.turnOrder,
          },
        },
      });

      return {
        game: updatedGame,
        turn,
        created: true,
      };
    });

    return NextResponse.json(
      {
        success: true,
        created: result.created,
        game: result.game,
        turn: result.turn,
      },
      { status: result.created ? 201 : 200 },
    );
  } catch (error) {
    console.error("START_TURN_ERROR:", error);

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
      error.message === "NO_PLAYERS"
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "At least one player is required",
        },
        { status: 400 },
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: "Unable to start turn",
      },
      { status: 500 },
    );
  }
}