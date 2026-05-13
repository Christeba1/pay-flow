import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Eye, EyeOff, Send, Copy } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { AuthGate, formatMoney, formatDate } from "@/components/auth-gate";


export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Tableau de bord — PayLink" },
      { name: "description", content: "Solde, dernières transactions et actions rapides." },
    ],
  }),
  component: () => (
    <AuthGate>
      <Dashboard />
    </AuthGate>
  ),
});

type Tx = {
  id: string;
  sender_id: string;
  receiver_id: string;
  amount: number;
  fee: number;
  status: string;
  created_at: string;
  receipt_code: string;
};

function Dashboard() {
  const { profile, user } = useAuth();
  const [txs, setTxs] = useState<Tx[]>([]);
  const [showBalance, setShowBalance] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("transactions")
      .select("*")
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
      .order("created_at", { ascending: false })
      .limit(5)
      .then(({ data }) => {
        setTxs((data ?? []) as Tx[]);
        setLoading(false);
      });
  }, [user]);

  const copyHandle = () => {
    if (profile) {
      navigator.clipboard.writeText(profile.handle);
      toast.success("Identifiant copié !");
    }
  };

  return (
    <div className="space-y-6 pb-6">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-muted-foreground">
          Welcome back
        </p>
        <h1 className="font-display text-2xl font-semibold tracking-tight md:text-3xl">
          {profile?.full_name || "Utilisateur"}
        </h1>
      </div>

      {profile && !profile.pin_code_hashed && (
        <Link
          to="/settings"
          className="flex items-start gap-3 rounded-2xl border border-warning/40 bg-warning/10 p-4 text-sm transition-colors hover:bg-warning/15"
        >
          <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-warning text-warning-foreground text-xs font-bold">
            !
          </div>
          <div>
            <p className="font-semibold text-foreground">Définissez votre code PIN</p>
            <p className="text-muted-foreground">
              Indispensable avant tout transfert. Cliquez pour le configurer →
            </p>
          </div>
        </Link>
      )}

      {/* Luxury balance card */}
      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-card p-6 shadow-elevated md:p-8">
        <div className="absolute -right-20 -top-20 h-56 w-56 rounded-full bg-white/5 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_85%_15%,rgba(255,255,255,0.06),transparent_55%)]" />
        <div className="relative flex flex-col gap-8">
          <div className="flex items-start justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-[0.25em] text-muted-foreground">
              Premium Reserve
            </span>
            <button
              onClick={() => setShowBalance((v) => !v)}
              className="text-foreground/60 transition-colors hover:text-foreground"
              aria-label="Afficher / masquer le solde"
            >
              {showBalance ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            </button>
          </div>

          <div>
            <p className="text-xs text-muted-foreground">Solde disponible</p>
            <p className="mt-1 font-display text-4xl font-light tracking-tight text-foreground md:text-5xl">
              {showBalance ? formatMoney(profile?.balance ?? 0) : "••••••"}
              <span className="ml-2 text-xl font-extralight text-muted-foreground">XOF</span>
            </p>
          </div>

          <div className="flex items-end justify-between">
            <button
              onClick={copyHandle}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-medium text-foreground/90 backdrop-blur transition-colors hover:bg-white/10"
            >
              <span className="font-mono">@{profile?.handle}</span>
              <Copy className="h-3 w-3" />
            </button>
            <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
              PayLink Platinum
            </span>
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-3 gap-3">
        <Link to="/transfer" className="flex flex-col items-center gap-2">
          <div className="flex aspect-square w-full items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-card transition-transform active:scale-95">
            <Send className="h-5 w-5" />
          </div>
          <span className="text-[11px] font-medium text-muted-foreground">Envoyer</span>
        </Link>
        <Link to="/history" className="flex flex-col items-center gap-2">
          <div className="flex aspect-square w-full items-center justify-center rounded-2xl border border-border bg-card text-foreground transition-transform active:scale-95">
            <ArrowDownLeft className="h-5 w-5" />
          </div>
          <span className="text-[11px] font-medium text-muted-foreground">Historique</span>
        </Link>
        <Link to="/settings" className="flex flex-col items-center gap-2">
          <div className="flex aspect-square w-full items-center justify-center rounded-2xl border border-border bg-card text-foreground transition-transform active:scale-95">
            <ArrowUpRight className="h-5 w-5" />
          </div>
          <span className="text-[11px] font-medium text-muted-foreground">Compte</span>
        </Link>
      </div>

      {/* Recent transactions */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">5 dernières opérations</h2>
          <Link to="/history" className="text-xs font-medium text-primary hover:underline">
            Tout voir
          </Link>
        </div>

        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
          {loading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Chargement…</div>
          ) : txs.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Aucune transaction pour le moment. Faites votre premier transfert !
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {txs.map((tx) => (
                <TxRow key={tx.id} tx={tx} userId={user!.id} />
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}

function TxRow({ tx, userId }: { tx: Tx; userId: string }) {
  const isOutgoing = tx.sender_id === userId;
  const failed = tx.status === "failed";
  return (
    <li className="flex items-center justify-between px-4 py-3">
      <div className="flex items-center gap-3">
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-full ${
            isOutgoing ? "bg-destructive/10 text-destructive" : "bg-success/10 text-success"
          }`}
        >
          {isOutgoing ? (
            <ArrowUpRight className="h-5 w-5" />
          ) : (
            <ArrowDownLeft className="h-5 w-5" />
          )}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium">
            {isOutgoing ? "Envoi" : "Réception"}
            {failed && <span className="ml-2 text-xs text-destructive">échoué</span>}
          </p>
          <p className="text-xs text-muted-foreground">{formatDate(tx.created_at)}</p>
        </div>
      </div>
      <div className="text-right">
        <p
          className={`font-mono text-sm font-semibold ${
            isOutgoing ? "text-foreground" : "text-success"
          }`}
        >
          {isOutgoing ? "−" : "+"}
          {formatMoney(tx.amount)}
        </p>
        {isOutgoing && tx.fee > 0 && (
          <p className="text-[10px] text-muted-foreground">frais {formatMoney(tx.fee)}</p>
        )}
      </div>
    </li>
  );
}
