
import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

type RouteContext = {
  params: Promise<{
    gameId: string;
  }>;
};

// --------------------------------------------------
// DICE
// --------------------------------------------------

function rollDie() {
  return Math.floor(Math.random() * 6) + 1;
}

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

    // --------------------------------------------------
    // TEST MODE
    // --------------------------------------------------
    //
    // Send:
    //
    // {
    //   "testDice": true
    // }
    //
    // to force 6 + 6.
    //
    // Normal gameplay remains random.
    // --------------------------------------------------

    const body = await request.json().catch(() => ({}));

    const testDice =
      body &&
      typeof body === "object" &&
      !Array.isArray(body) &&
      body.testDice === true;

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

      const currentTurn = await tx.turn.findFirst({
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

      if (!currentTurn) {
        throw new Error("NO_ACTIVE_TURN");
      }

      const gamePlayer = currentTurn.player;

      // --------------------------------------------------
      // 3. CHECK PLAYER POSITION
      // --------------------------------------------------

      if (!gamePlayer.currentPosition) {
        throw new Error("PLAYER_POSITION_NOT_SET");
      }

      // --------------------------------------------------
      // 4. PLAYER IN JAIL
      // --------------------------------------------------
      //
      // A jailed player cannot perform a normal dice roll.
      // They must first use the Jail route to get released.
      // --------------------------------------------------

      if (gamePlayer.isInJail) {
        throw new Error("PLAYER_IN_JAIL");
      }

      // --------------------------------------------------
      // 5. FIND BOARD
      // --------------------------------------------------

      const board = await tx.board.findUnique({
        where: {
          gameId,
        },
        include: {
          positions: {
            orderBy: {
              index: "asc",
            },
          },
        },
      });

      if (!board) {
        throw new Error("BOARD_NOT_FOUND");
      }

      if (board.positions.length === 0) {
        throw new Error("BOARD_EMPTY");
      }

      // --------------------------------------------------
      // 6. ROLL DICE
      // --------------------------------------------------

      const dice1 = testDice ? 6 : rollDie();
      const dice2 = testDice ? 6 : rollDie();

      const total = dice1 + dice2;

      // Our special rule considers ONLY 6 + 6 a double.
      const isDoubleSix =
        dice1 === 6 && dice2 === 6;

      // --------------------------------------------------
      // 7. READ PREVIOUS 6+6 COUNT
      // --------------------------------------------------
      //
      // IMPORTANT:
      // sixSixCount is stored inside Turn.actions.
      //
      // It is NOT a field on GamePlayerAssignment.
      // --------------------------------------------------

      const existingActions =
        currentTurn.actions &&
        typeof currentTurn.actions === "object" &&
        !Array.isArray(currentTurn.actions)
          ? currentTurn.actions as Record<string, unknown>
          : {};

      const previousSixSixCount =
        typeof existingActions.sixSixCount === "number"
          ? existingActions.sixSixCount
          : 0;

      // --------------------------------------------------
      // 8. DETERMINE SIX-SIX COUNT
      // --------------------------------------------------

      const isThirdDoubleSix =
        isDoubleSix &&
        previousSixSixCount >= 2;

      const sixSixCount = isDoubleSix
        ? previousSixSixCount + 1
        : 0;

      // --------------------------------------------------
      // 9. CURRENT POSITION
      // --------------------------------------------------

      const currentIndex =
        gamePlayer.currentPosition.index;

      let newBalance = gamePlayer.balance;

      // --------------------------------------------------
      // 10. THIRD 6+6 → JAIL
      // --------------------------------------------------
      //
      // Third consecutive 6+6:
      //
      // 1. Do NOT move 12 spaces.
      // 2. Find Jail at index 10.
      // 3. Move directly to Jail.
      // 4. Deduct ₹100.
      // 5. Set isInJail = true.
      // 6. Reset jailTurns.
      //
      // --------------------------------------------------

      if (isThirdDoubleSix) {
        const jailPosition =
          board.positions.find(
            (position) => position.index === 10,
          );

        if (!jailPosition) {
          throw new Error("JAIL_POSITION_NOT_FOUND");
        }

        const fine = 100;

        newBalance -= fine;

        const updatedPlayer =
          await tx.gamePlayerAssignment.update({
            where: {
              id: gamePlayer.id,
            },
            data: {
              currentPositionId: jailPosition.id,
              balance: newBalance,
              isInJail: true,
              jailTurns: 0,
            },
            include: {
              player: true,
              pawn: true,
              currentPosition: true,
            },
          });

        // --------------------------------------------------
        // SAVE TURN ACTIONS
        // --------------------------------------------------

        const updatedActions = {
          ...existingActions,

          type: "THIRD_DOUBLE_SIX_JAIL",

          dice1,
          dice2,
          total,

          isDoubleSix: true,

          previousSixSixCount,
          sixSixCount,

          thirdDoubleSix: true,
          sentToJail: true,

          fine,

          fromPosition: {
            id: gamePlayer.currentPosition.id,
            index: currentIndex,
            name: gamePlayer.currentPosition.name,
          },

          toPosition: {
            id: jailPosition.id,
            index: jailPosition.index,
            name: jailPosition.name,
          },

          passedGo: false,
          goSalary: 0,

          testDice,
        };

        await tx.turn.update({
          where: {
            id: currentTurn.id,
          },
          data: {
            endingPositionId: jailPosition.id,
            actions: updatedActions,
          },
        });

        // --------------------------------------------------
        // POSITION / JAIL EVENT
        // --------------------------------------------------

        await tx.gameEvent.create({
          data: {
            gameId,
            type: "POSITION_CHANGED",
            description:
              `${gamePlayer.player.name} rolled 6,6 for the third time and was sent to Jail with a ₹100 fine`,
            metadata: {
              gamePlayerId: gamePlayer.id,
              pawnId: gamePlayer.pawnId,

              dice1,
              dice2,
              total,

              fromIndex: currentIndex,
              toIndex: 10,

              passedGo: false,

              isDoubleSix: true,
              previousSixSixCount,
              sixSixCount,

              thirdDoubleSix: true,
              sentToJail: true,

              fine,

              balanceBefore: gamePlayer.balance,
              balanceAfter: newBalance,

              testDice,
            },
          },
        });

        // --------------------------------------------------
        // RETURN THIRD 6+6 RESULT
        // --------------------------------------------------

        return {
          turnId: currentTurn.id,

          dice1,
          dice2,
          total,

          passedGo: false,
          goSalary: 0,

          isDoubleSix: true,

          previousSixSixCount,
          sixSixCount,

          thirdDoubleSix: true,
          sentToJail: true,

          fine,

          fromPosition:
            gamePlayer.currentPosition,

          toPosition: jailPosition,

          player: updatedPlayer,

          testDice,
        };
      }

      // --------------------------------------------------
      // 11. NORMAL MOVEMENT
      // --------------------------------------------------

      const newIndex =
        (currentIndex + total) %
        board.positions.length;

      const passedGo =
        currentIndex + total >=
        board.positions.length;

      const newPosition =
        board.positions.find(
          (position) =>
            position.index === newIndex,
        );

      if (!newPosition) {
        throw new Error("DESTINATION_NOT_FOUND");
      }

      // --------------------------------------------------
      // 12. PAY ₹200 FOR PASSING GO
      // --------------------------------------------------

      if (passedGo) {
        newBalance += 200;
      }

      // --------------------------------------------------
      // 13. UPDATE PLAYER
      // --------------------------------------------------

      const updatedPlayer =
        await tx.gamePlayerAssignment.update({
          where: {
            id: gamePlayer.id,
          },
          data: {
            currentPositionId: newPosition.id,
            balance: newBalance,
          },
          include: {
            player: true,
            pawn: true,
            currentPosition: true,
          },
        });

      // --------------------------------------------------
      // 14. SAVE TURN ACTIONS
      // --------------------------------------------------

      const updatedActions = {
        ...existingActions,

        type: "DICE_ROLLED",

        dice1,
        dice2,
        total,

        isDoubleSix,

        previousSixSixCount,
        sixSixCount,

        thirdDoubleSix: false,
        sentToJail: false,

        fine: 0,

        fromPosition: {
          id: gamePlayer.currentPosition.id,
          index: currentIndex,
          name: gamePlayer.currentPosition.name,
        },

        toPosition: {
          id: newPosition.id,
          index: newPosition.index,
          name: newPosition.name,
        },

        passedGo,
        goSalary: passedGo ? 200 : 0,

        testDice,
      };

      await tx.turn.update({
        where: {
          id: currentTurn.id,
        },
        data: {
          endingPositionId: newPosition.id,
          actions: updatedActions,
        },
      });

      // --------------------------------------------------
      // 15. POSITION CHANGED EVENT
      // --------------------------------------------------

      await tx.gameEvent.create({
        data: {
          gameId,
          type: "POSITION_CHANGED",

          description:
            `${gamePlayer.player.name} moved from ${gamePlayer.currentPosition.name} to ${newPosition.name}`,

          metadata: {
            gamePlayerId: gamePlayer.id,
            pawnId: gamePlayer.pawnId,

            dice1,
            dice2,
            total,

            fromIndex: currentIndex,
            toIndex: newIndex,

            passedGo,

            isDoubleSix,

            previousSixSixCount,
            sixSixCount,

            testDice,
          },
        },
      });

      // --------------------------------------------------
      // 16. GO PASSED EVENT
      // --------------------------------------------------

      if (passedGo) {
        await tx.gameEvent.create({
          data: {
            gameId,
            type: "GO_PASSED",

            description:
              `${gamePlayer.player.name} passed GO and received ₹200`,

            metadata: {
              gamePlayerId: gamePlayer.id,

              amount: 200,

              balanceBefore:
                gamePlayer.balance,

              balanceAfter:
                newBalance,
            },
          },
        });
      }

      // --------------------------------------------------
      // 17. RETURN NORMAL RESULT
      // --------------------------------------------------

      return {
        turnId: currentTurn.id,

        dice1,
        dice2,
        total,

        passedGo,
        goSalary: passedGo ? 200 : 0,

        isDoubleSix,

        previousSixSixCount,
        sixSixCount,

        thirdDoubleSix: false,
        sentToJail: false,

        fine: 0,

        fromPosition:
          gamePlayer.currentPosition,

        toPosition:
          newPosition,

        player: updatedPlayer,

        testDice,
      };
    });

    // --------------------------------------------------
    // 18. SUCCESS RESPONSE
    // --------------------------------------------------

    return NextResponse.json({
      success: true,
      result,
    });
  } catch (error) {
    console.error(
      "ROLL_DICE_ERROR:",
      error,
    );

    // --------------------------------------------------
    // ERROR HANDLING
    // --------------------------------------------------

    if (
      error instanceof Error &&
      error.message ===
        "GAME_NOT_FOUND"
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
      error.message ===
        "GAME_NOT_ACTIVE"
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
      error.message ===
        "NO_ACTIVE_TURN"
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "There is no active turn",
        },
        { status: 409 },
      );
    }

    if (
      error instanceof Error &&
      error.message ===
        "PLAYER_POSITION_NOT_SET"
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Player position has not been initialized",
        },
        { status: 409 },
      );
    }

    if (
      error instanceof Error &&
      error.message ===
        "PLAYER_IN_JAIL"
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Player is in Jail",
          message:
            "Player cannot move normally while in Jail",
        },
        { status: 409 },
      );
    }

    if (
      error instanceof Error &&
      error.message ===
        "BOARD_NOT_FOUND"
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Board not found",
        },
        { status: 404 },
      );
    }

    if (
      error instanceof Error &&
      error.message ===
        "BOARD_EMPTY"
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Board has no positions",
        },
        { status: 500 },
      );
    }

    if (
      error instanceof Error &&
      error.message ===
        "JAIL_POSITION_NOT_FOUND"
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Jail position not found on board",
        },
        { status: 500 },
      );
    }

    if (
      error instanceof Error &&
      error.message ===
        "DESTINATION_NOT_FOUND"
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Destination position not found",
        },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: "Unable to roll dice",
      },
      { status: 500 },
    );
  }
}
