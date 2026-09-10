import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

type RouteContext = {
  params: Promise<{
    gameId: string;
    gamePlayerId: string;
  }>;
};

export async function POST(
  _request: Request,
  context: RouteContext,
) {
  try {
    const { gameId, gamePlayerId } = await context.params;

    if (!gameId || !gamePlayerId) {
      return NextResponse.json(
        {
          success: false,
          error: "gameId and gamePlayerId are required",
        },
        { status: 400 },
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const game = await tx.game.findUnique({
        where: {
          id: gameId,
        },
      });

      if (!game) {
        throw new Error("GAME_NOT_FOUND");
      }

      const player = await tx.gamePlayerAssignment.findFirst({
        where: {
          id: gamePlayerId,
          gameId,
        },
        include: {
          player: true,
          pawn: true,
        },
      });

      if (!player) {
        throw new Error("PLAYER_NOT_FOUND");
      }

      const board = await tx.board.findUnique({
        where: {
          gameId,
        },
      });

      if (!board) {
        throw new Error("BOARD_NOT_FOUND");
      }

      const goPosition = await tx.position.findFirst({
        where: {
          boardId: board.id,
          index: 0,
        },
      });

      if (!goPosition) {
        throw new Error("GO_NOT_FOUND");
      }

      const updatedPlayer =
        await tx.gamePlayerAssignment.update({
          where: {
            id: gamePlayerId,
          },
          data: {
            currentPositionId: goPosition.id,
          },
          include: {
            player: true,
            pawn: true,
            currentPosition: true,
            game: true,
          },
        });

      await tx.gameEvent.create({
        data: {
          gameId,
          type: "POSITION_CHANGED",
          description: "Player initialized at GO",
          metadata: {
            gamePlayerId,
            playerId: player.playerId,
            pawnId: player.pawnId,
            positionId: goPosition.id,
            positionIndex: 0,
            positionName: "GO",
          },
        },
      });

      return updatedPlayer;
    });

    return NextResponse.json({
      success: true,
      message: "Player initialized at GO",
      player: result,
    });
  } catch (error) {
    console.error("INITIALIZE_PLAYER_POSITION_ERROR:", error);

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
      error.message === "PLAYER_NOT_FOUND"
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Player does not belong to this game",
        },
        { status: 404 },
      );
    }

    if (
      error instanceof Error &&
      error.message === "BOARD_NOT_FOUND"
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Board not found for this game",
        },
        { status: 404 },
      );
    }

    if (
      error instanceof Error &&
      error.message === "GO_NOT_FOUND"
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "GO position not found",
        },
        { status: 404 },
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: "Unable to initialize player position",
      },
      { status: 500 },
    );
  }
}