import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState, type FormEvent } from "react";
import { createGame } from "@/lib/games.functions";
import { useAuth } from "@/lib/auth-context";
import { isPreviewUserId } from "@/lib/preview-mode";

export const Route = createFileRoute("/_authenticated/games/new")({
  component: NewGamePage,
});

// <-- ADDITION: generates fixed 15-min time options (00:00, 00:15, 00:30...23:45) —
// replaces the native time input, which only used `step` for validation, not for
// restricting what a user could actually type/scroll to.
const TIME_OPTIONS = Array.from({ length: 96 }, (_, i) => {
  const totalMinutes = i * 15;
  const hours24 = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const value = `${String(hours24).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  const period = hours24 < 12 ? "AM" : "PM";
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  const label = `${hours12}:${String(minutes).padStart(2, "0")} ${period}`;
  return { value, label };
});

function NewGamePage() {
  const create = useServerFn(createGame);
  const router = useRouter();
  const { me } = useAuth();
  const isPreview = isPreviewUserId(me?.userId);

  const [homeTeam, setHomeTeam] = useState("");
  const [visitingTeam, setVisitingTeam] = useState("");
  const [gender, setGender] = useState("");
  const [level, setLevel] = useState("");
  const [gameDate, setGameDate] = useState("");
  const [gameTime, setGameTime] = useState("");
  const [location, setLocation] = useState("");
  const [crew, setCrew] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (isPreview) {
        router.navigate({ to: "/games/$gameId", params: { gameId: "preview-game-1" } });
        return;
      }
      const combinedDate = gameDate
        ? (gameTime ? new Date(`${gameDate}T${gameTime}`).toISOString() : gameDate)
        : null;
      const title = `${visitingTeam} @ ${homeTeam}`;
      const res = await create({
        data: {
          title,
          gameDate: combinedDate,
          location: location || null,
          crew: crew || null,
          gender,
          level,
          homeTeam,
          visitingTeam,
        },
      });
      router.navigate({ to: "/games/$gameId", params: { gameId: res.game.id } });
    } finally { setBusy(false); }
  };

  return (
    <div className="px-4 py-6">
      <h1 className="mb-4 text-xl font-bold">New game</h1>
      <form onSubmit={submit} className="space-y-3">
        <input required placeholder="Home team (e.g. Kennewick)" value={homeTeam} onChange={(e) => setHomeTeam(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
        <input required placeholder="Visiting team (e.g. Richland)" value={visitingTeam} onChange={(e) => setVisitingTeam(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
        <select required value={gender} onChange={(e) => setGender(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
          <option value="" disabled>Select gender</option>
          <option value="Boys">Boys</option>
          <option value="Girls">Girls</option>
        </select>
        <input required maxLength={3} placeholder="Level (Var, JV, C, MS)" value={level} onChange={(e) => setLevel(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
        <input type="date" value={gameDate} onChange={(e) => setGameDate(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
        {/* <-- CHANGE: was <input type="time" step={900}> — native time input only enforces step on
             form validation, not on the picker UI itself, so any minute value could still be typed/scrolled.
             Swapped to a dropdown of pre-built 15-min options — no way to select anything else. */}
        <select required value={gameTime} onChange={(e) => setGameTime(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
          <option value="" disabled>Select time</option>
          {TIME_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <input placeholder="Location" value={location} onChange={(e) => setLocation(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
        <input placeholder="Crew (names)" value={crew} onChange={(e) => setCrew(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
        <button disabled={busy} className="w-full rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50">
          {busy ? "…" : "Create"}
        </button>
      </form>
    </div>
  );
}