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

    // ----------------------------------------------------------
    // Find the current active turn
    // ----------------------------------------------------------

    const turn = await prisma.turn.findFirst({
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
            currentPosition: {
              include: {
                properties: {
                  include: {
                    ownership: {
                      include: {
                        player: {
                          include: {
                            player: true,
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!turn) {
      return NextResponse.json(
        {
          success: false,
          error: "No active turn found",
        },
        { status: 404 },
      );
    }

    const gamePlayer = turn.player;
    const position = gamePlayer.currentPosition;

    if (!position) {
      return NextResponse.json(
        {
          success: false,
          error: "Player has no current position",
        },
        { status: 400 },
      );
    }

    // ----------------------------------------------------------
    // Basic position information
    // ----------------------------------------------------------

    const baseResult = {
      gameId,
      turnId: turn.id,

      player: {
        gamePlayerId: gamePlayer.id,
        playerId: gamePlayer.playerId,
        name: gamePlayer.player.name,
        pawnId: gamePlayer.pawnId,
        pawnCode: gamePlayer.pawn.pawnCode,
      },

      position: {
        id: position.id,
        index: position.index,
        name: position.name,
        type: position.type,
      },
    };

    // ----------------------------------------------------------
    // GO
    // ----------------------------------------------------------

    if (position.type === "GO") {
      return NextResponse.json({
        success: true,
        action: "GO",
        message: "Player is on GO",
        ...baseResult,
      });
    }

    // ----------------------------------------------------------
    // JAIL
    // ----------------------------------------------------------

    if (position.type === "JAIL") {
      return NextResponse.json({
        success: true,
        action: "JAIL",
        message: "Player is at Jail / Just Visiting",
        ...baseResult,
      });
    }

    // ----------------------------------------------------------
    // FREE PARKING
    // ----------------------------------------------------------

    if (position.type === "FREE_PARKING") {
      return NextResponse.json({
        success: true,
        action: "FREE_PARKING",
        message: "Player landed on Free Parking",
        ...baseResult,
      });
    }

    // ----------------------------------------------------------
    // GO TO JAIL
    // ----------------------------------------------------------

  if (position.type === "GO_TO_JAIL") {
  const result = await prisma.$transaction(async (tx) => {
    // Find the Jail position on this game's board.
    // Standard Monopoly Jail is position index 10.
    const jailPosition = await tx.position.findFirst({
      where: {
        boardId: position.boardId,
        index: 10,
        type: "JAIL",
      },
    });

    if (!jailPosition) {
      throw new Error("JAIL_POSITION_NOT_FOUND");
    }

    // Move the player to Jail and mark them as imprisoned.
    const updatedPlayer = await tx.gamePlayerAssignment.update({
      where: {
        id: gamePlayer.id,
      },
      data: {
        currentPositionId: jailPosition.id,
        isInJail: true,
        jailTurns: 0,
      },
      include: {
        player: true,
        pawn: true,
        currentPosition: true,
      },
    });

    // Preserve the dice-roll information already stored in the turn.
    const existingActions =
      turn.actions &&
      typeof turn.actions === "object" &&
      !Array.isArray(turn.actions)
        ? (turn.actions as Record<string, unknown>)
        : {};

    const updatedActions = {
      ...existingActions,
      type: "GO_TO_JAIL",
      sentToJail: true,
      jailPosition: {
        id: jailPosition.id,
        name: jailPosition.name,
        index: jailPosition.index,
      },
    };

    // Update the current turn.
    const updatedTurn = await tx.turn.update({
      where: {
        id: turn.id,
      },
      data: {
        endingPositionId: jailPosition.id,
        actions: updatedActions,
      },
    });

    // Record the position change.
    await tx.gameEvent.create({
      data: {
        gameId,
        type: "POSITION_CHANGED",
        description: `${gamePlayer.player.name} moved to Jail`,
        metadata: {
          turnId: turn.id,
          gamePlayerId: gamePlayer.id,
          playerId: gamePlayer.playerId,
          pawnId: gamePlayer.pawnId,
          fromPositionId: position.id,
          fromPositionIndex: position.index,
          fromPositionName: position.name,
          toPositionId: jailPosition.id,
          toPositionIndex: jailPosition.index,
          toPositionName: jailPosition.name,
        },
      },
    });

    // Record the specific jail event.
    await tx.gameEvent.create({
      data: {
        gameId,
        type: "PLAYER_SENT_TO_JAIL",
        description: `${gamePlayer.player.name} was sent to Jail`,
        metadata: {
          turnId: turn.id,
          gamePlayerId: gamePlayer.id,
          playerId: gamePlayer.playerId,
          pawnId: gamePlayer.pawnId,
          jailPositionId: jailPosition.id,
          jailPositionIndex: jailPosition.index,
        },
      },
    });

    return {
      updatedPlayer,
      updatedTurn,
      jailPosition,
    };
  });

  return NextResponse.json({
    success: true,
    action: "GO_TO_JAIL",
    message: "Player has been sent to Jail",

    gameId,
    turnId: result.updatedTurn.id,

    player: {
      gamePlayerId: result.updatedPlayer.id,
      playerId: result.updatedPlayer.playerId,
      name: result.updatedPlayer.player.name,
      pawnId: result.updatedPlayer.pawnId,
      pawnCode: result.updatedPlayer.pawn.pawnCode,
      isInJail: result.updatedPlayer.isInJail,
      jailTurns: result.updatedPlayer.jailTurns,
    },

    fromPosition: {
      id: position.id,
      index: position.index,
      name: position.name,
      type: position.type,
    },

    jailPosition: {
      id: result.jailPosition.id,
      index: result.jailPosition.index,
      name: result.jailPosition.name,
      type: result.jailPosition.type,
    },
  });
}

    // ----------------------------------------------------------
    // CHANCE
    // ----------------------------------------------------------

    if (position.type === "CHANCE") {
      return NextResponse.json({
        success: true,
        action: "CHANCE",
        message: "Draw a Chance card",
        ...baseResult,
      });
    }

    // ----------------------------------------------------------
    // COMMUNITY CHEST
    // ----------------------------------------------------------

    if (position.type === "COMMUNITY_CHEST") {
      return NextResponse.json({
        success: true,
        action: "COMMUNITY_CHEST",
        message: "Draw a Community Chest card",
        ...baseResult,
      });
    }

    // ----------------------------------------------------------
    // TAX
    // ----------------------------------------------------------

    if (position.type === "TAX") {
      return NextResponse.json({
        success: true,
        action: "TAX",
        message: "Player must pay tax",
        ...baseResult,
      });
    }

    // ----------------------------------------------------------
    // PROPERTY / RAILROAD / UTILITY
    // ----------------------------------------------------------

    if (
      position.type === "PROPERTY" ||
      position.type === "RAILROAD" ||
      position.type === "UTILITY"
    ) {
      const property = position.properties[0];

      if (!property) {
        return NextResponse.json(
          {
            success: false,
            error: "Property record not found for this position",
            ...baseResult,
          },
          { status: 500 },
        );
      }

      const ownership = property.ownership;

      // --------------------------------------------------------
      // UNOWNED
      // --------------------------------------------------------

      if (!ownership) {
        return NextResponse.json({
          success: true,
          action: "PROPERTY_PURCHASE",
          message: "Property is unowned and available for purchase",

          ...baseResult,

          property: {
            id: property.id,
            name: property.name,
            type: property.type,
            price: property.price,
            baseRent: property.baseRent,
            mortgageValue: property.mortgageValue,
            colourGroup: property.colourGroup,
          },

          ownership: null,

          purchase: {
            available: true,
            price: property.price,
            playerBalance: gamePlayer.balance,
            canAfford:
              property.price !== null &&
              gamePlayer.balance >= property.price,
          },
        });
      }

      // --------------------------------------------------------
      // OWNED BY CURRENT PLAYER
      // --------------------------------------------------------

      if (ownership.gamePlayerId === gamePlayer.id) {
        return NextResponse.json({
          success: true,
          action: "PROPERTY_OWNED_BY_PLAYER",
          message: "Player already owns this property",

          ...baseResult,

          property: {
            id: property.id,
            name: property.name,
            type: property.type,
            price: property.price,
            baseRent: property.baseRent,
            mortgageValue: property.mortgageValue,
            colourGroup: property.colourGroup,
          },

          ownership: {
            id: ownership.id,
            gamePlayerId: ownership.gamePlayerId,
            acquiredAt: ownership.acquiredAt,
            isMortgaged: ownership.isMortgaged,
          },
        });
      }

      // --------------------------------------------------------
      // OWNED BY ANOTHER PLAYER
      // --------------------------------------------------------

      return NextResponse.json({
        success: true,
        action: "PAY_RENT",
        message: "Property is owned by another player",

        ...baseResult,

        property: {
          id: property.id,
          name: property.name,
          type: property.type,
          price: property.price,
          baseRent: property.baseRent,
          mortgageValue: property.mortgageValue,
          colourGroup: property.colourGroup,
        },

        ownership: {
          id: ownership.id,
          gamePlayerId: ownership.gamePlayerId,
          ownerName: ownership.player.player.name,
          isMortgaged: ownership.isMortgaged,
        },

        rent: {
          amount: property.baseRent,
          payerGamePlayerId: gamePlayer.id,
          receiverGamePlayerId: ownership.gamePlayerId,
        },
      });
    }

    // ----------------------------------------------------------
    // UNKNOWN POSITION
    // ----------------------------------------------------------

    return NextResponse.json({
      success: true,
      action: "NONE",
      message: "No automatic action is currently required",
      ...baseResult,
    });
  } catch (error) {
    console.error("RESOLVE_TURN_ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Unable to resolve current position",
      },
      { status: 500 },
    );
  }
}