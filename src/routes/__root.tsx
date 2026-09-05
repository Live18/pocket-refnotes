import { Outlet, Link, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { ThemeProvider } from "@/lib/theme";
import { JournalProvider } from "@/lib/journal";
import { AuthProvider } from "@/lib/auth-context";
import { BottomTabBar } from "@/components/BottomTabBar";
import { RouteTransition } from "@/components/RouteTransition";
import appCss from "../styles.css?url";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
const queryClient = new QueryClient();
function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold">404</h1>
        <p className="mt-2 text-sm text-muted-foreground">Page not found.</p>
        <div className="mt-6">
          <Link to="/" className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground">
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}
export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: "RefNotes" },
      { name: "description", content: "RefNotes — capture journals, observations, and mentor reflections." },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});
function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}
function RootComponent() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <JournalProvider>
            <div className="mx-auto flex min-h-screen max-w-md flex-col bg-background">
              <main className="flex-1 pb-2">
                <RouteTransition>
                  <Outlet />
                </RouteTransition>
              </main>
              <BottomTabBar />
            </div>
          </JournalProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}