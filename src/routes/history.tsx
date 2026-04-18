import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Download, FileText, Filter } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { AuthGate, formatMoney, formatDate } from "@/components/auth-gate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { exportTransactionsCsv, generateReceiptPdf } from "@/lib/receipt";

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

type ProfileLite = { id: string; handle: string; full_name: string | null };
type FilterType = "all" | "sent" | "received";

function HistoryPage() {
  const { user, profile } = useAuth();
  const [txs, setTxs] = useState<Tx[]>([]);
  const [counterparties, setCounterparties] = useState<Record<string, ProfileLite>>({});
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState<FilterType>("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("transactions")
        .select("*")
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .order("created_at", { ascending: false });
      const rows = (data ?? []) as Tx[];
      setTxs(rows);

      // Load counterparty profiles
      const ids = new Set<string>();
      rows.forEach((t) => {
        ids.add(t.sender_id === user.id ? t.receiver_id : t.sender_id);
      });
      if (ids.size > 0) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id,handle,full_name")
          .in("id", Array.from(ids));
        const map: Record<string, ProfileLite> = {};
        (profs ?? []).forEach((p) => {
          map[p.id] = p as ProfileLite;
        });
        setCounterparties(map);
      }
      setLoading(false);
    })();
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

  const handleExportCsv = () => {
    if (!user) return;
    const rows = filtered.map((tx) => {
      const isOut = tx.sender_id === user.id;
      const cp = counterparties[isOut ? tx.receiver_id : tx.sender_id];
      return {
        created_at: tx.created_at,
        direction: isOut ? ("out" as const) : ("in" as const),
        counterparty: cp ? `${cp.full_name ?? ""} (@${cp.handle})` : "—",
        amount: Number(tx.amount),
        fee: Number(tx.fee),
        status: tx.status,
        receipt_code: tx.receipt_code,
      };
    });
    exportTransactionsCsv(rows);
  };

  const handleDownloadReceipt = (tx: Tx) => {
    if (!user || !profile) return;
    const isOut = tx.sender_id === user.id;
    const cp = counterparties[isOut ? tx.receiver_id : tx.sender_id];
    generateReceiptPdf({
      receipt_code: tx.receipt_code,
      created_at: tx.created_at,
      amount: Number(tx.amount),
      fee: Number(tx.fee),
      status: tx.status,
      sender_handle: isOut ? profile.handle : cp?.handle ?? "?",
      sender_name: isOut ? profile.full_name : cp?.full_name ?? null,
      receiver_handle: isOut ? cp?.handle ?? "?" : profile.handle,
      receiver_name: isOut ? cp?.full_name ?? null : profile.full_name,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold md:text-3xl">Historique</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {filtered.length} opération{filtered.length > 1 ? "s" : ""} affichée
            {filtered.length > 1 ? "s" : ""}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleExportCsv}
          disabled={filtered.length === 0}
        >
          <Download className="mr-2 h-4 w-4" />
          Exporter CSV
        </Button>
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
              <Row
                key={tx.id}
                tx={tx}
                userId={user!.id}
                counterparty={
                  counterparties[tx.sender_id === user!.id ? tx.receiver_id : tx.sender_id]
                }
                onDownload={() => handleDownloadReceipt(tx)}
              />
            ))}
          </ul>
        )}
      </div>
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

function Row({
  tx,
  userId,
  counterparty,
  onDownload,
}: {
  tx: Tx;
  userId: string;
  counterparty?: ProfileLite;
  onDownload: () => void;
}) {
  const isOut = tx.sender_id === userId;
  const failed = tx.status === "failed";
  return (
    <li className="flex items-center justify-between gap-3 px-4 py-3">
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
            {isOut ? "Envoi à " : "Réception de "}
            <span className="font-mono text-xs">@{counterparty?.handle ?? "?"}</span>
            {failed && <span className="ml-2 text-xs text-destructive">échoué</span>}
          </p>
          <p className="text-xs text-muted-foreground">{formatDate(tx.created_at)}</p>
          <p className="truncate font-mono text-[10px] text-muted-foreground">
            #{tx.receipt_code.slice(0, 8)}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
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
        {!failed && (
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 shrink-0"
            onClick={onDownload}
            title="Télécharger le reçu PDF"
          >
            <FileText className="h-4 w-4" />
          </Button>
        )}
      </div>
    </li>
  );
}
