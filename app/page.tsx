
"use client";

import { useEffect, useState } from "react";

const ACTIVE_GAME_ID = "cmt2y5j2w000a60tg4ywlqpa8";

type Position = {
  id: string;
  index: number;
  name: string;
  type: string;
  price?: number | null;
  baseRent?: number | null;
};

type PlayerAssignment = {
  id: string;
  gameId: string;
  startingCash: number;
  balance: number;
  turnOrder: number;
  isActive: boolean;
  player: {
    id: string;
    name: string;
  };
  pawn: {
    id: string;
    pawnCode: string;
    name: string;
  };
  currentPosition: Position | null;
};

type TurnData = {
  id: string;
  gameId: string;
  gamePlayerId: string;
  startedAt: string;
  endedAt: string | null;
  actions: {
    type?: string;
    dice1?: number;
    dice2?: number;
    total?: number;
    isDoubleSix?: boolean;
    sixSixCount?: number;
    thirdDoubleSix?: boolean;
    sentToJail?: boolean;
    fine?: number;
    passedGo?: boolean;
    goSalary?: number;
    fromPosition?: {
      index: number;
      name: string;
    };
    toPosition?: {
      index: number;
      name: string;
    };
  };
  player: PlayerAssignment;
};

type GameData = {
  success: boolean;
  game: {
    id: string;
    name: string;
    status: string;
  };
  currentTurn: TurnData | null;
  players: PlayerAssignment[];
};

type RollResult = {
  turnId: string;
  dice1: number;
  dice2: number;
  total: number;
  passedGo: boolean;
  goSalary: number;
  isDoubleSix: boolean;
  sixSixCount: number;
  thirdDoubleSix: boolean;
  sentToJail: boolean;
  fine: number;
  fromPosition: Position;
  toPosition: Position;
  player: PlayerAssignment;
};

