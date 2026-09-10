import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

type RouteContext = {
  params: Promise<{
    gameId: string;
    gamePlayerId: string;
  }>;
};

export async function POST(
  request: Request,
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

    const body = await request.json();

    const positionIndex =
      typeof body.positionIndex === "number"
        ? body.positionIndex
        : NaN;

    if (
      !Number.isInteger(positionIndex) ||
      positionIndex < 0
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "positionIndex must be a non-negative integer",
        },
        { status: 400 },
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      // --------------------------------------------------
      // 1. Verify game
      // --------------------------------------------------

      const game = await tx.game.findUnique({
        where: {
          id: gameId,
        },
      });

      if (!game) {
        throw new Error("GAME_NOT_FOUND");
      }

      // --------------------------------------------------
      // 2. Find player assignment
      // --------------------------------------------------

      const player =
        await tx.gamePlayerAssignment.findFirst({
          where: {
            id: gamePlayerId,
            gameId,
          },
          include: {
            player: true,
            pawn: true,
            currentPosition: true,
          },
        });

      if (!player) {
        throw new Error("PLAYER_NOT_FOUND");
      }

      // --------------------------------------------------
      // 3. Find board
      // --------------------------------------------------

      const board = await tx.board.findUnique({
        where: {
          gameId,
        },
      });

      if (!board) {
        throw new Error("BOARD_NOT_FOUND");
      }

      // --------------------------------------------------
      // 4. Find destination position
      // --------------------------------------------------

      const destination =
        await tx.position.findFirst({
          where: {
            boardId: board.id,
            index: positionIndex,
          },
          include: {
            properties: true,
          },
        });

      if (!destination) {
        throw new Error("POSITION_NOT_FOUND");
      }

      // --------------------------------------------------
      // 5. Update player position
      // --------------------------------------------------

      const updatedPlayer =
        await tx.gamePlayerAssignment.update({
          where: {
            id: gamePlayerId,
          },
          data: {
            currentPositionId: destination.id,
          },
          include: {
            player: true,
            pawn: true,
            currentPosition: true,
          },
        });

      // --------------------------------------------------
      // 6. Create position-change event
      // --------------------------------------------------

      await tx.gameEvent.create({
        data: {
          gameId,
          type: "POSITION_CHANGED",
          description:
            `Player moved to ${destination.name}`,
          metadata: {
            gamePlayerId,
            playerId: player.playerId,
            pawnId: player.pawnId,
            fromPositionId:
              player.currentPositionId,
            fromPositionIndex:
              player.currentPosition?.index ?? null,
            toPositionId: destination.id,
            toPositionIndex: destination.index,
            toPositionName: destination.name,
          },
        },
      });

      return {
        player: updatedPlayer,
        fromPosition: player.currentPosition,
        toPosition: destination,
      };
    });

    return NextResponse.json({
      success: true,
      message: "Player moved successfully",
      player: result.player,
      fromPosition: result.fromPosition,
      toPosition: result.toPosition,
    });
  } catch (error) {
    console.error("MOVE_PLAYER_ERROR:", error);

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
      error.message === "POSITION_NOT_FOUND"
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Destination position not found",
        },
        { status: 404 },
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: "Unable to move player",
      },
      { status: 500 },
    );
  }
}