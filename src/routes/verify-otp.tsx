import { createFileRoute, Link, useRouter, useSearch } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { AuthLayout } from "./login";

type Search = { email?: string };

export const Route = createFileRoute("/verify-otp")({
  validateSearch: (search: Record<string, unknown>): Search => ({
    email: typeof search.email === "string" ? search.email : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Vérification — PayLink" },
      { name: "description", content: "Confirmez votre email avec le code reçu." },
    ],
  }),
  component: VerifyOtpPage,
});

function VerifyOtpPage() {
  const router = useRouter();
  const { email } = useSearch({ from: "/verify-otp" });
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);

  if (!email) {
    return (
      <AuthLayout
        title="Email manquant"
        subtitle="Veuillez recommencer votre inscription."
        footer={
          <Link to="/signup" className="font-medium text-primary hover:underline">
            Retour à l'inscription
          </Link>
        }
      >
        <div />
      </AuthLayout>
    );
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (code.length !== 6) {
      toast.error("Saisissez le code à 6 chiffres.");
      return;
    }
    setSubmitting(true);
    try {
      const { error: vErr } = await supabase.auth.verifyOtp({
        email,
        token: code,
        type: "email",
      });
      if (vErr) throw new Error(vErr.message);

      const password = sessionStorage.getItem(`pwd:${email}`);
      const fullName = sessionStorage.getItem(`name:${email}`);
      if (password) {
        await supabase.auth.updateUser({
          password,
          data: fullName ? { full_name: fullName } : undefined,
        });
        sessionStorage.removeItem(`pwd:${email}`);
        sessionStorage.removeItem(`name:${email}`);
      }

      toast.success("Email confirmé ! Bienvenue.");
      router.navigate({ to: "/dashboard" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Code invalide.";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: false },
      });
      if (error) throw error;
      toast.success("Nouveau code envoyé !");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erreur lors du renvoi.";
      toast.error(msg);
    } finally {
      setResending(false);
    }
  };

  return (
    <AuthLayout
      title="Vérifiez votre email"
      subtitle={`Nous avons envoyé un code à 6 chiffres à ${email}.`}
      footer={
        <button
          type="button"
          onClick={handleResend}
          disabled={resending}
          className="font-medium text-primary hover:underline disabled:opacity-50"
        >
          {resending ? "Envoi..." : "Renvoyer le code"}
        </button>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="otp">Code de confirmation</Label>
          <div className="flex justify-center">
            <InputOTP maxLength={6} value={code} onChange={setCode}>
              <InputOTPGroup>
                <InputOTPSlot index={0} />
                <InputOTPSlot index={1} />
                <InputOTPSlot index={2} />
                <InputOTPSlot index={3} />
                <InputOTPSlot index={4} />
                <InputOTPSlot index={5} />
              </InputOTPGroup>
            </InputOTP>
          </div>
        </div>
        <Button
          type="submit"
          className="w-full shadow-glow"
          size="lg"
          disabled={submitting || code.length !== 6}
        >
          {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Vérifier et me connecter
        </Button>
      </form>
    </AuthLayout>
  );
}
