import { createFileRoute } from "@tanstack/react-router";
import { SectionChoice } from "@/components/SectionChoice";

export const Route = createFileRoute("/journal")({
  component: () => <SectionChoice title="Journal" newLabel="New Journal Entry" openLabel="Open Previous Journals" />,
});
