import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ShieldAlert, RefreshCw, Trash2, KeyRound, Search, Loader2, ArrowLeft } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { AuthGate, formatDate } from "@/components/auth-gate";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { listOtpCodes, purgeExpiredOtpCodes, type OtpRow } from "@/lib/admin-otp.functions";

export const Route = createFileRoute("/admin-otp")({
  head: () => ({
    meta: [
      { title: "Debug OTP — PayLink" },
      { name: "description", content: "Visualisation des codes OTP (admin / debug)." },
    ],
  }),
  component: () => (
    <AuthGate requireAdmin>
      <AdminOtpPage />
    </AuthGate>
  ),
});

function AdminOtpPage() {
  const { session } = useAuth();
  const [rows, setRows] = useState<OtpRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [purging, setPurging] = useState(false);
  const [q, setQ] = useState("");

  const load = async () => {
    if (!session?.access_token) return;
    setLoading(true);
    try {
      const data = await listOtpCodes({ data: { accessToken: session.access_token } });
      setRows(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur de chargement.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const id = setInterval(load, 8000); // refresh auto toutes les 8s
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.access_token]);

  const handlePurge = async () => {
    if (!session?.access_token) return;
    setPurging(true);
    try {
      const res = await purgeExpiredOtpCodes({ data: { accessToken: session.access_token } });
      toast.success(`${res.deleted} code(s) supprimé(s).`);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur de purge.");
    } finally {
      setPurging(false);
    }
  };

  const stats = useMemo(() => {
    const active = rows.filter((r) => r.status === "active").length;
    const used = rows.filter((r) => r.status === "used").length;
    const expired = rows.filter((r) => r.status === "expired").length;
    return { total: rows.length, active, used, expired };
  }, [rows]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r) => r.email.toLowerCase().includes(s));
  }, [rows, q]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2">
            <Link to="/admin">
              <ArrowLeft className="mr-1 h-4 w-4" /> Retour audit
            </Link>
          </Button>
          <h1 className="font-display text-2xl font-bold md:text-3xl">Debug OTP</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Codes générés en mode démo — actualisé toutes les 8 secondes.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Rafraîchir
          </Button>
          <Button variant="destructive" size="sm" onClick={handlePurge} disabled={purging}>
            {purging ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="mr-2 h-4 w-4" />
            )}
            Purger usés/expirés
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Total" value={stats.total} tone="muted" />
        <StatCard label="Actifs" value={stats.active} tone="success" />
        <StatCard label="Utilisés" value={stats.used} tone="primary" />
        <StatCard label="Expirés" value={stats.expired} tone="danger" />
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Filtrer par email..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="pl-10"
        />
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left">Email</th>
                <th className="px-4 py-3 text-left">Créé</th>
                <th className="px-4 py-3 text-left">Expire</th>
                <th className="px-4 py-3 text-center">Tentatives</th>
                <th className="px-4 py-3 text-right">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading && rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">
                    <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">
                    <KeyRound className="mx-auto mb-2 h-6 w-6 opacity-50" />
                    Aucun code OTP.
                  </td>
                </tr>
              ) : (
                filtered.map((r) => (
                  <tr key={r.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3 font-mono text-xs">{r.email}</td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(r.created_at)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(r.expires_at)}</td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={
                          r.attempts >= 5
                            ? "font-semibold text-destructive"
                            : r.attempts > 0
                              ? "font-medium text-warning"
                              : "text-muted-foreground"
                        }
                      >
                        {r.attempts}/5
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <StatusBadge status={r.status} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-start gap-3 rounded-2xl border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
        <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
        <p>
          Les codes sont stockés <strong>hashés (SHA-256)</strong> en base — leur valeur en clair
          n'apparaît qu'une seule fois sur l'écran de vérification après inscription.
        </p>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "muted" | "success" | "primary" | "danger";
}) {
  const toneCls = {
    muted: "text-foreground",
    success: "text-success",
    primary: "text-primary",
    danger: "text-destructive",
  }[tone];
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`mt-1 font-display text-2xl font-bold ${toneCls}`}>{value}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: OtpRow["status"] }) {
  if (status === "active")
    return <Badge className="bg-success/15 text-success hover:bg-success/20">Actif</Badge>;
  if (status === "used")
    return <Badge className="bg-primary/15 text-primary hover:bg-primary/20">Utilisé</Badge>;
  return (
    <Badge className="bg-destructive/15 text-destructive hover:bg-destructive/20">Expiré</Badge>
  );
}
