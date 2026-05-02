import { createFileRoute } from "@tanstack/react-router";
import { AppHeader } from "@/components/AppHeader";
import { SectionTile } from "@/components/SectionTile";
import { usePermissions } from "@/lib/permissions";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  const { sections } = usePermissions();
  return (
    <div className="flex flex-col">
      <AppHeader />
      <div className="px-5 pb-6">
        <p className="max-w-[28ch] font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
          Three lenses. One practice.
        </p>
      </div>

      <section className="grid grid-cols-2 gap-3 px-5 pb-6">
        <div>
          <SectionTile section={sections.journal} to="/journal" variant="hero" />
        </div>
        <div className="flex flex-col gap-3">
          <SectionTile section={sections.observation} to="/observation" />
          <SectionTile section={sections.mentor} to="/mentor" />
        </div>
      </section>
    </div>
  );
}
