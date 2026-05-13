import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { ArrowRight, ShieldCheck, Zap, FileText } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "PayLink — Paiement électronique sécurisé" },
      {
        name: "description",
        content:
          "Plateforme de paiement universitaire : transferts instantanés sécurisés par code PIN, traçabilité totale, export CSV.",
      },
    ],
  }),
  component: LandingPage,
});

function LandingPage() {
  const { user, loading } = useAuth();

  if (!loading && user) {
    return <Navigate to="/dashboard" />;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-6">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-primary shadow-glow">
            <span className="font-display text-lg font-bold text-primary-foreground">P</span>
          </div>
          <span className="font-display text-lg font-bold tracking-tight">PayLink</span>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link to="/login">Connexion</Link>
          </Button>
          <Button asChild size="sm">
            <Link to="/signup">S'inscrire</Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-24 pt-12 md:pt-20">
        <section className="grid gap-12 md:grid-cols-2 md:items-center">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground shadow-soft">
              <span className="h-2 w-2 rounded-full bg-success" />
              Projet universitaire — L1 SRIT
            </div>
            <h1 className="font-display text-4xl font-bold leading-tight tracking-tight md:text-6xl">
              Paiement électronique{" "}
              <span className="bg-gradient-primary bg-clip-text text-transparent">
                sécurisé & tracé
              </span>
            </h1>
            <p className="text-lg text-muted-foreground">
              Transférez de l'argent en toute sécurité avec validation par code PIN. Chaque
              opération est atomique, tracée et exportable.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg" className="shadow-glow">
                <Link to="/signup">
                  Créer un compte <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link to="/login">Se connecter</Link>
              </Button>
            </div>
          </div>

          <div className="relative">
            <div className="absolute -inset-4 rounded-3xl bg-white/10 opacity-40 blur-3xl" />
            <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-card p-8 shadow-elevated">
              <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-white/5 blur-3xl" />
              <div className="relative">
                <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-muted-foreground">
                  Premium Reserve
                </p>
                <p className="mt-3 font-display text-4xl font-light tracking-tight text-foreground">
                  10 000.00 <span className="text-2xl font-extralight text-muted-foreground">XOF</span>
                </p>
                <div className="mt-6 flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Identifiant</p>
                    <p className="font-mono text-sm font-semibold text-foreground">
                      @USR-DEMO01
                    </p>
                  </div>
                  <div className="rounded-full border border-success/30 bg-success/10 px-3 py-1">
                    <span className="text-[11px] font-medium text-success">Actif</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-24 grid gap-6 md:grid-cols-3">
          <Feature
            icon={<ShieldCheck className="h-6 w-6" />}
            title="Sécurité atomique"
            text="Transactions SQL avec rollback automatique. Aucune fraude possible."
          />
          <Feature
            icon={<Zap className="h-6 w-6" />}
            title="Transferts instantanés"
            text="Validation par code PIN, débit et crédit en une seule opération."
          />
          <Feature
            icon={<FileText className="h-6 w-6" />}
            title="Traçabilité totale"
            text="Reçu unique pour chaque opération, export CSV de l'historique."
          />
        </section>
      </main>
    </div>
  );
}

function Feature({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-card transition-shadow hover:shadow-elevated">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent text-accent-foreground">
        {icon}
      </div>
      <h3 className="mt-4 font-display text-lg font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground">{text}</p>
    </div>
  );
}
