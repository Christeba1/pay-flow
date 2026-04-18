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
    const { error } = await supabase.auth.verifyOtp({
      email,
      token: code,
      type: "email",
    });
    setSubmitting(false);

    if (error) {
      toast.error(error.message.includes("expired") ? "Code expiré." : "Code invalide.");
      return;
    }
    toast.success("Email confirmé ! Bienvenue.");
    router.navigate({ to: "/dashboard" });
  };

  const handleResend = async () => {
    setResending(true);
    const { error } = await supabase.auth.resend({ type: "signup", email });
    setResending(false);
    if (error) toast.error(error.message);
    else toast.success("Nouveau code envoyé !");
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
          Vérifier mon email
        </Button>
      </form>
    </AuthLayout>
  );
}
