
import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

type RouteContext = {
  params: Promise<{
    gameId: string;
  }>;
};

export async function POST(
  request: Request,
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

    let body: {
      gamePlayerId?: string;
    } = {};

    try {
      body = await request.json();
    } catch {
      // Empty body is allowed; active turn will determine the player.
    }

    const result = await prisma.$transaction(async (tx) => {
      // ------------------------------------------------------------
      // 1. Verify game
      // ------------------------------------------------------------

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

      // ------------------------------------------------------------
      // 2. Find active turn
      // ------------------------------------------------------------

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

      // ------------------------------------------------------------
      // 3. Determine player
      // ------------------------------------------------------------

      const gamePlayerId =
        body.gamePlayerId ?? turn.gamePlayerId;

      if (gamePlayerId !== turn.gamePlayerId) {
        throw new Error("NOT_ACTIVE_PLAYER");
      }

      const player = turn.player;

      // ------------------------------------------------------------
      // 4. Verify player position
      // ------------------------------------------------------------

      if (!player.currentPositionId) {
        throw new Error("PLAYER_POSITION_NOT_SET");
      }

      const position = await tx.position.findUnique({
        where: {
          id: player.currentPositionId,
        },
        include: {
          properties: true,
        },
      });

      if (!position) {
        throw new Error("POSITION_NOT_FOUND");
      }

      // ------------------------------------------------------------
      // 5. Verify position is a property
      // ------------------------------------------------------------

      if (
        position.type !== "PROPERTY" &&
        position.type !== "RAILROAD" &&
        position.type !== "UTILITY"
      ) {
        throw new Error("NOT_PURCHASABLE_PROPERTY");
      }

      const property = position.properties[0];

      if (!property) {
        throw new Error("PROPERTY_NOT_FOUND");
      }

      // ------------------------------------------------------------
      // 6. Check ownership
      // ------------------------------------------------------------

      const existingOwnership =
        await tx.propertyOwnership.findUnique({
          where: {
            propertyId: property.id,
          },
        });

      if (existingOwnership) {
        throw new Error("PROPERTY_ALREADY_OWNED");
      }

      // ------------------------------------------------------------
      // 7. Check price
      // ------------------------------------------------------------

      if (property.price === null) {
        throw new Error("PROPERTY_PRICE_NOT_SET");
      }

      if (player.balance < property.price) {
        throw new Error("INSUFFICIENT_FUNDS");
      }

      // ------------------------------------------------------------
      // 8. Deduct money
      // ------------------------------------------------------------

      const updatedPlayer =
        await tx.gamePlayerAssignment.update({
          where: {
            id: player.id,
          },
          data: {
            balance: {
              decrement: property.price,
            },
          },
          include: {
            player: true,
            pawn: true,
            currentPosition: true,
          },
        });

      // ------------------------------------------------------------
      // 9. Create ownership
      // ------------------------------------------------------------

      const ownership =
        await tx.propertyOwnership.create({
          data: {
            propertyId: property.id,
            gamePlayerId: player.id,
          },
          include: {
            property: true,
            player: {
              include: {
                player: true,
                pawn: true,
              },
            },
          },
        });

      // ------------------------------------------------------------
      // 10. Create transaction
      // ------------------------------------------------------------

      const transaction = await tx.transaction.create({
        data: {
          gameId,
          fromPlayerId: player.id,
          amount: property.price,
          type: "PROPERTY_PURCHASE",
          reason: `Purchased ${property.name}`,
          propertyId: property.id,
          relatedAction: "PROPERTY_PURCHASE",
        },
      });

      // ------------------------------------------------------------
      // 11. Record game event
      // ------------------------------------------------------------

      const gameEvent = await tx.gameEvent.create({
        data: {
          gameId,
          type: "PROPERTY_PURCHASED",
          description: `${player.player.name} purchased ${property.name}`,
          metadata: {
            gamePlayerId: player.id,
            playerId: player.playerId,
            pawnId: player.pawnId,
            pawnCode: player.pawn.pawnCode,
            propertyId: property.id,
            propertyName: property.name,
            price: property.price,
            balanceAfterPurchase: updatedPlayer.balance,
            turnId: turn.id,
          },
        },
      });

      // ------------------------------------------------------------
      // 12. Update turn actions
      // ------------------------------------------------------------

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
          actions: {
            ...previousActions,
            propertyPurchase: {
              propertyId: property.id,
              propertyName: property.name,
              price: property.price,
              purchased: true,
            },
          },
        },
      });

      return {
        game,
        turnId: turn.id,
        player: updatedPlayer,
        property,
        ownership,
        transaction,
        gameEvent,
      };
    });

    return NextResponse.json({
      success: true,
      message: `Property purchased successfully`,
      gameId,
      turnId: result.turnId,

      purchase: {
        propertyId: result.property.id,
        propertyName: result.property.name,
        price: result.property.price,
      },

      player: {
        gamePlayerId: result.player.id,
        playerId: result.player.playerId,
        name: result.player.player.name,
        pawnId: result.player.pawnId,
        pawnCode: result.player.pawn.pawnCode,
        balance: result.player.balance,
      },

      ownership: result.ownership,

      transaction: {
        id: result.transaction.id,
        type: result.transaction.type,
        amount: result.transaction.amount,
        propertyId: result.transaction.propertyId,
      },

      event: {
        id: result.gameEvent.id,
        type: result.gameEvent.type,
      },
    });
  } catch (error) {
    console.error("PROPERTY_PURCHASE_ERROR:", error);

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
          error: "No active turn",
        },
        { status: 409 },
      );
    }

    if (
      error instanceof Error &&
      error.message === "NOT_ACTIVE_PLAYER"
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "This player does not own the active turn",
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
      error.message === "POSITION_NOT_FOUND"
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Player position not found",
        },
        { status: 404 },
      );
    }

    if (
      error instanceof Error &&
      error.message === "NOT_PURCHASABLE_PROPERTY"
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Current position is not purchasable",
        },
        { status: 409 },
      );
    }

    if (
      error instanceof Error &&
      error.message === "PROPERTY_NOT_FOUND"
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Property record not found",
        },
        { status: 404 },
      );
    }

    if (
      error instanceof Error &&
      error.message === "PROPERTY_ALREADY_OWNED"
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Property is already owned",
        },
        { status: 409 },
      );
    }

    if (
      error instanceof Error &&
      error.message === "PROPERTY_PRICE_NOT_SET"
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Property price is not configured",
        },
        { status: 500 },
      );
    }

    if (
      error instanceof Error &&
      error.message === "INSUFFICIENT_FUNDS"
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Insufficient funds",
        },
        { status: 409 },
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: "Unable to purchase property",
      },
      { status: 500 },
    );
  }
}

