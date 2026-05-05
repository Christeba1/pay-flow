import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Shield, Search, TrendingUp, Users, Wallet, Activity, KeyRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AuthGate, formatMoney, formatDate } from "@/components/auth-gate";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { generateReceiptPdf } from "@/lib/receipt";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Audit — PayLink" },
      { name: "description", content: "Journal d'audit des flux financiers (admin)." },
    ],
  }),
  component: () => (
    <AuthGate requireAdmin>
      <AdminPage />
    </AuthGate>
  ),
});

type AuditRow = {
  id: string;
  created_at: string;
  amount: number;
  fee: number;
  status: string;
  receipt_code: string;
  sender_id: string;
  receiver_id: string;
};

type ProfileLite = { id: string; handle: string; full_name: string | null; balance: number };

function AdminPage() {
  const [txs, setTxs] = useState<AuditRow[]>([]);
  const [profiles, setProfiles] = useState<Record<string, ProfileLite>>({});
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  useEffect(() => {
    (async () => {
      const [{ data: txData }, { data: profData }] = await Promise.all([
        supabase
          .from("transactions")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(500),
        supabase.from("profiles").select("id,handle,full_name,balance"),
      ]);
      setTxs((txData ?? []) as AuditRow[]);
      const map: Record<string, ProfileLite> = {};
      (profData ?? []).forEach((p) => {
        map[p.id] = p as ProfileLite;
      });
      setProfiles(map);
      setLoading(false);
    })();
  }, []);

  const stats = useMemo(() => {
    const success = txs.filter((t) => t.status === "success");
    const totalVolume = success.reduce((s, t) => s + Number(t.amount), 0);
    const totalFees = success.reduce((s, t) => s + Number(t.fee), 0);
    const totalBalance = Object.values(profiles).reduce((s, p) => s + Number(p.balance), 0);
    return {
      totalVolume,
      totalFees,
      totalBalance,
      txCount: txs.length,
      userCount: Object.keys(profiles).length,
    };
  }, [txs, profiles]);

  const filtered = useMemo(() => {
    if (!q.trim()) return txs;
    const needle = q.toLowerCase();
    return txs.filter((t) => {
      const s = profiles[t.sender_id];
      const r = profiles[t.receiver_id];
      return (
        t.receipt_code.toLowerCase().includes(needle) ||
        s?.handle.toLowerCase().includes(needle) ||
        r?.handle.toLowerCase().includes(needle) ||
        s?.full_name?.toLowerCase().includes(needle) ||
        r?.full_name?.toLowerCase().includes(needle)
      );
    });
  }, [txs, profiles, q]);

  const downloadReceipt = (tx: AuditRow) => {
    const s = profiles[tx.sender_id];
    const r = profiles[tx.receiver_id];
    generateReceiptPdf({
      receipt_code: tx.receipt_code,
      created_at: tx.created_at,
      amount: Number(tx.amount),
      fee: Number(tx.fee),
      status: tx.status,
      sender_handle: s?.handle ?? "?",
      sender_name: s?.full_name ?? null,
      receiver_handle: r?.handle ?? "?",
      receiver_name: r?.full_name ?? null,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Shield className="h-5 w-5" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold md:text-3xl">Journal d'audit</h1>
          <p className="text-sm text-muted-foreground">
            Vue complète des flux financiers — réservée aux administrateurs
          </p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid gap-3 md:grid-cols-3">
        <Kpi
          icon={<TrendingUp className="h-4 w-4" />}
          label="Volume total"
          value={formatMoney(stats.totalVolume)}
          unit="XOF"
        />
        <Kpi
          icon={<Activity className="h-4 w-4" />}
          label="Frais collectés"
          value={formatMoney(stats.totalFees)}
          unit="XOF"
          highlight
        />
        <Kpi
          icon={<Wallet className="h-4 w-4" />}
          label="Liquidités totales"
          value={formatMoney(stats.totalBalance)}
          unit="XOF"
        />
        <Kpi
          icon={<Users className="h-4 w-4" />}
          label="Utilisateurs"
          value={String(stats.userCount)}
        />
        <Kpi
          icon={<Activity className="h-4 w-4" />}
          label="Transactions"
          value={String(stats.txCount)}
        />
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Rechercher par handle, nom ou code reçu…"
          className="pl-9"
        />
      </div>

      {/* Audit table */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left">Date</th>
                <th className="px-4 py-3 text-left">Expéditeur</th>
                <th className="px-4 py-3 text-left">Destinataire</th>
                <th className="px-4 py-3 text-right">Montant</th>
                <th className="px-4 py-3 text-right">Frais</th>
                <th className="px-4 py-3 text-center">Statut</th>
                <th className="px-4 py-3 text-right">Reçu</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted-foreground">
                    Chargement…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted-foreground">
                    Aucune transaction.
                  </td>
                </tr>
              ) : (
                filtered.map((tx) => {
                  const s = profiles[tx.sender_id];
                  const r = profiles[tx.receiver_id];
                  return (
                    <tr key={tx.id} className="hover:bg-muted/30">
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {formatDate(tx.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium">{s?.full_name || "—"}</div>
                        <div className="font-mono text-xs text-muted-foreground">
                          @{s?.handle ?? "?"}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium">{r?.full_name || "—"}</div>
                        <div className="font-mono text-xs text-muted-foreground">
                          @{r?.handle ?? "?"}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-mono">{formatMoney(tx.amount)}</td>
                      <td className="px-4 py-3 text-right font-mono text-muted-foreground">
                        {formatMoney(tx.fee)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <StatusBadge status={tx.status} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        {tx.status === "success" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => downloadReceipt(tx)}
                            className="text-xs"
                          >
                            PDF
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Kpi({
  icon,
  label,
  value,
  unit,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  unit?: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-4 shadow-soft ${
        highlight ? "border-primary/30 bg-primary/5" : "border-border bg-card"
      }`}
    >
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
        {icon}
        {label}
      </div>
      <p
        className={`mt-2 font-mono text-xl font-bold ${highlight ? "text-primary" : ""}`}
      >
        {value}
        {unit && <span className="ml-1 text-xs font-normal text-muted-foreground">{unit}</span>}
      </p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    success: { label: "Réussi", cls: "bg-success/10 text-success" },
    failed: { label: "Échec", cls: "bg-destructive/10 text-destructive" },
    pending: { label: "En cours", cls: "bg-muted text-muted-foreground" },
  };
  const m = map[status] ?? map.pending;
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${m.cls}`}>
      {m.label}
    </span>
  );
}
