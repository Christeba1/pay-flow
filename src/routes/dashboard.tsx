import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Eye, EyeOff, Send, Copy } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { AuthGate, formatMoney, formatDate } from "@/components/auth-gate";
import { Button } from "@/components/ui/button";

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
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">Bonjour 👋</p>
        <h1 className="font-display text-2xl font-bold md:text-3xl">
          {profile?.full_name || "Utilisateur"}
        </h1>
      </div>

      {/* Solde card */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-card p-6 shadow-elevated md:p-8">
        <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-white/10 blur-2xl" />
        <div className="relative">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-wider text-primary-foreground/70">
              Solde disponible
            </p>
            <button
              onClick={() => setShowBalance((v) => !v)}
              className="text-primary-foreground/70 transition-colors hover:text-primary-foreground"
            >
              {showBalance ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            </button>
          </div>
          <p className="mt-2 font-display text-4xl font-bold text-primary-foreground md:text-5xl">
            {showBalance ? formatMoney(profile?.balance ?? 0) : "••••••"}
            <span className="ml-2 text-xl font-normal text-primary-foreground/70">XOF</span>
          </p>

          <button
            onClick={copyHandle}
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-xs font-medium text-primary-foreground backdrop-blur transition-colors hover:bg-white/25"
          >
            <span className="font-mono">@{profile?.handle}</span>
            <Copy className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-3">
        <Button asChild size="lg" className="h-auto py-4 shadow-glow">
          <Link to="/transfer">
            <Send className="mr-2 h-4 w-4" />
            Envoyer
          </Link>
        </Button>
        <Button asChild variant="outline" size="lg" className="h-auto py-4">
          <Link to="/history">Historique complet</Link>
        </Button>
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
