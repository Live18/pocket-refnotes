import { createContext, useContext, useState, type ReactNode } from "react";

const AdminContext = createContext<{ admin: boolean; toggle: () => void }>({
  admin: false,
  toggle: () => {},
});

export function AdminProvider({ children }: { children: ReactNode }) {
  const [admin, setAdmin] = useState(false);
  return (
    <AdminContext.Provider value={{ admin, toggle: () => setAdmin((v) => !v) }}>
      {children}
    </AdminContext.Provider>
  );
}

export const useAdmin = () => useContext(AdminContext);
