import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState, type FormEvent } from "react";
import { createGame } from "@/lib/games.functions";

export const Route = createFileRoute("/_authenticated/games/new")({
  component: NewGamePage,
});

function NewGamePage() {
  const create = useServerFn(createGame);
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [gameDate, setGameDate] = useState("");
  const [opponent, setOpponent] = useState("");
  const [location, setLocation] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await create({ data: { title, gameDate: gameDate || null, opponent: opponent || null, location: location || null } });
      router.navigate({ to: "/games/$gameId", params: { gameId: res.game.id } });
    } finally { setBusy(false); }
  };

  return (
    <div className="px-4 py-6">
      <h1 className="mb-4 text-xl font-bold">New game</h1>
      <form onSubmit={submit} className="space-y-3">
        <input required placeholder="Game title (e.g. Lakers @ Celtics)" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
        <input type="date" value={gameDate} onChange={(e) => setGameDate(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
        <input placeholder="Opponent" value={opponent} onChange={(e) => setOpponent(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
        <input placeholder="Location" value={location} onChange={(e) => setLocation(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
        <button disabled={busy} className="w-full rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50">
          {busy ? "…" : "Create"}
        </button>
      </form>
    </div>
  );
}
