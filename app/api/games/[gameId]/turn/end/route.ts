
import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

type RouteContext = {
  params: Promise<{
    gameId: string;
  }>;
};

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
      // ----------------------------------------------------------
      // 1. Find game and active players
      // ----------------------------------------------------------

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
          },
        },
      });

      if (!game) {
        throw new Error("GAME_NOT_FOUND");
      }

      if (game.players.length === 0) {
        throw new Error("NO_ACTIVE_PLAYERS");
      }

      // ----------------------------------------------------------
      // 2. Find current active turn
      // ----------------------------------------------------------

      const currentTurn = await tx.turn.findFirst({
        where: {
          gameId,
          endedAt: null,
        },
        orderBy: {
          startedAt: "desc",
        },
      });

      if (!currentTurn) {
        throw new Error("NO_ACTIVE_TURN");
      }

      // ----------------------------------------------------------
      // 3. Find current player
      // ----------------------------------------------------------

      const currentPlayerIndex = game.players.findIndex(
        (player) => player.id === currentTurn.gamePlayerId,
      );

      if (currentPlayerIndex === -1) {
        throw new Error("CURRENT_PLAYER_NOT_FOUND");
      }

      const currentPlayer = game.players[currentPlayerIndex];

      // ----------------------------------------------------------
      // 4. End current turn
      // ----------------------------------------------------------

      const endedTurn = await tx.turn.update({
        where: {
          id: currentTurn.id,
        },
        data: {
          endedAt: new Date(),
          endingPositionId:
            currentPlayer.currentPositionId ?? null,
          actions: {
            type: "TURN_ENDED",
          },
        },
      });

      // ----------------------------------------------------------
      // 5. Record TURN_ENDED event
      // ----------------------------------------------------------

      await tx.gameEvent.create({
        data: {
          gameId,
          type: "TURN_ENDED",
          description: `Turn ended for ${currentPlayer.playerId}`,
          metadata: {
            turnId: currentTurn.id,
            gamePlayerId: currentPlayer.id,
            playerId: currentPlayer.playerId,
            pawnId: currentPlayer.pawnId,
            endingPositionId:
              currentPlayer.currentPositionId ?? null,
          },
        },
      });

      // ----------------------------------------------------------
      // 6. Determine next player
      //
      // Example:
      //
      // Player 1 -> Player 2
      // Player 2 -> Player 3
      // Player 3 -> Player 1
      //
      // ----------------------------------------------------------

      const nextPlayerIndex =
        (currentPlayerIndex + 1) % game.players.length;

      const nextPlayer = game.players[nextPlayerIndex];

      if (!nextPlayer) {
        throw new Error("NO_NEXT_PLAYER");
      }

      // ----------------------------------------------------------
      // 7. Create next turn
      // ----------------------------------------------------------

      const nextTurn = await tx.turn.create({
  data: {
    gameId,
    gamePlayerId: nextPlayer.id,
    startingPositionId:
      nextPlayer.currentPositionId ?? null,
    actions: {
      type: nextPlayer.isInJail
        ? "JAIL_TURN_STARTED"
        : "TURN_STARTED",
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

      // ----------------------------------------------------------
      // 8. Record TURN_STARTED event
      // ----------------------------------------------------------

      await tx.gameEvent.create({
  data: {
    gameId,
    type: "TURN_STARTED",
    description: nextPlayer.isInJail
      ? `Jail turn started for ${nextPlayer.playerId}`
      : `Turn started for ${nextPlayer.playerId}`,
    metadata: {
      turnId: nextTurn.id,
      gamePlayerId: nextPlayer.id,
      playerId: nextPlayer.playerId,
      pawnId: nextPlayer.pawnId,
      startingPositionId:
        nextPlayer.currentPositionId ?? null,
      isInJail: nextPlayer.isInJail,
    },
  },
});

      return {
        endedTurn,
        nextTurn,
        nextPlayer,
      };
    });

    // ------------------------------------------------------------
    // 9. Return result
    // ------------------------------------------------------------

    return NextResponse.json({
      success: true,
      message: "Turn ended successfully",

      endedTurn: result.endedTurn,

      nextTurn: result.nextTurn,

      nextPlayer: result.nextPlayer,

      isJailTurn: result.nextPlayer.isInJail,
    });
  } catch (error) {
    console.error("END_TURN_ERROR:", error);

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
      error.message === "NO_ACTIVE_PLAYERS"
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "No active players in this game",
        },
        { status: 409 },
      );
    }

    if (
      error instanceof Error &&
      error.message === "NO_ACTIVE_TURN"
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "There is no active turn",
        },
        { status: 409 },
      );
    }

    if (
      error instanceof Error &&
      error.message === "CURRENT_PLAYER_NOT_FOUND"
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Current player could not be found",
        },
        { status: 500 },
      );
    }

    if (
      error instanceof Error &&
      error.message === "NO_NEXT_PLAYER"
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Next player could not be determined",
        },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: "Unable to end turn",
      },
      { status: 500 },
    );
  }
}

