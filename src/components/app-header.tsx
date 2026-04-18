import { Link, useRouter } from "@tanstack/react-router";
import { LogOut, LayoutDashboard, Send, History, Shield } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";

export function AppHeader() {
  const { profile, isAdmin, signOut } = useAuth();
  const router = useRouter();

  const handleSignOut = async () => {
    await signOut();
    router.navigate({ to: "/login" });
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
        <Link to="/dashboard" className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-primary shadow-glow">
            <span className="font-display text-lg font-bold text-primary-foreground">P</span>
          </div>
          <span className="font-display text-lg font-bold tracking-tight">PayLink</span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          <NavItem to="/dashboard" icon={<LayoutDashboard className="h-4 w-4" />} label="Tableau de bord" />
          <NavItem to="/transfer" icon={<Send className="h-4 w-4" />} label="Transférer" />
          <NavItem to="/history" icon={<History className="h-4 w-4" />} label="Historique" />
          {isAdmin && (
            <NavItem to="/admin" icon={<Shield className="h-4 w-4" />} label="Audit" />
          )}
        </nav>

        <div className="flex items-center gap-3">
          {profile && (
            <span className="hidden font-mono text-xs text-muted-foreground sm:inline">
              @{profile.handle}
            </span>
          )}
          <Button variant="ghost" size="sm" onClick={handleSignOut}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Mobile bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around border-t border-border/60 bg-background/95 py-2 backdrop-blur-xl md:hidden">
        <MobileNav to="/dashboard" icon={<LayoutDashboard className="h-5 w-5" />} label="Accueil" />
        <MobileNav to="/transfer" icon={<Send className="h-5 w-5" />} label="Envoyer" />
        <MobileNav to="/history" icon={<History className="h-5 w-5" />} label="Historique" />
        {isAdmin && <MobileNav to="/admin" icon={<Shield className="h-5 w-5" />} label="Audit" />}
      </nav>
    </header>
  );
}

function NavItem({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) {
  return (
    <Link
      to={to as any}
      className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
      activeProps={{ className: "bg-accent text-accent-foreground" }}
    >
      {icon}
      {label}
    </Link>
  );
}

function MobileNav({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) {
  return (
    <Link
      to={to as any}
      className="flex flex-1 flex-col items-center gap-1 py-1 text-[10px] text-muted-foreground"
      activeProps={{ className: "text-primary" }}
    >
      {icon}
      <span>{label}</span>
    </Link>
  );
}
