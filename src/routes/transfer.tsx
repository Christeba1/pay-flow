import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Loader2, Search, ArrowRight, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { AuthGate, formatMoney } from "@/components/auth-gate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/transfer")({
  head: () => ({
    meta: [
      { title: "Nouveau transfert — PayLink" },
      { name: "description", content: "Envoyez de l'argent en toute sécurité avec votre code PIN." },
    ],
  }),
  component: () => (
    <AuthGate>
      <TransferPage />
    </AuthGate>
  ),
});

type Step = "form" | "pin" | "success";
type Recipient = { id: string; handle: string; full_name: string | null };

function TransferPage() {
  const router = useRouter();
  const { profile, refreshProfile } = useAuth();
  const [step, setStep] = useState<Step>("form");
  const [handle, setHandle] = useState("");
  const [amount, setAmount] = useState("");
  const [recipient, setRecipient] = useState<Recipient | null>(null);
  const [pin, setPin] = useState("");
  const [searching, setSearching] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [receipt, setReceipt] = useState<string>("");

  const amt = parseFloat(amount) || 0;
  const fee = +(amt * 0.01).toFixed(2);
  const total = +(amt + fee).toFixed(2);
  const insufficient = profile && total > Number(profile.balance);

  const handleLookup = async (e: FormEvent) => {
    e.preventDefault();
    const cleanHandle = handle.trim().replace(/^@/, "").toUpperCase();

    if (!cleanHandle) {
      toast.error("Saisissez un identifiant.");
      return;
    }
    if (cleanHandle === profile?.handle) {
      toast.error("Vous ne pouvez pas vous envoyer de l'argent à vous-même.");
      return;
    }
    if (amt <= 0) {
      toast.error("Saisissez un montant valide.");
      return;
    }
    if (insufficient) {
      toast.error("Solde insuffisant (frais 1% inclus).");
      return;
    }

    setSearching(true);
    const { data, error } = await supabase
      .from("profiles")
      .select("id, handle, full_name")
      .eq("handle", cleanHandle)
      .maybeSingle();
    setSearching(false);

    if (error || !data) {
      toast.error("Utilisateur inconnu.");
      return;
    }
    setRecipient(data as Recipient);
    setStep("pin");
  };

  const handleConfirm = async (e: FormEvent) => {
    e.preventDefault();
    if (pin.length < 4) {
      toast.error("Le code PIN doit contenir au moins 4 chiffres.");
      return;
    }
    if (!recipient) return;

    setSubmitting(true);
    // Placeholder: real RPC will be implemented in Prompt 3.
    // For now we call a function that doesn't exist yet — wire it up here.
    const { data, error } = await (supabase.rpc as any)("execute_transfer", {
      _receiver_handle: recipient.handle,
      _amount: amt,
      _pin: pin,
    });
    setSubmitting(false);

    if (error) {
      const msg = error.message || "";
      if (msg.includes("PIN")) toast.error("Code PIN incorrect.");
      else if (msg.includes("insufficient")) toast.error("Solde insuffisant.");
      else if (msg.includes("not found")) toast.error("Utilisateur inconnu.");
      else toast.error("La fonction de transfert n'est pas encore activée (Prompt 3).");
      return;
    }

    setReceipt((data as any)?.receipt_code ?? "—");
    await refreshProfile();
    setStep("success");
  };

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold md:text-3xl">Nouveau transfert</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {step === "form" && "Saisissez le destinataire et le montant."}
          {step === "pin" && "Confirmez avec votre code PIN."}
          {step === "success" && "Opération réussie 🎉"}
        </p>
      </div>

      {step === "form" && (
        <form
          onSubmit={handleLookup}
          className="space-y-5 rounded-2xl border border-border bg-card p-6 shadow-card"
        >
          <div className="space-y-2">
            <Label htmlFor="handle">Identifiant du destinataire</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="handle"
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
                placeholder="USR-AB12CD"
                className="pl-9 font-mono uppercase"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Demandez à votre destinataire de copier son identifiant depuis son tableau de bord.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount">Montant (XOF)</Label>
            <Input
              id="amount"
              type="number"
              min="1"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="font-mono text-lg"
            />
          </div>

          {amt > 0 && (
            <div className="rounded-xl bg-muted p-4 text-sm">
              <Row label="Montant" value={`${formatMoney(amt)} XOF`} />
              <Row label="Frais (1%)" value={`${formatMoney(fee)} XOF`} muted />
              <div className="my-2 border-t border-border" />
              <Row
                label="Total débité"
                value={`${formatMoney(total)} XOF`}
                strong
                danger={!!insufficient}
              />
              {insufficient && (
                <p className="mt-2 text-xs text-destructive">Solde insuffisant.</p>
              )}
            </div>
          )}

          <Button
            type="submit"
            size="lg"
            className="w-full shadow-glow"
            disabled={searching || !!insufficient}
          >
            {searching && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Continuer <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </form>
      )}

      {step === "pin" && recipient && (
        <form
          onSubmit={handleConfirm}
          className="space-y-5 rounded-2xl border border-border bg-card p-6 shadow-card"
        >
          <div className="rounded-xl bg-gradient-card p-5 text-primary-foreground">
            <p className="text-xs uppercase tracking-wider opacity-70">Vous envoyez</p>
            <p className="mt-1 font-display text-3xl font-bold">{formatMoney(amt)} XOF</p>
            <div className="mt-3 flex items-center gap-2 rounded-lg bg-white/10 p-3 text-sm backdrop-blur">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 font-semibold">
                {recipient.full_name?.[0]?.toUpperCase() ?? "?"}
              </div>
              <div>
                <p className="font-medium">{recipient.full_name || "Sans nom"}</p>
                <p className="font-mono text-xs opacity-70">@{recipient.handle}</p>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="pin">Code PIN</Label>
            <Input
              id="pin"
              type="password"
              inputMode="numeric"
              autoFocus
              maxLength={6}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
              placeholder="••••"
              className="text-center font-mono text-2xl tracking-widest"
            />
            <p className="text-xs text-muted-foreground">
              {profile?.pin_code_hashed
                ? "Saisissez votre code PIN."
                : "Définissez votre code PIN dans les paramètres avant le premier transfert."}
            </p>
          </div>

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="flex-1"
              onClick={() => setStep("form")}
            >
              Retour
            </Button>
            <Button type="submit" size="lg" className="flex-1 shadow-glow" disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirmer
            </Button>
          </div>
        </form>
      )}

      {step === "success" && (
        <div className="space-y-5 rounded-2xl border border-border bg-card p-6 text-center shadow-card">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-success/10 text-success">
            <CheckCircle2 className="h-9 w-9" />
          </div>
          <div>
            <h2 className="font-display text-xl font-bold">Transfert effectué</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {formatMoney(amt)} XOF envoyés à @{recipient?.handle}
            </p>
          </div>
          <div className="rounded-xl bg-muted p-4 text-left">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Reçu numérique
            </p>
            <p className="mt-1 break-all font-mono text-xs">{receipt}</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => router.navigate({ to: "/dashboard" })}
            >
              Tableau de bord
            </Button>
            <Button
              className="flex-1 shadow-glow"
              onClick={() => {
                setStep("form");
                setHandle("");
                setAmount("");
                setPin("");
                setRecipient(null);
              }}
            >
              Nouveau transfert
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({
  label,
  value,
  muted,
  strong,
  danger,
}: {
  label: string;
  value: string;
  muted?: boolean;
  strong?: boolean;
  danger?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className={`text-xs ${muted ? "text-muted-foreground" : ""}`}>{label}</span>
      <span
        className={`font-mono text-sm ${strong ? "font-semibold" : ""} ${
          danger ? "text-destructive" : ""
        }`}
      >
        {value}
      </span>
    </div>
  );
}
