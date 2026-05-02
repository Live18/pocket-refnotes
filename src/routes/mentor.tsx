import { createFileRoute } from "@tanstack/react-router";
import { SectionChoice } from "@/components/SectionChoice";

export const Route = createFileRoute("/mentor")({
  component: () => <SectionChoice title="Mentoring" newLabel="New Mentor Note" openLabel="Open Previous Mentor Threads" />,
});
