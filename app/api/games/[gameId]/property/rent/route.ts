
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
              currentPosition: {
                include: {
                  properties: true,
                },
              },
            },
          },
        },
      });

      if (!turn) {
        throw new Error("NO_ACTIVE_TURN");
      }
      
// ----------------------------------------------------------
// 2A. Prevent duplicate rent payment for the same turn
// ----------------------------------------------------------

const existingActions =
  turn.actions &&
  typeof turn.actions === "object" &&
  !Array.isArray(turn.actions)
    ? turn.actions
    : {};

const existingRentPayment =
  "rentPayment" in existingActions &&
  typeof existingActions.rentPayment === "object" &&
  existingActions.rentPayment !== null &&
  !Array.isArray(existingActions.rentPayment)
    ? existingActions.rentPayment
    : null;

if (
  existingRentPayment &&
  "paid" in existingRentPayment &&
  existingRentPayment.paid === true
) {
  throw new Error("RENT_ALREADY_PAID");
}

      // ----------------------------------------------------------
      // 3. Determine tenant / current player
      // ----------------------------------------------------------

      const tenant = turn.player;

      if (!tenant.currentPositionId || !tenant.currentPosition) {
        throw new Error("PLAYER_POSITION_NOT_SET");
      }

      const position = tenant.currentPosition;

      // ----------------------------------------------------------
      // 4. Verify current position is purchasable property
      // ----------------------------------------------------------

      if (
        position.type !== "PROPERTY" &&
        position.type !== "RAILROAD" &&
        position.type !== "UTILITY"
      ) {
        throw new Error("NOT_RENTABLE_PROPERTY");
      }

      // ----------------------------------------------------------
      // 5. Find property
      // ----------------------------------------------------------

      const property = position.properties[0];

      if (!property) {
        throw new Error("PROPERTY_NOT_FOUND");
      }

      // ----------------------------------------------------------
      // 6. Find property owner
      // ----------------------------------------------------------

      const ownership = await tx.propertyOwnership.findUnique({
        where: {
          propertyId: property.id,
        },
        include: {
          player: {
            include: {
              player: true,
              pawn: true,
            },
          },
        },
      });

      if (!ownership) {
        throw new Error("PROPERTY_NOT_OWNED");
      }

      // ----------------------------------------------------------
      // 7. Prevent paying yourself
      // ----------------------------------------------------------

      if (ownership.gamePlayerId === tenant.id) {
        throw new Error("PLAYER_OWNS_PROPERTY");
      }

      // ----------------------------------------------------------
      // 8. Check mortgage status
      // ----------------------------------------------------------

      if (ownership.isMortgaged) {
        throw new Error("PROPERTY_MORTGAGED");
      }

      // ----------------------------------------------------------
      // 9. Determine rent
      // ----------------------------------------------------------

      if (property.baseRent === null) {
        throw new Error("RENT_NOT_CONFIGURED");
      }

      const rent = property.baseRent;

      // ----------------------------------------------------------
      // 10. Check tenant funds
      // ----------------------------------------------------------

      if (tenant.balance < rent) {
        throw new Error("INSUFFICIENT_FUNDS");
      }

      const owner = ownership.player;

      // ----------------------------------------------------------
      // 11. Transfer money
      // ----------------------------------------------------------

      const updatedTenant =
        await tx.gamePlayerAssignment.update({
          where: {
            id: tenant.id,
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

      const updatedOwner =
        await tx.gamePlayerAssignment.update({
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
            currentPosition: true,
          },
        });

      // ----------------------------------------------------------
      // 12. Create transaction record
      // ----------------------------------------------------------

      const transaction = await tx.transaction.create({
        data: {
          gameId,
          fromPlayerId: tenant.id,
          toPlayerId: owner.id,
          amount: rent,
          type: "RENT",
          reason: `Rent paid for ${property.name}`,
          propertyId: property.id,
          relatedAction: "PAY_RENT",
        },
      });

      // ----------------------------------------------------------
      // 13. Record game event
      // ----------------------------------------------------------

      const gameEvent = await tx.gameEvent.create({
        data: {
          gameId,
          type: "MONEY_TRANSFERRED",
          description: `${tenant.player.name} paid ${rent} rent to ${owner.player.name} for ${property.name}`,
          metadata: {
            turnId: turn.id,

            propertyId: property.id,
            propertyName: property.name,

            tenantGamePlayerId: tenant.id,
            tenantPlayerId: tenant.playerId,
            tenantPawnId: tenant.pawnId,

            ownerGamePlayerId: owner.id,
            ownerPlayerId: owner.playerId,
            ownerPawnId: owner.pawnId,

            amount: rent,

            tenantBalanceAfter: updatedTenant.balance,
            ownerBalanceAfter: updatedOwner.balance,
          },
        },
      });

      // ----------------------------------------------------------
      // 14. Update turn actions
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
            rentPayment: {
              propertyId: property.id,
              propertyName: property.name,
              amount: rent,
              paid: true,
              ownerGamePlayerId: owner.id,
              tenantGamePlayerId: tenant.id,
            },
          },
        },
      });

      return {
        turn,
        property,
        ownership,
        tenant: updatedTenant,
        owner: updatedOwner,
        transaction,
        gameEvent,
      };
    });

    // ------------------------------------------------------------
    // 15. Return response
    // ------------------------------------------------------------

    return NextResponse.json({
      success: true,
      message: "Rent paid successfully",

      gameId,

      turnId: result.turn.id,

      rent: {
        propertyId: result.property.id,
        propertyName: result.property.name,
        amount: result.property.baseRent,
      },

      payer: {
        gamePlayerId: result.tenant.id,
        playerId: result.tenant.playerId,
        name: result.tenant.player.name,
        pawnId: result.tenant.pawnId,
        pawnCode: result.tenant.pawn.pawnCode,
        balance: result.tenant.balance,
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
        id: result.gameEvent.id,
        type: result.gameEvent.type,
      },
    });
  } catch (error) {
    console.error("PROPERTY_RENT_ERROR:", error);

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
  error.message === "RENT_ALREADY_PAID"
) {
  return NextResponse.json(
    {
      success: false,
      error: "Rent has already been paid for this turn",
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
      error.message === "NOT_RENTABLE_PROPERTY"
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Current position is not a rentable property",
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
      error.message === "PROPERTY_NOT_OWNED"
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Property is not owned",
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
          error: "Player already owns this property",
        },
        { status: 409 },
      );
    }

    if (
      error instanceof Error &&
      error.message === "PROPERTY_MORTGAGED"
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Property is mortgaged and does not collect rent",
        },
        { status: 409 },
      );
    }

    if (
      error instanceof Error &&
      error.message === "RENT_NOT_CONFIGURED"
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Property rent is not configured",
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

