export async function logActivity(
  supabase: any,
  args: { actorId: string; action: string; targetId?: string | null; metadata?: Record<string, unknown> },
) {
  const { error } = await supabase.from("activity_log").insert({
    actor_id: args.actorId,
    action: args.action,
    target_id: args.targetId ?? null,
    metadata: args.metadata ?? {},
  });
  // Matches the existing convention elsewhere (report_jobs status updates in
  // process-report-jobs): log and continue, never throw — a failed audit-log
  // write shouldn't crash the real action it's describing.
  if (error) console.error(`Failed to log activity (${args.action}):`, error);
}