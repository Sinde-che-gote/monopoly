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
      // --------------------------------------------------
      // 1. FIND GAME
      // --------------------------------------------------

      const game = await tx.game.findUnique({
        where: {
          id: gameId,
        },
      });

      if (!game) {
        throw new Error("GAME_NOT_FOUND");
      }

      if (game.status !== "ACTIVE") {
        throw new Error("GAME_NOT_ACTIVE");
      }

      // --------------------------------------------------
      // 2. FIND ACTIVE TURN
      // --------------------------------------------------

      const turn = await tx.turn.findFirst({
        where: {
          gameId,
          endedAt: null,
        },
        orderBy: {
          startedAt: "desc",
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

      if (!turn) {
        throw new Error("NO_ACTIVE_TURN");
      }

      const gamePlayer = turn.player;

      // --------------------------------------------------
      // 3. VERIFY PLAYER POSITION
      // --------------------------------------------------

      if (!gamePlayer.currentPosition) {
        throw new Error("PLAYER_POSITION_NOT_SET");
      }

      if (gamePlayer.currentPosition.type !== "COMMUNITY_CHEST") {
        throw new Error("NOT_COMMUNITY_CHEST");
      }

      // --------------------------------------------------
      // 4. FIND COMMUNITY CHEST CARDS
      // --------------------------------------------------

      const cards = await tx.communityChestCard.findMany({
        where: {
          isActive: true,
        },
        orderBy: {
          createdAt: "asc",
        },
      });

      if (cards.length === 0) {
        throw new Error("NO_COMMUNITY_CHEST_CARDS");
      }

      // --------------------------------------------------
      // 5. PICK A CARD
      // --------------------------------------------------

      const card =
        cards[Math.floor(Math.random() * cards.length)];

      // --------------------------------------------------
      // 6. CURRENT BALANCE
      // --------------------------------------------------

      let newBalance = gamePlayer.balance;

      // --------------------------------------------------
      // 7. APPLY CARD EFFECT
      // --------------------------------------------------

      let actionMessage = "";

      if (card.action === "RECEIVE_MONEY") {
        newBalance += card.amount;

        actionMessage = `Player received ₹${card.amount}`;
      }

      if (card.action === "PAY_MONEY") {
        newBalance -= card.amount;

        actionMessage = `Player paid ₹${card.amount}`;
      }

      // --------------------------------------------------
      // GET OUT OF JAIL FREE
      // --------------------------------------------------

      if (card.action === "GET_OUT_OF_JAIL") {
        actionMessage =
          "Player received a Get Out of Jail Free card";
      }

      // --------------------------------------------------
      // MOVE TO JAIL
      // --------------------------------------------------

      let jailPosition = null;

      if (card.action === "MOVE_TO_JAIL") {
        jailPosition = await tx.position.findFirst({
          where: {
            boardId: gamePlayer.currentPosition.boardId,
            index: 10,
          },
        });

        if (!jailPosition) {
          throw new Error("JAIL_POSITION_NOT_FOUND");
        }

        actionMessage =
          "Player was sent directly to Jail";
      }

      // --------------------------------------------------
      // MOVE TO GO
      // --------------------------------------------------

      let goPosition = null;

      if (card.action === "MOVE_TO_GO") {
        goPosition = await tx.position.findFirst({
          where: {
            boardId: gamePlayer.currentPosition.boardId,
            index: 0,
          },
        });

        if (!goPosition) {
          throw new Error("GO_POSITION_NOT_FOUND");
        }

        newBalance += 200;

        actionMessage =
          "Player advanced to GO and received ₹200";
      }

      // --------------------------------------------------
      // 8. UPDATE PLAYER
      // --------------------------------------------------

      const updatedPlayer =
        await tx.gamePlayerAssignment.update({
          where: {
            id: gamePlayer.id,
          },
          data: {
            balance: newBalance,

            ...(jailPosition
              ? {
                  currentPosition: {
                    connect: {
                      id: jailPosition.id,
                    },
                  },
                  isInJail: true,
                  jailTurns: 0,
                }
              : {}),

            ...(goPosition
              ? {
                  currentPosition: {
                    connect: {
                      id: goPosition.id,
                    },
                  },
                }
              : {}),
          },
          include: {
            player: true,
            pawn: true,
            currentPosition: true,
          },
        });

      // --------------------------------------------------
      // 9. SAVE TURN ACTION
      // --------------------------------------------------

      const previousActions =
        turn.actions &&
        typeof turn.actions === "object" &&
        !Array.isArray(turn.actions)
          ? turn.actions
          : {};

      await tx.turn.update({
        where: {
          id: turn.id,
        },
        data: {
          endingPositionId:
            updatedPlayer.currentPosition?.id ??
            gamePlayer.currentPosition.id,

          actions: {
            ...previousActions,
            type: "COMMUNITY_CHEST",
            cardId: card.id,
            cardTitle: card.title,
            cardAction: card.action,
            cardAmount: card.amount,
            message: actionMessage,
          },
        },
      });

      // --------------------------------------------------
      // 10. CREATE GAME EVENT
      // --------------------------------------------------

      await tx.gameEvent.create({
        data: {
          gameId,
          type: "POSITION_CHANGED",
          description: `${gamePlayer.player.name} drew Community Chest card: ${card.title}`,
          metadata: {
            gamePlayerId: gamePlayer.id,
            pawnId: gamePlayer.pawnId,
            cardId: card.id,
            cardTitle: card.title,
            cardAction: card.action,
            cardAmount: card.amount,
            balanceBefore: gamePlayer.balance,
            balanceAfter: newBalance,
            sentToJail: Boolean(jailPosition),
          },
        },
      });

      // --------------------------------------------------
      // 11. RETURN RESULT
      // --------------------------------------------------

      return {
        turnId: turn.id,

        player: {
          gamePlayerId: gamePlayer.id,
          playerId: gamePlayer.playerId,
          name: gamePlayer.player.name,
          pawnId: gamePlayer.pawnId,
          pawnCode: gamePlayer.pawn.pawnCode,
        },

        card: {
          id: card.id,
          title: card.title,
          description: card.description,
          amount: card.amount,
          action: card.action,
        },

        effect: {
          message: actionMessage,
          balanceBefore: gamePlayer.balance,
          balanceAfter: newBalance,
          sentToJail: Boolean(jailPosition),
        },

        position: updatedPlayer.currentPosition,
      };
    });

    return NextResponse.json({
      success: true,
      action: "COMMUNITY_CHEST_CARD",
      message: "Community Chest card drawn",
      result,
    });
  } catch (error) {
    console.error("COMMUNITY_CHEST_ERROR:", error);

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
      error.message === "GAME_NOT_ACTIVE"
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Game is not active",
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
      error.message === "PLAYER_POSITION_NOT_SET"
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Player position has not been initialized",
        },
        { status: 409 },
      );
    }

    if (
      error instanceof Error &&
      error.message === "NOT_COMMUNITY_CHEST"
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Player is not on Community Chest",
        },
        { status: 409 },
      );
    }

    if (
      error instanceof Error &&
      error.message === "NO_COMMUNITY_CHEST_CARDS"
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "No Community Chest cards are available",
        },
        { status: 500 },
      );
    }

    if (
      error instanceof Error &&
      error.message === "JAIL_POSITION_NOT_FOUND"
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Jail position not found",
        },
        { status: 500 },
      );
    }

    if (
      error instanceof Error &&
      error.message === "GO_POSITION_NOT_FOUND"
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "GO position not found",
        },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: "Unable to draw Community Chest card",
      },
      { status: 500 },
    );
  }
}