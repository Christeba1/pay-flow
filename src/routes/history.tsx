import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Filter } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { AuthGate, formatMoney, formatDate } from "@/components/auth-gate";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/history")({
  head: () => ({
    meta: [
      { title: "Historique — PayLink" },
      { name: "description", content: "Historique complet de vos transactions, filtres et export." },
    ],
  }),
  component: () => (
    <AuthGate>
      <HistoryPage />
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

type FilterType = "all" | "sent" | "received";

function HistoryPage() {
  const { user } = useAuth();
  const [txs, setTxs] = useState<Tx[]>([]);
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState<FilterType>("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  useEffect(() => {
    if (!user) return;
    supabase
      .from("transactions")
      .select("*")
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setTxs((data ?? []) as Tx[]);
        setLoading(false);
      });
  }, [user]);

  const filtered = useMemo(() => {
    if (!user) return [];
    return txs.filter((tx) => {
      const isOut = tx.sender_id === user.id;
      if (type === "sent" && !isOut) return false;
      if (type === "received" && isOut) return false;
      const d = new Date(tx.created_at);
      if (from && d < new Date(from)) return false;
      if (to && d > new Date(to + "T23:59:59")) return false;
      return true;
    });
  }, [txs, type, from, to, user]);

  const totalIn = filtered
    .filter((t) => t.receiver_id === user?.id && t.status === "success")
    .reduce((s, t) => s + Number(t.amount), 0);
  const totalOut = filtered
    .filter((t) => t.sender_id === user?.id && t.status === "success")
    .reduce((s, t) => s + Number(t.amount) + Number(t.fee), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold md:text-3xl">Historique</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {filtered.length} opération{filtered.length > 1 ? "s" : ""} affichée
          {filtered.length > 1 ? "s" : ""}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Reçu" value={formatMoney(totalIn)} variant="success" />
        <StatCard label="Envoyé (frais inclus)" value={formatMoney(totalOut)} variant="muted" />
      </div>

      {/* Filters */}
      <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
        <div className="mb-3 flex items-center gap-2 text-sm font-medium">
          <Filter className="h-4 w-4 text-muted-foreground" />
          Filtres
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as FilterType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                <SelectItem value="sent">Envois</SelectItem>
                <SelectItem value="received">Réceptions</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Du</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Au</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </div>
      </div>

      {/* List */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
        {loading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Chargement…</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-sm text-muted-foreground">
            Aucune transaction ne correspond aux filtres.
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {filtered.map((tx) => (
              <Row key={tx.id} tx={tx} userId={user!.id} />
            ))}
          </ul>
        )}
      </div>

      <p className="text-center text-xs text-muted-foreground">
        L'export CSV sera disponible après le Prompt 4.
      </p>
    </div>
  );
}

function StatCard({
  label,
  value,
  variant,
}: {
  label: string;
  value: string;
  variant: "success" | "muted";
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p
        className={`mt-1 font-mono text-xl font-bold ${
          variant === "success" ? "text-success" : "text-foreground"
        }`}
      >
        {value} <span className="text-sm font-normal text-muted-foreground">XOF</span>
      </p>
    </div>
  );
}

function Row({ tx, userId }: { tx: Tx; userId: string }) {
  const isOut = tx.sender_id === userId;
  const failed = tx.status === "failed";
  return (
    <li className="flex items-center justify-between px-4 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
            isOut ? "bg-destructive/10 text-destructive" : "bg-success/10 text-success"
          }`}
        >
          {isOut ? <ArrowUpRight className="h-5 w-5" /> : <ArrowDownLeft className="h-5 w-5" />}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium">
            {isOut ? "Envoi" : "Réception"}
            {failed && <span className="ml-2 text-xs text-destructive">échoué</span>}
          </p>
          <p className="text-xs text-muted-foreground">{formatDate(tx.created_at)}</p>
          <p className="truncate font-mono text-[10px] text-muted-foreground">
            #{tx.receipt_code.slice(0, 8)}
          </p>
        </div>
      </div>
      <div className="text-right">
        <p
          className={`font-mono text-sm font-semibold ${
            isOut ? "text-foreground" : "text-success"
          }`}
        >
          {isOut ? "−" : "+"}
          {formatMoney(tx.amount)}
        </p>
        {isOut && tx.fee > 0 && (
          <p className="text-[10px] text-muted-foreground">frais {formatMoney(tx.fee)}</p>
        )}
      </div>
    </li>
  );
}
