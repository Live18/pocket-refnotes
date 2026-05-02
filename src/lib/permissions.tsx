import { createContext, useContext, useState, type ReactNode } from "react";

export type SectionKey = "journal" | "observation" | "mentor";

export interface SectionData {
  key: SectionKey;
  label: string;
  hasAccess: boolean;
  entryCount: number;
  lastEntry: string; // ISO date
  mentorUnread?: number;
}

const initial: Record<SectionKey, SectionData> = {
  journal: { key: "journal", label: "Journal", hasAccess: true, entryCount: 42, lastEntry: "2026-04-30" },
  observation: { key: "observation", label: "Observation", hasAccess: true, entryCount: 17, lastEntry: "2026-04-28" },
  mentor: { key: "mentor", label: "Mentoring", hasAccess: false, entryCount: 8, lastEntry: "2026-04-25", mentorUnread: 1 },
};

const PermsContext = createContext<{
  sections: Record<SectionKey, SectionData>;
  toggleAccess: (k: SectionKey) => void;
}>({ sections: initial, toggleAccess: () => {} });

export function PermissionsProvider({ children }: { children: ReactNode }) {
  const [sections, setSections] = useState(initial);
  return (
    <PermsContext.Provider
      value={{
        sections,
        toggleAccess: (k) =>
          setSections((s) => ({ ...s, [k]: { ...s[k], hasAccess: !s[k].hasAccess } })),
      }}
    >
      {children}
    </PermsContext.Provider>
  );
}

export const usePermissions = () => useContext(PermsContext);