export default function Home() {
  const [game, setGame] = useState<GameData | null>(null);
  const [loading, setLoading] = useState(true);
  const [rolling, setRolling] = useState(false);
  const [error, setError] = useState("");
  const [rollResult, setRollResult] = useState<RollResult | null>(null);

  async function loadGame() {
    try {
      setError("");

      const response = await fetch(
        `/api/games/${ACTIVE_GAME_ID}/turn`,
        {
          method: "GET",
          cache: "no-store",
        },
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Unable to load game");
      }

      setGame(data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load game",
      );
    } finally {
      setLoading(false);
    }
  }

  async function rollDice() {
    if (!game?.currentTurn) {
      setError("There is no active turn.");
      return;
    }

    setRolling(true);
    setError("");
    setRollResult(null);

    try {
      const response = await fetch(
        `/api/games/${ACTIVE_GAME_ID}/turn/roll`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
        },
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Unable to roll dice");
      }

      setRollResult(data.result);

      await loadGame();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to roll dice",
      );
    } finally {
      setRolling(false);
    }
  }

  useEffect(() => {
  let cancelled = false;

  async function initialLoad() {
    try {
      setError("");

      const response = await fetch(
        `/api/games/${ACTIVE_GAME_ID}/turn`,
        {
          method: "GET",
          cache: "no-store",
        },
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.error || "Unable to load game",
        );
      }

      if (!cancelled) {
        setGame(data);
      }
    } catch (err) {
      if (!cancelled) {
        setError(
          err instanceof Error
            ? err.message
            : "Unable to load game",
        );
      }
    } finally {
      if (!cancelled) {
        setLoading(false);
      }
    }
  }

  initialLoad();

  return () => {
    cancelled = true;
  };
}, []);

  const currentPlayer = game?.currentTurn?.player;

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-7xl px-6 py-10">

        {/* HEADER */}
        <header className="mb-8">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-amber-400">
            Monopoly Banker
          </p>

          <h1 className="mt-3 text-4xl font-bold tracking-tight">
            Digital Board Game Control Centre
          </h1>

          <p className="mt-3 text-slate-400">
            Manage the active Monopoly game, players, money,
            pawns and turns.
          </p>
        </header>

        {/* ERROR */}
        {error && (
          <div className="mb-6 rounded-2xl border border-red-800 bg-red-950/50 p-5 text-red-300">
            <strong>Error:</strong> {error}
          </div>
        )}

        {loading ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-10 text-center text-slate-400">
            Loading Monopoly game...
          </div>
        ) : (
          <>
            {/* GAME STATUS */}
            <section className="mb-6 rounded-2xl border border-emerald-900 bg-emerald-950/30 p-6">
              <div className="flex flex-wrap items-center justify-between gap-4">

                <div>
                  <p className="text-sm uppercase tracking-wider text-slate-500">
                    Active Game
                  </p>

                  <h2 className="mt-1 text-2xl font-bold">
                    {game?.game.name}
                  </h2>
                </div>

                <span className="rounded-full bg-emerald-900 px-4 py-2 text-sm font-bold text-emerald-300">
                  {game?.game.status}
                </span>

              </div>
            </section>

            {/* CURRENT TURN */}
            <section className="mb-6 grid gap-6 lg:grid-cols-2">

              <div className="rounded-2xl border border-amber-800 bg-slate-900 p-6 shadow-xl">

                <p className="text-sm font-semibold uppercase tracking-wider text-amber-400">
                  Current Turn
                </p>

                {currentPlayer ? (
                  <>
                    <h2 className="mt-3 text-3xl font-bold">
                      {currentPlayer.player.name}
                    </h2>

                    <div className="mt-5 grid gap-3 sm:grid-cols-2">

                      <Info
                        label="Turn Order"
                        value={String(currentPlayer.turnOrder)}
                      />

                      <Info
                        label="Pawn"
                        value={`${currentPlayer.pawn.name} (${currentPlayer.pawn.pawnCode})`}
                      />

                      <Info
                        label="Balance"
                        value={`₹${currentPlayer.balance.toLocaleString("en-IN")}`}
                      />

                      <Info
                        label="Position"
                        value={
                          currentPlayer.currentPosition
                            ? `${currentPlayer.currentPosition.name} (${currentPlayer.currentPosition.index})`
                            : "Unknown"
                        }
                      />

                    </div>
                  </>
                ) : (
                  <p className="mt-4 text-slate-400">
                    No active turn.
                  </p>
                )}

              </div>

              {/* DICE PANEL */}
              <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl">

                <p className="text-sm font-semibold uppercase tracking-wider text-slate-500">
                  Dice Control
                </p>

                <div className="mt-5 flex flex-col items-center">

                  {rollResult ? (
                    <div className="flex items-center gap-5">

                      <Die value={rollResult.dice1} />

                      <span className="text-3xl font-bold text-slate-500">
                        +
                      </span>

                      <Die value={rollResult.dice2} />

                      <span className="text-3xl font-bold text-slate-500">
                        =
                      </span>

                      <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-amber-400 text-3xl font-black text-slate-950">
                        {rollResult.total}
                      </div>

                    </div>
                  ) : (
                    <div className="flex h-20 items-center text-lg text-slate-500">
                      Ready to roll
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={rollDice}
                    disabled={rolling || !currentPlayer}
                    className="mt-6 w-full rounded-2xl bg-amber-400 px-6 py-5 text-xl font-black text-slate-950 shadow-lg transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {rolling ? "ROLLING..." : "🎲 ROLL DICE"}
                  </button>

                </div>
              </div>

            </section>

            {/* LAST ROLL */}
            {rollResult && (
              <section className="mb-6 rounded-2xl border border-blue-900 bg-blue-950/30 p-6">

                <h2 className="text-xl font-bold">
                  Last Roll
                </h2>

                <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">

                  <Info
                    label="From"
                    value={`${rollResult.fromPosition.name} (${rollResult.fromPosition.index})`}
                  />

                  <Info
                    label="To"
                    value={`${rollResult.toPosition.name} (${rollResult.toPosition.index})`}
                  />

                  <Info
                    label="Dice"
                    value={`${rollResult.dice1} + ${rollResult.dice2} = ${rollResult.total}`}
                  />

                  <Info
                    label="GO Salary"
                    value={
                      rollResult.goSalary > 0
                        ? "₹200"
                        : "None"
                    }
                  />

                </div>

                {rollResult.thirdDoubleSix && (
                  <div className="mt-5 rounded-xl border border-red-800 bg-red-950/50 p-5">
                    <p className="text-lg font-bold text-red-300">
                      🚔 THIRD 6 + 6 — SENT TO JAIL
                    </p>

                    <p className="mt-2 text-red-400">
                      Jail fine: ₹{rollResult.fine}
                    </p>
                  </div>
                )}

                {rollResult.isDoubleSix &&
                  !rollResult.thirdDoubleSix && (
                    <div className="mt-5 rounded-xl border border-amber-800 bg-amber-950/40 p-5">
                      <p className="font-bold text-amber-300">
                        🎲 6 + 6!
                      </p>

                      <p className="mt-1 text-sm text-amber-400">
                        Consecutive 6+6 count:{" "}
                        {rollResult.sixSixCount}
                      </p>
                    </div>
                  )}

                {rollResult.passedGo && (
                  <div className="mt-5 rounded-xl border border-emerald-800 bg-emerald-950/40 p-5">
                    <p className="font-bold text-emerald-300">
                      💰 PASSED GO
                    </p>

                    <p className="mt-1 text-sm text-emerald-400">
                      ₹200 added to the player&apos;s balance.
                    </p>
                  </div>
                )}

              </section>
            )}

            {/* PLAYERS */}
            <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl">

              <div className="flex items-center justify-between">

                <div>
                  <h2 className="text-xl font-bold">
                    Players & Pawns
                  </h2>

                  <p className="mt-1 text-sm text-slate-400">
                    Players in the active Monopoly game.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={loadGame}
                  className="rounded-xl border border-slate-700 px-4 py-2 text-sm font-semibold hover:border-amber-400 hover:text-amber-400"
                >
                  Refresh
                </button>

              </div>

              <div className="mt-6 grid gap-4 lg:grid-cols-2">

                {game?.players.map((assignment) => (

                  <div
                    key={assignment.id}
                    className={`rounded-2xl border p-5 ${
                      assignment.id ===
                      game.currentTurn?.gamePlayerId
                        ? "border-amber-700 bg-amber-950/20"
                        : "border-slate-800 bg-slate-950"
                    }`}
                  >

                    <div className="flex items-start justify-between">

                      <div>
                        <p className="text-xs uppercase tracking-wider text-slate-500">
                          Player
                        </p>

                        <h3 className="mt-1 text-xl font-bold">
                          {assignment.player.name}
                        </h3>
                      </div>

                      {assignment.id ===
                        game.currentTurn?.gamePlayerId && (
                        <span className="rounded-full bg-amber-900 px-3 py-1 text-xs font-bold text-amber-300">
                          CURRENT TURN
                        </span>
                      )}

                    </div>

                    <div className="mt-5 grid gap-3 sm:grid-cols-2">

                      <Info
                        label="Turn Order"
                        value={String(assignment.turnOrder)}
                      />

                      <Info
                        label="Pawn"
                        value={assignment.pawn.name}
                      />

                      <Info
                        label="Pawn Code"
                        value={assignment.pawn.pawnCode}
                      />

                      <Info
                        label="Balance"
                        value={`₹${assignment.balance.toLocaleString("en-IN")}`}
                      />

                      <Info
                        label="Position"
                        value={
                          assignment.currentPosition
                            ? `${assignment.currentPosition.name} (${assignment.currentPosition.index})`
                            : "Unknown"
                        }
                      />

                      <Info
                        label="Status"
                        value={
                          assignment.isActive
                            ? "ACTIVE"
                            : "INACTIVE"
                        }
                      />

                    </div>

                  </div>

                ))}

              </div>

            </section>
          </>
        )}

      </div>
    </main>
  );
}

function Die({ value }: { value: number }) {
  return (
    <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-slate-700 bg-slate-950 text-4xl font-black shadow-lg">
      {value}
    </div>
  );
}

function Info({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl bg-slate-950 p-4">
      <p className="text-xs uppercase tracking-wider text-slate-500">
        {label}
      </p>

      <p className="mt-2 wrap-break-word font-semibold text-white">
        {value}
      </p>
    </div>
  );
}
