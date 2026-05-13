import { createFileRoute, useRouter, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import {
  Loader2,
  Search,
  ArrowRight,
  CheckCircle2,
  Download,
  ShieldCheck,
  Lock,
  ChevronLeft,
  Sparkles,
  Zap,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { AuthGate, formatMoney } from "@/components/auth-gate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { generateReceiptPdf } from "@/lib/receipt";

export const Route = createFileRoute("/transfer")({
  head: () => ({
    meta: [
      { title: "Nouveau transfert — PayLink Platinum" },
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

const QUICK_AMOUNTS = [1000, 5000, 10000, 25000, 50000, 100000];

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
    const { data, error } = await supabase.rpc("execute_transfer", {
      _receiver_handle: recipient.handle,
      _amount: amt,
      _pin: pin,
    });
    setSubmitting(false);

    if (error) {
      const msg = error.message || "";
      if (msg.includes("invalid_pin")) toast.error("Code PIN incorrect.");
      else if (msg.includes("pin_not_set"))
        toast.error("Définissez d'abord votre code PIN dans Paramètres.");
      else if (msg.includes("insufficient_balance")) toast.error("Solde insuffisant.");
      else if (msg.includes("receiver_not_found")) toast.error("Utilisateur inconnu.");
      else if (msg.includes("self_transfer_forbidden"))
        toast.error("Vous ne pouvez pas vous envoyer de l'argent à vous-même.");
      else if (msg.includes("invalid_amount")) toast.error("Montant invalide.");
      else toast.error(msg || "Erreur lors du transfert.");
      return;
    }

    const result = data as { receipt_code?: string; transaction_id?: string } | null;
    setReceipt(result?.receipt_code ?? "—");
    await refreshProfile();
    setStep("success");
  };

  const handleDownloadReceipt = () => {
    if (!recipient || !profile || !receipt) return;
    generateReceiptPdf({
      receipt_code: receipt,
      created_at: new Date().toISOString(),
      amount: amt,
      fee,
      status: "success",
      sender_handle: profile.handle,
      sender_name: profile.full_name,
      receiver_handle: recipient.handle,
      receiver_name: recipient.full_name,
    });
  };

  const stepIndex = step === "form" ? 0 : step === "pin" ? 1 : 2;

  return (
    <div className="mx-auto max-w-lg space-y-6 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          Retour
        </Link>
        <div className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card/60 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground backdrop-blur">
          <Sparkles className="h-3 w-3 text-foreground" />
          Platinum
        </div>
      </div>

      {/* Title + Stepper */}
      <div className="space-y-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-muted-foreground">
            Transfert sécurisé
          </p>
          <h1 className="mt-1 font-display text-3xl font-light tracking-tight md:text-4xl">
            {step === "form" && "Envoyez en un instant."}
            {step === "pin" && "Confirmez l'opération."}
            {step === "success" && "Transfert effectué."}
          </h1>
        </div>
        <Stepper index={stepIndex} />
      </div>

      {/* Solde disponible */}
      {profile && step !== "success" && (
        <div className="flex items-center justify-between rounded-2xl border border-border bg-card/60 px-4 py-3 backdrop-blur">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-muted-foreground">
              Solde disponible
            </p>
            <p className="mt-0.5 font-display text-lg font-light tracking-tight">
              {formatMoney(Number(profile.balance))} <span className="text-xs text-muted-foreground">XOF</span>
            </p>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-background/40">
            <Zap className="h-4 w-4 text-foreground" />
          </div>
        </div>
      )}

      {/* STEP: FORM */}
      {step === "form" && (
        <form
          onSubmit={handleLookup}
          className="space-y-6 rounded-3xl border border-border bg-gradient-card p-6 shadow-elevated"
        >
          <div className="space-y-2.5">
            <Label htmlFor="handle" className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Destinataire
            </Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="handle"
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
                placeholder="USR-AB12CD"
                className="h-12 rounded-xl pl-11 font-mono text-sm uppercase tracking-wider"
              />
            </div>
            <p className="text-[11px] text-muted-foreground">
              Saisissez l'identifiant unique du bénéficiaire.
            </p>
          </div>

          <div className="space-y-2.5">
            <div className="flex items-baseline justify-between">
              <Label htmlFor="amount" className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Montant
              </Label>
              <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">XOF</span>
            </div>
            <div className="relative rounded-2xl border border-border bg-background/40 p-5">
              <Input
                id="amount"
                type="number"
                min="1"
                step="1"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                className="h-14 border-0 bg-transparent p-0 font-display text-4xl font-light tracking-tight shadow-none focus-visible:ring-0"
              />
              <p className="mt-1 text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                {amt > 0 ? `${formatMoney(amt)} francs CFA` : "Saisissez un montant"}
              </p>
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              {QUICK_AMOUNTS.map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setAmount(String(v))}
                  className="rounded-full border border-border bg-background/40 px-3 py-1.5 text-[11px] font-medium text-muted-foreground transition hover:border-foreground/30 hover:text-foreground"
                >
                  +{formatMoney(v)}
                </button>
              ))}
            </div>
          </div>

          {amt > 0 && (
            <div className="space-y-2 rounded-2xl border border-border bg-background/40 p-4">
              <Row label="Montant" value={`${formatMoney(amt)} XOF`} />
              <Row label="Frais réseau (1%)" value={`${formatMoney(fee)} XOF`} muted />
              <div className="my-1 border-t border-border" />
              <Row
                label="Total débité"
                value={`${formatMoney(total)} XOF`}
                strong
                danger={!!insufficient}
              />
              {insufficient && (
                <p className="pt-1 text-[11px] text-destructive">
                  Solde insuffisant pour couvrir ce transfert.
                </p>
              )}
            </div>
          )}

          <Button
            type="submit"
            size="lg"
            className="h-12 w-full rounded-xl text-sm font-semibold shadow-glow"
            disabled={searching || !!insufficient}
          >
            {searching && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Continuer <ArrowRight className="ml-2 h-4 w-4" />
          </Button>

          <p className="flex items-center justify-center gap-1.5 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            <ShieldCheck className="h-3 w-3" />
            Chiffrement de bout en bout
          </p>
        </form>
      )}

      {/* STEP: PIN */}
      {step === "pin" && recipient && (
        <form
          onSubmit={handleConfirm}
          className="space-y-6 rounded-3xl border border-border bg-gradient-card p-6 shadow-elevated"
        >
          <div className="space-y-4 rounded-2xl border border-white/10 bg-background/40 p-5">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-muted-foreground">
                Vous envoyez
              </p>
              <p className="mt-1 font-display text-4xl font-light tracking-tight">
                {formatMoney(amt)}
                <span className="ml-2 text-sm text-muted-foreground">XOF</span>
              </p>
            </div>

            <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-primary text-sm font-semibold text-background">
                {recipient.full_name?.[0]?.toUpperCase() ?? "?"}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {recipient.full_name || "Bénéficiaire"}
                </p>
                <p className="truncate font-mono text-[11px] text-muted-foreground">
                  @{recipient.handle}
                </p>
              </div>
              <CheckCircle2 className="h-4 w-4 text-success" />
            </div>

            <div className="grid grid-cols-2 gap-2 border-t border-white/10 pt-3 text-[11px]">
              <div>
                <p className="uppercase tracking-wider text-muted-foreground">Frais</p>
                <p className="mt-0.5 font-mono">{formatMoney(fee)} XOF</p>
              </div>
              <div className="text-right">
                <p className="uppercase tracking-wider text-muted-foreground">Total</p>
                <p className="mt-0.5 font-mono font-semibold">{formatMoney(total)} XOF</p>
              </div>
            </div>
          </div>

          <div className="space-y-2.5">
            <Label htmlFor="pin" className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              <Lock className="h-3 w-3" />
              Code PIN
            </Label>
            <Input
              id="pin"
              type="password"
              inputMode="numeric"
              autoFocus
              maxLength={6}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
              placeholder="••••"
              className="h-14 rounded-xl text-center font-mono text-3xl tracking-[0.5em]"
            />
            <p className="text-[11px] text-muted-foreground">
              {profile?.pin_code_hashed
                ? "Saisissez votre code PIN pour autoriser le transfert."
                : "Définissez votre code PIN dans les paramètres avant le premier transfert."}
            </p>
          </div>

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="h-12 flex-1 rounded-xl"
              onClick={() => setStep("form")}
            >
              Modifier
            </Button>
            <Button
              type="submit"
              size="lg"
              className="h-12 flex-[1.5] rounded-xl shadow-glow"
              disabled={submitting}
            >
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirmer l'envoi
            </Button>
          </div>
        </form>
      )}

      {/* STEP: SUCCESS */}
      {step === "success" && (
        <div className="space-y-6 rounded-3xl border border-border bg-gradient-card p-6 text-center shadow-elevated">
          <div className="relative mx-auto flex h-20 w-20 items-center justify-center">
            <div className="absolute inset-0 animate-pulse rounded-full bg-success/10" />
            <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-gradient-success text-background">
              <CheckCircle2 className="h-9 w-9" strokeWidth={2.5} />
            </div>
          </div>

          <div className="space-y-1.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-success">
              Confirmé
            </p>
            <h2 className="font-display text-2xl font-light tracking-tight">
              {formatMoney(amt)} XOF envoyés
            </h2>
            <p className="text-sm text-muted-foreground">
              à <span className="font-mono text-foreground">@{recipient?.handle}</span>
            </p>
          </div>

          <div className="rounded-2xl border border-border bg-background/40 p-4 text-left">
            <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-muted-foreground">
              Référence du reçu
            </p>
            <p className="mt-1.5 break-all font-mono text-xs text-foreground">{receipt}</p>
          </div>

          <Button
            variant="secondary"
            className="h-11 w-full rounded-xl"
            onClick={handleDownloadReceipt}
          >
            <Download className="mr-2 h-4 w-4" />
            Télécharger le reçu PDF
          </Button>

          <div className="flex gap-2">
            <Button
              variant="outline"
              className="h-11 flex-1 rounded-xl"
              onClick={() => router.navigate({ to: "/dashboard" })}
            >
              Tableau de bord
            </Button>
            <Button
              className="h-11 flex-1 rounded-xl shadow-glow"
              onClick={() => {
                setStep("form");
                setHandle("");
                setAmount("");
                setPin("");
                setRecipient(null);
                setReceipt("");
              }}
            >
              Nouvel envoi
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function Stepper({ index }: { index: number }) {
  const labels = ["Détails", "Sécurité", "Confirmation"];
  return (
    <div className="flex items-center gap-2">
      {labels.map((label, i) => {
        const active = i === index;
        const done = i < index;
        return (
          <div key={label} className="flex flex-1 items-center gap-2">
            <div
              className={`h-1 flex-1 rounded-full transition-all ${
                active || done ? "bg-foreground" : "bg-border"
              }`}
            />
            <span
              className={`text-[10px] font-semibold uppercase tracking-[0.15em] ${
                active ? "text-foreground" : "text-muted-foreground"
              }`}
            >
              {label}
            </span>
          </div>
        );
      })}
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
      <span className={`text-xs ${muted ? "text-muted-foreground" : "text-foreground/80"}`}>
        {label}
      </span>
      <span
        className={`font-mono text-sm ${strong ? "font-semibold text-foreground" : ""} ${
          danger ? "text-destructive" : ""
        }`}
      >
        {value}
      </span>
    </div>
  );
}
