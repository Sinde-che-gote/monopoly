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
      // --------------------------------------------------------
      // 1. Find the game
      // --------------------------------------------------------

      const game = await tx.game.findUnique({
        where: {
          id: gameId,
        },
      });

      if (!game) {
        throw new Error("GAME_NOT_FOUND");
      }

      // --------------------------------------------------------
      // 2. Find the active turn
      // --------------------------------------------------------

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

      const visitor = turn.player;

      // --------------------------------------------------------
      // 3. Make sure player has a position
      // --------------------------------------------------------

      if (!visitor.currentPositionId || !visitor.currentPosition) {
        throw new Error("PLAYER_POSITION_NOT_SET");
      }

      const position = visitor.currentPosition;

      // --------------------------------------------------------
      // 4. Check whether this position has a property
      // --------------------------------------------------------

      const property = await tx.property.findUnique({
        where: {
          positionId: position.id,
        },
        include: {
          ownership: true,
        },
      });

      if (!property) {
        throw new Error("NOT_A_PROPERTY");
      }

      // --------------------------------------------------------
      // 5. Check whether property is owned
      // --------------------------------------------------------

      if (!property.ownership) {
        throw new Error("PROPERTY_UNOWNED");
      }

      const ownership = property.ownership;

      // --------------------------------------------------------
      // 6. Prevent owner from paying rent to themselves
      // --------------------------------------------------------

      if (ownership.gamePlayerId === visitor.id) {
        throw new Error("PLAYER_OWNS_PROPERTY");
      }

      // --------------------------------------------------------
      // 7. Find property owner
      // --------------------------------------------------------

      const owner = await tx.gamePlayerAssignment.findUnique({
        where: {
          id: ownership.gamePlayerId,
        },
        include: {
          player: true,
          pawn: true,
        },
      });

      if (!owner) {
        throw new Error("OWNER_NOT_FOUND");
      }

      // --------------------------------------------------------
      // 8. Calculate rent
      // --------------------------------------------------------

      const rent = property.baseRent ?? 0;

      if (rent <= 0) {
        throw new Error("INVALID_RENT");
      }

      // --------------------------------------------------------
      // 9. Check player's balance
      // --------------------------------------------------------

      if (visitor.balance < rent) {
        throw new Error("INSUFFICIENT_FUNDS");
      }

      // --------------------------------------------------------
      // 10. Transfer money
      // --------------------------------------------------------

      const updatedVisitor = await tx.gamePlayerAssignment.update({
        where: {
          id: visitor.id,
        },
        data: {
          balance: {
            decrement: rent,
          },
        },
        include: {
          player: true,
          pawn: true,
          currentPosition: true,
        },
      });

      const updatedOwner = await tx.gamePlayerAssignment.update({
        where: {
          id: owner.id,
        },
        data: {
          balance: {
            increment: rent,
          },
        },
        include: {
          player: true,
          pawn: true,
        },
      });

      // --------------------------------------------------------
      // 11. Create transaction record
      // --------------------------------------------------------

      const transaction = await tx.transaction.create({
        data: {
          gameId,
          fromPlayerId: visitor.id,
          toPlayerId: owner.id,
          amount: rent,
          type: "RENT",
          reason: `Rent for ${property.name}`,
          propertyId: property.id,
          relatedAction: "PROPERTY_RENT",
        },
      });

      // --------------------------------------------------------
      // 12. Create game event
      // --------------------------------------------------------

      const event = await tx.gameEvent.create({
        data: {
          gameId,
          type: "MONEY_TRANSFERRED",
          description: `${visitor.player.name} paid ₹${rent} rent to ${owner.player.name} for ${property.name}`,
          metadata: {
            action: "RENT_PAYMENT",
            propertyId: property.id,
            propertyName: property.name,
            fromGamePlayerId: visitor.id,
            toGamePlayerId: owner.id,
            amount: rent,
            turnId: turn.id,
          },
        },
      });

      // --------------------------------------------------------
      // 13. Update turn actions
      // --------------------------------------------------------

      const existingActions =
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
            ...existingActions,
            rentPaid: true,
            rentPayment: {
              propertyId: property.id,
              propertyName: property.name,
              amount: rent,
              ownerGamePlayerId: owner.id,
            },
          },
        },
      });

      return {
        turnId: turn.id,
        property,
        visitor: updatedVisitor,
        owner: updatedOwner,
        transaction,
        event,
      };
    });

    return NextResponse.json({
      success: true,
      message: "Rent paid successfully",

      gameId,

      turnId: result.turnId,

      rent: {
        propertyId: result.property.id,
        propertyName: result.property.name,
        amount: result.transaction.amount,
      },

      payer: {
        gamePlayerId: result.visitor.id,
        playerId: result.visitor.playerId,
        name: result.visitor.player.name,
        pawnId: result.visitor.pawnId,
        pawnCode: result.visitor.pawn.pawnCode,
        balance: result.visitor.balance,
      },

      owner: {
        gamePlayerId: result.owner.id,
        playerId: result.owner.playerId,
        name: result.owner.player.name,
        pawnId: result.owner.pawnId,
        pawnCode: result.owner.pawn.pawnCode,
        balance: result.owner.balance,
      },

      transaction: {
        id: result.transaction.id,
        type: result.transaction.type,
        amount: result.transaction.amount,
        propertyId: result.transaction.propertyId,
      },

      event: {
        id: result.event.id,
        type: result.event.type,
      },
    });
  } catch (error) {
    console.error("PAY_RENT_ERROR:", error);

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
          error: "Player position is not set",
        },
        { status: 409 },
      );
    }

    if (
      error instanceof Error &&
      error.message === "NOT_A_PROPERTY"
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Current position is not a property",
        },
        { status: 400 },
      );
    }

    if (
      error instanceof Error &&
      error.message === "PROPERTY_UNOWNED"
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Property is unowned. No rent is due.",
        },
        { status: 409 },
      );
    }

    if (
      error instanceof Error &&
      error.message === "PLAYER_OWNS_PROPERTY"
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Player owns this property. Rent is not due.",
        },
        { status: 409 },
      );
    }

    if (
      error instanceof Error &&
      error.message === "OWNER_NOT_FOUND"
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Property owner could not be found",
        },
        { status: 500 },
      );
    }

    if (
      error instanceof Error &&
      error.message === "INVALID_RENT"
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid rent amount",
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
          error: "Player does not have enough money to pay rent",
        },
        { status: 409 },
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: "Unable to process rent payment",
      },
      { status: 500 },
    );
  }
}