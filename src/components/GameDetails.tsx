import { Highlight } from "@/components/ReportSearch";
import type { FieldMatch } from "@/lib/report-search";

export function formatGameDate(iso: string | null | undefined) {
  if (!iso) return "no date";
  return new Date(iso).toLocaleString("en-US", {
    timeZone: "America/Los_Angeles",
    dateStyle: "short",
    timeStyle: "short",
  });
}

type GameInfo = { level?: string | null; gender?: string | null; crew?: string | null };

// Level · gender, then crew — shown on game/report cards so the game is identifiable before opening it.
// Search matches in these fields are highlighted in place.
export function GameDetails({ game, matches }: { game: GameInfo; matches: Record<string, FieldMatch> }) {
  const hasClass = game.level || game.gender;
  if (!hasClass && !game.crew) return null;
  return (
    <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
      {hasClass && (
        <p>
          {game.level && <Highlight text={game.level} ranges={matches.level?.ranges} />}
          {game.level && game.gender && " · "}
          {game.gender && <Highlight text={game.gender} ranges={matches.gender?.ranges} />}
        </p>
      )}
      {game.crew && (
        <p className="line-clamp-2">
          <span className="text-foreground/70">Crew: </span>
          <Highlight text={game.crew} ranges={matches.crew?.ranges} />
        </p>
      )}
    </div>
  );
}
