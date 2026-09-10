"use client";

import { FormEvent, useState } from "react";

type Game = {
  id: string;
  name: string;
  status: string;
};

export default function Home() {
  const [name, setName] = useState("My Monopoly Game");
  const [game, setGame] = useState<Game | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function createGame(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setLoading(true);
    setError("");
    setGame(null);

    try {
      const response = await fetch("/api/games", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Unable to create game");
      }

      setGame(data.game);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went wrong",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-5xl px-6 py-12">
        <header className="mb-10">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-amber-400">
            Monopoly Banker
          </p>

          <h1 className="mt-3 text-4xl font-bold tracking-tight">
            Digital Board Game Control Centre
          </h1>

          <p className="mt-3 max-w-2xl text-slate-400">
            Manage games, players, money, properties, buildings and NFC
            pawns from one central system.
          </p>
        </header>

        <section className="grid gap-6 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl">
            <h2 className="text-xl font-semibold">
              Create a Game
            </h2>

            <p className="mt-2 text-sm text-slate-400">
              Start a new Monopoly session.
            </p>

            <form onSubmit={createGame} className="mt-6 space-y-4">
              <div>
                <label
                  htmlFor="game-name"
                  className="mb-2 block text-sm font-medium text-slate-300"
                >
                  Game name
                </label>

                <input
                  id="game-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-amber-400"
                  placeholder="My Monopoly Game"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-amber-400 px-4 py-3 font-bold text-slate-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? "Creating Game..." : "Create Game"}
              </button>
            </form>

            {error && (
              <div className="mt-5 rounded-xl border border-red-900 bg-red-950/50 p-4 text-sm text-red-300">
                {error}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl">
            <h2 className="text-xl font-semibold">
              System Status
            </h2>

            <div className="mt-6 space-y-4">
              <Status label="Next.js" />
              <Status label="Prisma" />
              <Status label="PostgreSQL" />
              <Status label="Game API" />
              <Status label="Demo NFC" />
            </div>
          </div>
        </section>

        {game && (
          <section className="mt-6 rounded-2xl border border-emerald-900 bg-emerald-950/30 p-6">
            <div className="flex items-center gap-3">
              <div className="h-3 w-3 rounded-full bg-emerald-400" />

              <h2 className="text-xl font-semibold">
                Game Created Successfully
              </h2>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              <Info label="Game Name" value={game.name} />
              <Info label="Status" value={game.status} />
              <Info label="Game ID" value={game.id} />
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

function Status({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-between rounded-xl bg-slate-950 px-4 py-3">
      <span className="text-slate-300">{label}</span>

      <span className="flex items-center gap-2 text-sm text-emerald-400">
        <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
        Ready
      </span>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-950 p-4">
      <p className="text-xs uppercase tracking-wider text-slate-500">
        {label}
      </p>

      <p className="mt-2 break-all font-medium text-white">
        {value}
      </p>
    </div>
  );
}