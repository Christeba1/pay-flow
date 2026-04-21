import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Loader2, KeyRound, ShieldCheck, Trash2, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { AuthGate } from "@/components/auth-gate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { deleteAccount } from "@/lib/account.functions";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Paramètres — PayLink" },
      { name: "description", content: "Gérez votre code PIN et vos paramètres de sécurité." },
    ],
  }),
  component: () => (
    <AuthGate>
      <SettingsPage />
    </AuthGate>
  ),
});

function SettingsPage() {
  const router = useRouter();
  const { profile, refreshProfile, signOut, session } = useAuth();
  const hasPin = !!profile?.pin_code_hashed;

  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (newPin.length < 4 || newPin.length > 6 || !/^\d+$/.test(newPin)) {
      toast.error("Le code PIN doit contenir 4 à 6 chiffres.");
      return;
    }
    if (newPin !== confirmPin) {
      toast.error("Les codes PIN ne correspondent pas.");
      return;
    }

    setSubmitting(true);
    const { error } = await supabase.rpc("set_pin_code", {
      _new_pin: newPin,
      _current_pin: hasPin ? currentPin : undefined,
    });
    setSubmitting(false);

    if (error) {
      const msg = error.message || "";
      if (msg.includes("invalid_current_pin")) toast.error("Code PIN actuel incorrect.");
      else if (msg.includes("invalid_pin")) toast.error("Format de PIN invalide.");
      else toast.error(msg);
      return;
    }

    toast.success(hasPin ? "Code PIN mis à jour !" : "Code PIN défini ! Vous pouvez maintenant transférer.");
    setCurrentPin("");
    setNewPin("");
    setConfirmPin("");
    await refreshProfile();
  };

  const handleDelete = async () => {
    if (!session?.access_token) {
      toast.error("Session expirée. Reconnectez-vous.");
      return;
    }
    setDeleting(true);
    try {
      await deleteAccount({ data: { accessToken: session.access_token } });
      toast.success("Compte supprimé.");
      await signOut();
      router.navigate({ to: "/" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erreur lors de la suppression.";
      toast.error(msg);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold md:text-3xl">Paramètres</h1>
        <p className="mt-1 text-sm text-muted-foreground">Sécurité, code PIN & compte.</p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
        <div className="mb-5 flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
            <KeyRound className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-display text-lg font-semibold">
              {hasPin ? "Modifier le code PIN" : "Définir un code PIN"}
            </h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {hasPin
                ? "Changez votre code PIN actuel."
                : "Indispensable avant tout transfert. 4 à 6 chiffres."}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {hasPin && (
            <div className="space-y-2">
              <Label htmlFor="currentPin">Code PIN actuel</Label>
              <Input
                id="currentPin"
                type="password"
                inputMode="numeric"
                maxLength={6}
                required
                value={currentPin}
                onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, ""))}
                className="text-center font-mono text-xl tracking-widest"
                placeholder="••••"
              />
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="newPin">Nouveau code PIN</Label>
            <Input
              id="newPin"
              type="password"
              inputMode="numeric"
              maxLength={6}
              required
              value={newPin}
              onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ""))}
              className="text-center font-mono text-xl tracking-widest"
              placeholder="••••"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPin">Confirmer le code PIN</Label>
            <Input
              id="confirmPin"
              type="password"
              inputMode="numeric"
              maxLength={6}
              required
              value={confirmPin}
              onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ""))}
              className="text-center font-mono text-xl tracking-widest"
              placeholder="••••"
            />
          </div>

          <Button type="submit" size="lg" className="w-full shadow-glow" disabled={submitting}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {hasPin ? "Mettre à jour" : "Définir le code PIN"}
          </Button>
        </form>
      </div>

      <div className="flex items-start gap-3 rounded-2xl border border-border bg-muted/40 p-4 text-sm">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-success" />
        <p className="text-muted-foreground">
          Votre code PIN est haché avec <strong className="font-semibold text-foreground">bcrypt</strong>{" "}
          (pgcrypto). Même les administrateurs ne peuvent pas le voir.
        </p>
      </div>

      {/* === ZONE DANGER : Suppression du compte === */}
      <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6">
        <div className="mb-4 flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-display text-lg font-semibold text-destructive">Zone de danger</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              La suppression de votre compte est <strong className="font-semibold">définitive</strong>.
              Profil, transactions et solde seront effacés.
            </p>
          </div>
        </div>

        <AlertDialog onOpenChange={(o) => !o && setConfirmText("")}>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" className="w-full" size="lg">
              <Trash2 className="mr-2 h-4 w-4" />
              Supprimer mon compte
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Supprimer définitivement votre compte ?</AlertDialogTitle>
              <AlertDialogDescription>
                Cette action est <strong>irréversible</strong>. Toutes vos données (profil, solde de{" "}
                {profile?.balance?.toLocaleString("fr-FR") ?? 0}, historique des transactions) seront
                supprimées.
                <br />
                <br />
                Tapez <strong className="font-mono">SUPPRIMER</strong> pour confirmer :
              </AlertDialogDescription>
            </AlertDialogHeader>
            <Input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="SUPPRIMER"
              className="font-mono"
            />
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleting}>Annuler</AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => {
                  e.preventDefault();
                  handleDelete();
                }}
                disabled={confirmText !== "SUPPRIMER" || deleting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Supprimer définitivement
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
