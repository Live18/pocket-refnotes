import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listGames = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("games")
      .select("id, title, game_date, opponent, location, created_at")
      .order("game_date", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { games: data ?? [] };
  });

const createGameSchema = z.object({
  title: z.string().min(1).max(200),
  gameDate: z.string().optional().nullable(),
  opponent: z.string().max(200).optional().nullable(),
  location: z.string().max(200).optional().nullable(),
});

export const createGame = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => createGameSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: profile, error: profErr } = await supabase
      .from("profiles").select("org_id").eq("id", userId).maybeSingle();
    if (profErr) throw new Error(profErr.message);
    if (!profile?.org_id) throw new Error("No organization assigned");

    const { data: game, error } = await supabase
      .from("games")
      .insert({
        org_id: profile.org_id,
        created_by: userId,
        title: data.title,
        game_date: data.gameDate ?? null,
        opponent: data.opponent ?? null,
        location: data.location ?? null,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { game };
  });

export const getGame = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { gameId: string }) => z.object({ gameId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: game, error } = await context.supabase
      .from("games").select("*").eq("id", data.gameId).maybeSingle();
    if (error) throw new Error(error.message);
    return { game };
  });
