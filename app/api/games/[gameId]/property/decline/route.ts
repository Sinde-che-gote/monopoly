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
      // 1. Verify game
      // ----------------------------------------------------------

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

      // ----------------------------------------------------------
      // 2. Find active turn
      // ----------------------------------------------------------

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

      const player = turn.player;

      // ----------------------------------------------------------
      // 3. Verify player position
      // ----------------------------------------------------------

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

      // ----------------------------------------------------------
      // 4. Verify purchasable position
      // ----------------------------------------------------------

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

      // ----------------------------------------------------------
      // 5. Verify property is unowned
      // ----------------------------------------------------------

      const ownership =
        await tx.propertyOwnership.findUnique({
          where: {
            propertyId: property.id,
          },
        });

      if (ownership) {
        throw new Error("PROPERTY_ALREADY_OWNED");
      }

      // ----------------------------------------------------------
      // 6. Record decision in turn
      // ----------------------------------------------------------

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
              purchased: false,
              declined: true,
            },
          },
        },
      });

      // ----------------------------------------------------------
      // 7. Record game event
      // ----------------------------------------------------------

      const gameEvent = await tx.gameEvent.create({
        data: {
          gameId,
          type: "CUSTOM",
          description: `${player.player.name} declined to purchase ${property.name}`,
          metadata: {
            action: "PROPERTY_PURCHASE_DECLINED",
            turnId: turn.id,
            gamePlayerId: player.id,
            playerId: player.playerId,
            pawnId: player.pawnId,
            pawnCode: player.pawn.pawnCode,
            propertyId: property.id,
            propertyName: property.name,
            price: property.price,
          },
        },
      });

      return {
        turn,
        player,
        property,
        gameEvent,
      };
    });

    return NextResponse.json({
      success: true,
      message: "Property purchase declined",
      gameId,
      turnId: result.turn.id,

      player: {
        gamePlayerId: result.player.id,
        playerId: result.player.playerId,
        name: result.player.player.name,
        pawnId: result.player.pawnId,
        pawnCode: result.player.pawn.pawnCode,
        balance: result.player.balance,
      },

      property: {
        id: result.property.id,
        name: result.property.name,
        type: result.property.type,
        price: result.property.price,
        baseRent: result.property.baseRent,
        mortgageValue: result.property.mortgageValue,
        colourGroup: result.property.colourGroup,
      },

      purchase: {
        purchased: false,
        declined: true,
      },

      ownership: null,

      event: {
        id: result.gameEvent.id,
        type: result.gameEvent.type,
      },
    });
  } catch (error) {
    console.error("PROPERTY_DECLINE_ERROR:", error);

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

    return NextResponse.json(
      {
        success: false,
        error: "Unable to decline property purchase",
      },
      { status: 500 },
    );
  }
}