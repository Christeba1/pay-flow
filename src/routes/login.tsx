import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Loader2, Mail, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Connexion — PayLink" },
      { name: "description", content: "Connectez-vous à votre compte PayLink." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (user) {
    router.navigate({ to: "/dashboard" });
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setSubmitting(false);

    if (error) {
      if (error.message.includes("Invalid login")) {
        toast.error("Email ou mot de passe incorrect.");
      } else {
        toast.error(error.message);
      }
      return;
    }
    toast.success("Connexion réussie !");
    router.navigate({ to: "/dashboard" });
  };

  return (
    <AuthLayout
      title="Bon retour 👋"
      subtitle="Connectez-vous pour accéder à votre compte."
      footer={
        <>
          Pas encore de compte ?{" "}
          <Link to="/signup" className="font-medium text-primary hover:underline">
            Créer un compte
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="vous@exemple.com"
              className="pl-10"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Mot de passe</Label>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="pl-10"
            />
          </div>
        </div>
        <Button type="submit" className="w-full shadow-glow" size="lg" disabled={submitting}>
          {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Se connecter
        </Button>
      </form>
    </AuthLayout>
  );
}

export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-background lg:grid lg:grid-cols-2">
      {/* LEFT — branding panel */}
      <div className="relative hidden overflow-hidden lg:block">
        <div className="absolute inset-0 bg-gradient-hero" />
        {/* Animated mesh blobs */}
        <div className="absolute -left-32 top-1/4 h-[28rem] w-[28rem] rounded-full bg-[oklch(0.68_0.18_175)] opacity-40 blur-3xl animate-blob" />
        <div className="absolute -right-20 bottom-0 h-[26rem] w-[26rem] rounded-full bg-[oklch(0.55_0.2_220)] opacity-40 blur-3xl animate-blob animation-delay-2000" />
        <div className="absolute left-1/3 top-0 h-72 w-72 rounded-full bg-[oklch(0.72_0.17_155)] opacity-30 blur-3xl animate-blob animation-delay-4000" />
        {/* Grid pattern overlay */}
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "linear-gradient(white 1px, transparent 1px), linear-gradient(90deg, white 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />

        <div className="relative z-10 flex h-full flex-col justify-between p-12 text-white">
          <Link to="/" className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 backdrop-blur-md ring-1 ring-white/30">
              <span className="font-display text-xl font-bold">P</span>
            </div>
            <span className="font-display text-2xl font-bold tracking-tight">PayLink</span>
          </Link>

          <div className="space-y-8">
            <div>
              <h2 className="font-display text-4xl font-bold leading-tight tracking-tight xl:text-5xl">
                Transférez de l'argent en{" "}
                <span className="bg-gradient-to-r from-[oklch(0.85_0.15_170)] to-white bg-clip-text text-transparent">
                  toute simplicité
                </span>
              </h2>
              <p className="mt-4 max-w-md text-base text-white/70">
                Une plateforme moderne pour envoyer, recevoir et gérer vos transferts en quelques
                secondes — gratuitement.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-4 border-t border-white/10 pt-8">
              <div>
                <div className="font-display text-3xl font-bold">10K+</div>
                <div className="text-xs text-white/60">Crédit démo offert</div>
              </div>
              <div>
                <div className="font-display text-3xl font-bold">{"<"}1s</div>
                <div className="text-xs text-white/60">Vitesse transfert</div>
              </div>
              <div>
                <div className="font-display text-3xl font-bold">100%</div>
                <div className="text-xs text-white/60">Sécurisé</div>
              </div>
            </div>
          </div>

          <p className="text-xs text-white/50">© {new Date().getFullYear()} PayLink — Tous droits réservés</p>
        </div>
      </div>

      {/* RIGHT — form panel */}
      <div className="relative flex min-h-screen items-center justify-center px-4 py-10 lg:px-12">
        {/* Subtle background blobs (mobile fallback) */}
        <div className="absolute inset-0 -z-10 overflow-hidden lg:hidden">
          <div className="absolute -top-20 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-gradient-primary opacity-20 blur-3xl" />
        </div>

        <div className="w-full max-w-md">
          <Link to="/" className="mb-8 flex items-center justify-center gap-2 lg:hidden">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-primary shadow-glow">
              <span className="font-display text-xl font-bold text-primary-foreground">P</span>
            </div>
            <span className="font-display text-xl font-bold">PayLink</span>
          </Link>

          <div className="rounded-2xl border border-border/60 bg-card/80 p-6 shadow-elevated backdrop-blur-xl md:p-8">
            <h1 className="font-display text-2xl font-bold tracking-tight md:text-3xl">{title}</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p>
            <div className="mt-7">{children}</div>
          </div>

          <p className="mt-6 text-center text-sm text-muted-foreground">{footer}</p>
        </div>
      </div>
    </div>
  );
}
