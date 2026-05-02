import { createFileRoute } from "@tanstack/react-router";
import { SectionChoice } from "@/components/SectionChoice";

export const Route = createFileRoute("/observation")({
  component: () => <SectionChoice title="Observation" newLabel="New Observation" openLabel="Open Previous Observations" />,
});
