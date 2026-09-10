
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

    const body = await request.json().catch(() => ({}));

    const action =
      typeof body.action === "string"
        ? body.action.toUpperCase()
        : "";

    if (!["PAY_FINE", "ROLL"].includes(action)) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid Jail action",
          allowedActions: ["PAY_FINE", "ROLL"],
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
      // 3. CHECK JAIL STATUS
      // --------------------------------------------------

      if (!gamePlayer.isInJail) {
        throw new Error("PLAYER_NOT_IN_JAIL");
      }

      // ==================================================
      // PAY FINE
      // ==================================================

      if (action === "PAY_FINE") {
        const fine = 50;

        if (gamePlayer.balance < fine) {
          throw new Error("INSUFFICIENT_FUNDS");
        }

        const jailPosition = await tx.position.findFirst({
          where: {
            board: {
              gameId,
            },
            index: 10,
          },
        });

        if (!jailPosition) {
          throw new Error("JAIL_POSITION_NOT_FOUND");
        }

        const updatedPlayer =
          await tx.gamePlayerAssignment.update({
            where: {
              id: gamePlayer.id,
            },
            data: {
              balance: {
                decrement: fine,
              },
              isInJail: false,
              jailTurns: 0,
              currentPositionId: jailPosition.id,
            },
            include: {
              player: true,
              pawn: true,
              currentPosition: true,
            },
          });

        await tx.transaction.create({
          data: {
            gameId,
            fromPlayerId: gamePlayer.id,
            amount: fine,
            type: "FINE",
            reason: "Jail release fine",
            relatedAction: "JAIL_RELEASE",
          },
        });

        await tx.gameEvent.create({
          data: {
            gameId,
            type: "CUSTOM",
            description: `${gamePlayer.player.name} paid ₹${fine} to leave Jail`,
            metadata: {
              gamePlayerId: gamePlayer.id,
              pawnId: gamePlayer.pawnId,
              action: "JAIL_RELEASE",
              fine,
              balanceBefore: gamePlayer.balance,
              balanceAfter: updatedPlayer.balance,
            },
          },
        });

        return {
          mode: "PAY_FINE",
          gamePlayer: updatedPlayer,
          fine,
          dice1: null,
          dice2: null,
          total: null,
          isDouble: false,
          released: true,
          paidFine: true,
          moved: false,
        };
      }

      // ==================================================
      // ROLL FOR DOUBLES
      // ==================================================

      let dice1: number;
      let dice2: number;

      /*
       * TEST MODE
       *
       * If explicit dice values are supplied:
       *
       * {
       *   action: "ROLL",
       *   dice1: 3,
       *   dice2: 4
       * }
       *
       * they are used.
       *
       * Otherwise testDice=true gives 6 + 6.
       */

      if (
        Number.isInteger(body.dice1) &&
        Number.isInteger(body.dice2) &&
        body.dice1 >= 1 &&
        body.dice1 <= 6 &&
        body.dice2 >= 1 &&
        body.dice2 <= 6
      ) {
        dice1 = body.dice1;
        dice2 = body.dice2;
      } else if (body.testDice === true) {
        dice1 = 6;
        dice2 = 6;
      } else {
        dice1 = Math.floor(Math.random() * 6) + 1;
        dice2 = Math.floor(Math.random() * 6) + 1;
      }

      const total = dice1 + dice2;
      const isDouble = dice1 === dice2;

      const previousJailTurns = gamePlayer.jailTurns;
      const currentJailTurn = previousJailTurns + 1;

      // --------------------------------------------------
      // DOUBLE = RELEASE AND MOVE
      // --------------------------------------------------

      if (isDouble) {
        const positions = await tx.position.findMany({
          where: {
            board: {
              gameId,
            },
          },
          orderBy: {
            index: "asc",
          },
        });

        if (positions.length === 0) {
          throw new Error("POSITIONS_NOT_FOUND");
        }

        const currentIndex =
          gamePlayer.currentPosition?.index ?? 10;

        const newIndex =
          (currentIndex + total) % positions.length;

        const newPosition = positions.find(
          (position) => position.index === newIndex,
        );

        if (!newPosition) {
          throw new Error("DESTINATION_POSITION_NOT_FOUND");
        }

        const passedGo =
          currentIndex + total >= positions.length;

        const goSalary = passedGo ? 200 : 0;

        const updatedPlayer =
          await tx.gamePlayerAssignment.update({
            where: {
              id: gamePlayer.id,
            },
            data: {
              balance: {
                increment: goSalary,
              },
              isInJail: false,
              jailTurns: 0,
              currentPositionId: newPosition.id,
            },
            include: {
              player: true,
              pawn: true,
              currentPosition: true,
            },
          });

        if (goSalary > 0) {
          await tx.transaction.create({
            data: {
              gameId,
              toPlayerId: gamePlayer.id,
              amount: goSalary,
              type: "GO_PAYMENT",
              reason: "Passed GO after leaving Jail",
              relatedAction: "PASS_GO",
            },
          });
        }

        await tx.gameEvent.create({
          data: {
            gameId,
            type: "CUSTOM",
            description: `${gamePlayer.player.name} rolled doubles (${dice1}+${dice2}) and was released from Jail`,
            metadata: {
              gamePlayerId: gamePlayer.id,
              pawnId: gamePlayer.pawnId,
              action: "JAIL_ROLL_DOUBLE",
              dice1,
              dice2,
              total,
              previousJailTurns,
              currentJailTurn,
              passedGo,
              goSalary,
              fromPosition: gamePlayer.currentPosition?.index,
              toPosition: newPosition.index,
            },
          },
        });

        return {
          mode: "ROLL",
          gamePlayer: updatedPlayer,
          dice1,
          dice2,
          total,
          isDouble: true,
          released: true,
          paidFine: false,
          moved: true,
          passedGo,
          goSalary,
          jailTurn: currentJailTurn,
        };
      }

      // ==================================================
      // THIRD FAILED JAIL ATTEMPT
      // ==================================================

      if (currentJailTurn >= 3) {
        const fine = 50;

        if (gamePlayer.balance < fine) {
          throw new Error("INSUFFICIENT_FUNDS");
        }

        const positions = await tx.position.findMany({
          where: {
            board: {
              gameId,
            },
          },
          orderBy: {
            index: "asc",
          },
        });

        if (positions.length === 0) {
          throw new Error("POSITIONS_NOT_FOUND");
        }

        const currentIndex =
          gamePlayer.currentPosition?.index ?? 10;

        const newIndex =
          (currentIndex + total) % positions.length;

        const newPosition = positions.find(
          (position) => position.index === newIndex,
        );

        if (!newPosition) {
          throw new Error("DESTINATION_POSITION_NOT_FOUND");
        }

        const passedGo =
          currentIndex + total >= positions.length;

        const goSalary = passedGo ? 200 : 0;

        const balanceChange = goSalary - fine;

        const updatedPlayer =
          await tx.gamePlayerAssignment.update({
            where: {
              id: gamePlayer.id,
            },
            data: {
              balance: {
                increment: balanceChange,
              },
              isInJail: false,
              jailTurns: 0,
              currentPositionId: newPosition.id,
            },
            include: {
              player: true,
              pawn: true,
              currentPosition: true,
            },
          });

        await tx.transaction.create({
          data: {
            gameId,
            fromPlayerId: gamePlayer.id,
            amount: fine,
            type: "FINE",
            reason: "Third unsuccessful Jail roll",
            relatedAction: "JAIL_RELEASE",
          },
        });

        if (goSalary > 0) {
          await tx.transaction.create({
            data: {
              gameId,
              toPlayerId: gamePlayer.id,
              amount: goSalary,
              type: "GO_PAYMENT",
              reason: "Passed GO after Jail release",
              relatedAction: "PASS_GO",
            },
          });
        }

        await tx.gameEvent.create({
          data: {
            gameId,
            type: "CUSTOM",
            description: `${gamePlayer.player.name} failed three Jail rolls, paid ₹${fine}, and was released`,
            metadata: {
              gamePlayerId: gamePlayer.id,
              pawnId: gamePlayer.pawnId,
              action: "JAIL_THIRD_ATTEMPT",
              dice1,
              dice2,
              total,
              fine,
              jailTurns: currentJailTurn,
              passedGo,
              goSalary,
              fromPosition: currentIndex,
              toPosition: newPosition.index,
            },
          },
        });

        return {
          mode: "ROLL",
          gamePlayer: updatedPlayer,
          dice1,
          dice2,
          total,
          isDouble: false,
          released: true,
          paidFine: true,
          moved: true,
          passedGo,
          goSalary,
          fine,
          jailTurn: currentJailTurn,
        };
      }

      // ==================================================
      // FAILED JAIL ATTEMPT — REMAIN IN JAIL
      // ==================================================

      const updatedPlayer =
        await tx.gamePlayerAssignment.update({
          where: {
            id: gamePlayer.id,
          },
          data: {
            jailTurns: currentJailTurn,
          },
          include: {
            player: true,
            pawn: true,
            currentPosition: true,
          },
        });

      await tx.gameEvent.create({
        data: {
          gameId,
          type: "CUSTOM",
          description: `${gamePlayer.player.name} failed Jail roll (${dice1}+${dice2}) and remains in Jail`,
          metadata: {
            gamePlayerId: gamePlayer.id,
            pawnId: gamePlayer.pawnId,
            action: "JAIL_ROLL_FAILED",
            dice1,
            dice2,
            total,
            jailTurns: currentJailTurn,
          },
        },
      });

      return {
        mode: "ROLL",
        gamePlayer: updatedPlayer,
        dice1,
        dice2,
        total,
        isDouble: false,
        released: false,
        paidFine: false,
        moved: false,
        passedGo: false,
        goSalary: 0,
        fine: 0,
        jailTurn: currentJailTurn,
      };
    });

    // ==================================================
    // RESPONSE
    // ==================================================

    if (result.mode === "PAY_FINE") {
      return NextResponse.json({
        success: true,
        action: "JAIL_RELEASE",
        message: "Player paid ₹50 and was released from Jail",
        fine: result.fine,
        player: {
          gamePlayerId: result.gamePlayer.id,
          playerId: result.gamePlayer.playerId,
          name: result.gamePlayer.player.name,
          pawnId: result.gamePlayer.pawnId,
          pawnCode: result.gamePlayer.pawn.pawnCode,
          balance: result.gamePlayer.balance,
          isInJail: result.gamePlayer.isInJail,
          jailTurns: result.gamePlayer.jailTurns,
          currentPosition: result.gamePlayer.currentPosition,
        },
      });
    }

    return NextResponse.json({
      success: true,
      action: result.released
        ? "JAIL_RELEASE"
        : "JAIL_ROLL",

      message: result.released
        ? result.paidFine
          ? "Third Jail attempt failed. Player paid ₹50 and was released."
          : "Player rolled doubles and was released from Jail."
        : "Player did not roll doubles and remains in Jail.",

      dice1: result.dice1,
      dice2: result.dice2,
      total: result.total,
      isDouble: result.isDouble,

      jailTurn: result.jailTurn,

      released: result.released,
      paidFine: result.paidFine,
      moved: result.moved,

      passedGo: result.passedGo,
      goSalary: result.goSalary,
      fine: result.fine ?? 0,

      player: {
        gamePlayerId: result.gamePlayer.id,
        playerId: result.gamePlayer.playerId,
        name: result.gamePlayer.player.name,
        pawnId: result.gamePlayer.pawnId,
        pawnCode: result.gamePlayer.pawn.pawnCode,
        balance: result.gamePlayer.balance,
        isInJail: result.gamePlayer.isInJail,
        jailTurns: result.gamePlayer.jailTurns,
        currentPosition: result.gamePlayer.currentPosition,
      },
    });
  } catch (error) {
    console.error("JAIL_ACTION_ERROR:", error);

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
      error.message === "PLAYER_NOT_IN_JAIL"
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Player is not in Jail",
        },
        { status: 409 },
      );
    }

    if (
      error instanceof Error &&
      error.message === "INSUFFICIENT_FUNDS"
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Insufficient balance",
        },
        { status: 409 },
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
      error.message === "POSITIONS_NOT_FOUND"
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Board positions not found",
        },
        { status: 500 },
      );
    }

    if (
      error instanceof Error &&
      error.message === "DESTINATION_POSITION_NOT_FOUND"
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Destination position not found",
        },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: "Unable to process Jail action",
      },
      { status: 500 },
    );
  }
}

