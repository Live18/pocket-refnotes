import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const bodySchema = z.record(z.string(), z.unknown());

async function upsertEntry(
  supabase: any,
  args: {
    userId: string;
    gameId: string;
    body: Record<string, unknown>;
    status: "draft" | "saved_private" | "saved_sent";
    recipientEmail?: string | null;
  },
) {
    const { data: existing } = await supabase
    .from("entries").select("id").eq("game_id", args.gameId).eq("author_id", args.userId).maybeSingle();

  const now = new Date().toISOString();
  const patch: Record<string, unknown> = {
    body: args.body,
    status: args.status,
    saved_at: args.status === "draft" ? null : now,
  };
  if (args.recipientEmail !== undefined) patch.recipient_email = args.recipientEmail;
  if (args.status === "saved_sent") patch.recipient_email = args.recipientEmail ?? null;

  if (existing?.id) {
    const { data, error } = await supabase
      .from("entries").update(patch).eq("id", existing.id).select().single();
    if (error) throw new Error(error.message);
    return data;
  }
  const { data, error } = await supabase
    .from("entries").insert({
      game_id: args.gameId,
      author_id: args.userId,
      ...patch,
    }).select().single();
  if (error) throw new Error(error.message);
  return data;
}

export const getEntryForGame = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { gameId: string }) => z.object({ gameId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: entry, error } = await supabase
      .from("entries")
      .select("*")
      .eq("game_id", data.gameId)
      .eq("author_id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { entry: entry ?? null };
  });

export const getEntryById = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: entry, error } = await supabase
      .from("entries")
      .select("id, status, recipient_email, body, saved_at, sent_at, updated_at, game:games(id, title, game_date)")
      .eq("id", data.id)
      .eq("author_id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { entry: entry ?? null };
  });

export const saveDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({
    gameId: z.string().uuid(),
    body: bodySchema,
  }).parse(input))
  .handler(async ({ data, context }) => {
    const entry = await upsertEntry(context.supabase, {
      userId: context.userId,
      gameId: data.gameId,
      body: data.body,
      status: "draft",
    });
    return { entry };
  });

export const savePrivate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({
    gameId: z.string().uuid(),
    body: bodySchema,
  }).parse(input))
  .handler(async ({ data, context }) => {
    const entry = await upsertEntry(context.supabase, {
      userId: context.userId,
      gameId: data.gameId,
      body: data.body,
      status: "saved_private",
      recipientEmail: null,
    });
    return { entry };
  });

export const saveAndSend = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({
    gameId: z.string().uuid(),
    body: bodySchema,
    recipientEmail: z.string().email(),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const entry = await upsertEntry(supabase, {
      userId: context.userId,
      gameId: data.gameId,
      body: data.body,
      status: "saved_sent",
      recipientEmail: data.recipientEmail,
    });
    const { data: job, error } = await supabase
      .from("report_jobs")
      .insert({ entry_id: entry.id, status: "queued" })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { entry, job };
  });

export const listMyEntries = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("entries")
      .select("id, status, recipient_email, saved_at, sent_at, updated_at, game:games(id, title, game_date)")
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { entries: data ?? [] };
  });
