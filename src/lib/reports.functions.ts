import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getJobForEntry = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { entryId: string }) =>
    z.object({ entryId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: job, error } = await context.supabase
      .from("report_jobs")
      .select("*")
      .eq("entry_id", data.entryId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { job: job ?? null };
  });
