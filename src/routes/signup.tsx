import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Loader2, Mail, User, Lock } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthLayout } from "./login";
import { sendOtp } from "@/lib/otp.functions";

export const Route = createFileRoute("/signup")({
  head: () => ({
    meta: [
      { title: "Créer un compte — PayLink" },
      { name: "description", content: "Créez votre compte PayLink en quelques secondes." },
    ],
  }),
  component: SignupPage,
});

function SignupPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (user) router.navigate({ to: "/dashboard" });

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("Le mot de passe doit contenir au moins 6 caractères.");
      return;
    }
    setSubmitting(true);
    try {
      const cleanEmail = email.toLowerCase().trim();
      const res = await sendOtp({ data: { email: cleanEmail } });
      if (!res.ok) {
        toast.error(res.error);
        if (res.code === "email_exists") {
          router.navigate({ to: "/login" });
        }
        return;
      }
      sessionStorage.setItem(`pwd:${cleanEmail}`, password);
      sessionStorage.setItem(`name:${cleanEmail}`, fullName.trim());
      if (res.demoCode) {
        sessionStorage.setItem(`demo:${cleanEmail}`, res.demoCode);
      }
      toast.success("Code généré ! Affiché à l'écran suivant.");
      router.navigate({ to: "/verify-otp", search: { email: cleanEmail } });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erreur lors de l'inscription.";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title="Créer votre compte"
      subtitle="Recevez 10 000 de crédit démo pour tester les transferts."
      footer={
        <>
          Déjà un compte ?{" "}
          <Link to="/login" className="font-medium text-primary hover:underline">
            Se connecter
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="fullName">Nom complet</Label>
          <div className="relative">
            <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="fullName"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Aïcha Diallo"
              className="pl-10"
            />
          </div>
        </div>
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
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Au moins 6 caractères"
              className="pl-10"
            />
          </div>
        </div>
        <Button type="submit" className="w-full shadow-glow" size="lg" disabled={submitting}>
          {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Créer mon compte
        </Button>
      </form>
    </AuthLayout>
  );
}
