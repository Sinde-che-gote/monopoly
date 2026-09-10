
import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

type RouteContext = {
  params: Promise<{
    gameId: string;
  }>;
};

const BOARD_SPACES = [
  { index: 0, name: "GO", type: "GO" },

  {
    index: 1,
    name: "Mediterranean Avenue",
    type: "PROPERTY",
    price: 60,
    baseRent: 2,
    mortgageValue: 30,
    colourGroup: "BROWN",
  },
  { index: 2, name: "Community Chest", type: "COMMUNITY_CHEST" },
  {
    index: 3,
    name: "Baltic Avenue",
    type: "PROPERTY",
    price: 60,
    baseRent: 4,
    mortgageValue: 30,
    colourGroup: "BROWN",
  },
  { index: 4, name: "Income Tax", type: "TAX" },

  {
    index: 5,
    name: "Reading Railroad",
    type: "RAILROAD",
    price: 200,
    baseRent: 25,
    mortgageValue: 100,
  },
  {
    index: 6,
    name: "Oriental Avenue",
    type: "PROPERTY",
    price: 100,
    baseRent: 6,
    mortgageValue: 50,
    colourGroup: "LIGHT_BLUE",
  },
  { index: 7, name: "Chance", type: "CHANCE" },
  {
    index: 8,
    name: "Vermont Avenue",
    type: "PROPERTY",
    price: 100,
    baseRent: 6,
    mortgageValue: 50,
    colourGroup: "LIGHT_BLUE",
  },
  {
    index: 9,
    name: "Connecticut Avenue",
    type: "PROPERTY",
    price: 120,
    baseRent: 8,
    mortgageValue: 60,
    colourGroup: "LIGHT_BLUE",
  },

  { index: 10, name: "Jail / Just Visiting", type: "JAIL" },

  {
    index: 11,
    name: "St. Charles Place",
    type: "PROPERTY",
    price: 140,
    baseRent: 10,
    mortgageValue: 70,
    colourGroup: "PINK",
  },
  {
    index: 12,
    name: "Electric Company",
    type: "UTILITY",
    price: 150,
    mortgageValue: 75,
  },
  {
    index: 13,
    name: "States Avenue",
    type: "PROPERTY",
    price: 140,
    baseRent: 10,
    mortgageValue: 70,
    colourGroup: "PINK",
  },
  {
    index: 14,
    name: "Virginia Avenue",
    type: "PROPERTY",
    price: 160,
    baseRent: 12,
    mortgageValue: 80,
    colourGroup: "PINK",
  },
  {
    index: 15,
    name: "Pennsylvania Railroad",
    type: "RAILROAD",
    price: 200,
    baseRent: 25,
    mortgageValue: 100,
  },
  {
    index: 16,
    name: "St. James Place",
    type: "PROPERTY",
    price: 180,
    baseRent: 14,
    mortgageValue: 90,
    colourGroup: "ORANGE",
  },
  { index: 17, name: "Community Chest", type: "COMMUNITY_CHEST" },
  {
    index: 18,
    name: "Tennessee Avenue",
    type: "PROPERTY",
    price: 180,
    baseRent: 14,
    mortgageValue: 90,
    colourGroup: "ORANGE",
  },
  {
    index: 19,
    name: "New York Avenue",
    type: "PROPERTY",
    price: 200,
    baseRent: 16,
    mortgageValue: 100,
    colourGroup: "ORANGE",
  },

  { index: 20, name: "Free Parking", type: "FREE_PARKING" },

  {
    index: 21,
    name: "Kentucky Avenue",
    type: "PROPERTY",
    price: 220,
    baseRent: 18,
    mortgageValue: 110,
    colourGroup: "RED",
  },
  { index: 22, name: "Chance", type: "CHANCE" },
  {
    index: 23,
    name: "Indiana Avenue",
    type: "PROPERTY",
    price: 220,
    baseRent: 18,
    mortgageValue: 110,
    colourGroup: "RED",
  },
  {
    index: 24,
    name: "Illinois Avenue",
    type: "PROPERTY",
    price: 240,
    baseRent: 20,
    mortgageValue: 120,
    colourGroup: "RED",
  },
  {
    index: 25,
    name: "B. & O. Railroad",
    type: "RAILROAD",
    price: 200,
    baseRent: 25,
    mortgageValue: 100,
  },
  {
    index: 26,
    name: "Atlantic Avenue",
    type: "PROPERTY",
    price: 260,
    baseRent: 22,
    mortgageValue: 130,
    colourGroup: "YELLOW",
  },
  {
    index: 27,
    name: "Ventnor Avenue",
    type: "PROPERTY",
    price: 260,
    baseRent: 22,
    mortgageValue: 130,
    colourGroup: "YELLOW",
  },
  {
    index: 28,
    name: "Water Works",
    type: "UTILITY",
    price: 150,
    mortgageValue: 75,
  },
  {
    index: 29,
    name: "Marvin Gardens",
    type: "PROPERTY",
    price: 280,
    baseRent: 24,
    mortgageValue: 140,
    colourGroup: "YELLOW",
  },

  { index: 30, name: "Go To Jail", type: "GO_TO_JAIL" },

  {
    index: 31,
    name: "Pacific Avenue",
    type: "PROPERTY",
    price: 300,
    baseRent: 26,
    mortgageValue: 150,
    colourGroup: "GREEN",
  },
  {
    index: 32,
    name: "North Carolina Avenue",
    type: "PROPERTY",
    price: 300,
    baseRent: 26,
    mortgageValue: 150,
    colourGroup: "GREEN",
  },
  { index: 33, name: "Community Chest", type: "COMMUNITY_CHEST" },
  {
    index: 34,
    name: "Pennsylvania Avenue",
    type: "PROPERTY",
    price: 320,
    baseRent: 28,
    mortgageValue: 160,
    colourGroup: "GREEN",
  },
  {
    index: 35,
    name: "Short Line",
    type: "RAILROAD",
    price: 200,
    baseRent: 25,
    mortgageValue: 100,
  },
  { index: 36, name: "Chance", type: "CHANCE" },
  {
    index: 37,
    name: "Park Place",
    type: "PROPERTY",
    price: 350,
    baseRent: 35,
    mortgageValue: 175,
    colourGroup: "DARK_BLUE",
  },
  { index: 38, name: "Luxury Tax", type: "TAX" },
  {
    index: 39,
    name: "Boardwalk",
    type: "PROPERTY",
    price: 400,
    baseRent: 50,
    mortgageValue: 200,
    colourGroup: "DARK_BLUE",
  },
] as const;

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
      const game = await tx.game.findUnique({
        where: {
          id: gameId,
        },
        include: {
          board: true,
        },
      });

      if (!game) {
        throw new Error("GAME_NOT_FOUND");
      }

      if (game.board) {
        throw new Error("BOARD_ALREADY_EXISTS");
      }

      const board = await tx.board.create({
        data: {
          gameId,
          name: "Classic Monopoly Board",
          description: "Standard 40-space Monopoly board",
        },
      });

      for (const space of BOARD_SPACES) {
        const position = await tx.position.create({
          data: {
            boardId: board.id,
            index: space.index,
            name: space.name,
            type: space.type,
            price: "price" in space ? space.price : null,
            baseRent: "baseRent" in space ? space.baseRent : null,
            mortgageValue:
              "mortgageValue" in space
                ? space.mortgageValue
                : null,
            colourGroup:
              "colourGroup" in space
                ? space.colourGroup
                : null,
          },
        });

        if (space.type === "PROPERTY") {
          await tx.property.create({
            data: {
              positionId: position.id,
              name: space.name,
              type: "PROPERTY",
              price: space.price,
              baseRent: space.baseRent,
              mortgageValue: space.mortgageValue,
              colourGroup: space.colourGroup,
            },
          });
        }

        if (space.type === "RAILROAD") {
          await tx.property.create({
            data: {
              positionId: position.id,
              name: space.name,
              type: "RAILROAD",
              price: space.price,
              baseRent: space.baseRent,
              mortgageValue: space.mortgageValue,
            },
          });
        }

        if (space.type === "UTILITY") {
          await tx.property.create({
            data: {
              positionId: position.id,
              name: space.name,
              type: "UTILITY",
              price: space.price,
              mortgageValue: space.mortgageValue,
            },
          });
        }
      }

      await tx.gameEvent.create({
        data: {
          gameId,
          type: "CUSTOM",
          description: "Classic Monopoly board created",
          metadata: {
            boardId: board.id,
            positionCount: BOARD_SPACES.length,
          },
        },
      });

      return tx.board.findUnique({
        where: {
          id: board.id,
        },
        include: {
          positions: {
            orderBy: {
              index: "asc",
            },
            include: {
              properties: true,
            },
          },
        },
      });
    });

    return NextResponse.json(
      {
        success: true,
        board: result,
        positionCount: result?.positions.length ?? 0,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("CREATE_BOARD_ERROR:", error);

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
      error.message === "BOARD_ALREADY_EXISTS"
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Board already exists for this game",
        },
        { status: 409 },
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: "Unable to create board",
      },
      { status: 500 },
    );
  }
}

export async function GET(
  _request: Request,
  context: RouteContext,
) {
  try {
    const { gameId } = await context.params;

    const board = await prisma.board.findUnique({
      where: {
        gameId,
      },
      include: {
        positions: {
          orderBy: {
            index: "asc",
          },
          include: {
            properties: {
              include: {
                ownership: true,
                buildings: true,
              },
            },
          },
        },
      },
    });

    if (!board) {
      return NextResponse.json(
        {
          success: false,
          error: "Board not found",
        },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      board,
      positionCount: board.positions.length,
    });
  } catch (error) {
    console.error("GET_BOARD_ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Unable to fetch board",
      },
      { status: 500 },
    );
  }
}