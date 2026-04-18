import jsPDF from "jspdf";

type ReceiptData = {
  receipt_code: string;
  created_at: string;
  amount: number;
  fee: number;
  status: string;
  sender_handle: string;
  sender_name: string | null;
  receiver_handle: string;
  receiver_name: string | null;
};

const fmt = (n: number) =>
  new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

export function generateReceiptPdf(tx: ReceiptData) {
  const doc = new jsPDF({ unit: "mm", format: "a5" });
  const pageW = doc.internal.pageSize.getWidth();

  // Header band
  doc.setFillColor(15, 76, 71); // deep teal
  doc.rect(0, 0, pageW, 28, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text("PayLink", 12, 15);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("Recu electronique de paiement", 12, 22);

  // Status badge
  const ok = tx.status === "success";
  doc.setFillColor(ok ? 34 : 220, ok ? 197 : 38, ok ? 94 : 38);
  doc.roundedRect(pageW - 42, 8, 32, 9, 2, 2, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text(ok ? "REUSSI" : "ECHEC", pageW - 26, 14, { align: "center" });

  // Body
  doc.setTextColor(0, 0, 0);
  let y = 40;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Reference", 12, y);
  doc.setFont("courier", "normal");
  doc.setFontSize(9);
  doc.text(tx.receipt_code, 12, y + 5);

  y += 14;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  doc.text("Date", 12, y);
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(10);
  doc.text(
    new Date(tx.created_at).toLocaleString("fr-FR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }),
    12,
    y + 5,
  );

  // Parties
  y += 14;
  doc.setDrawColor(220, 220, 220);
  doc.line(12, y, pageW - 12, y);

  y += 8;
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  doc.text("EXPEDITEUR", 12, y);
  doc.text("DESTINATAIRE", pageW / 2 + 4, y);

  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(tx.sender_name || "—", 12, y + 6);
  doc.text(tx.receiver_name || "—", pageW / 2 + 4, y + 6);
  doc.setFont("courier", "normal");
  doc.setFontSize(9);
  doc.text("@" + tx.sender_handle, 12, y + 11);
  doc.text("@" + tx.receiver_handle, pageW / 2 + 4, y + 11);

  // Amounts box
  y += 22;
  doc.setFillColor(245, 247, 246);
  doc.roundedRect(12, y, pageW - 24, 38, 3, 3, "F");

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);
  doc.text("Montant transfere", 18, y + 9);
  doc.text("Frais (1%)", 18, y + 18);
  doc.setFont("helvetica", "bold");
  doc.text("Total debite", 18, y + 30);

  doc.setFont("courier", "normal");
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(11);
  doc.text(`${fmt(tx.amount)} XOF`, pageW - 18, y + 9, { align: "right" });
  doc.setFontSize(10);
  doc.text(`${fmt(tx.fee)} XOF`, pageW - 18, y + 18, { align: "right" });
  doc.setFontSize(13);
  doc.setFont("courier", "bold");
  doc.text(`${fmt(tx.amount + tx.fee)} XOF`, pageW - 18, y + 30, { align: "right" });

  // Footer
  doc.setFont("helvetica", "italic");
  doc.setFontSize(7);
  doc.setTextColor(140, 140, 140);
  doc.text(
    "Document genere automatiquement — Conservez ce recu comme preuve de paiement.",
    pageW / 2,
    doc.internal.pageSize.getHeight() - 10,
    { align: "center" },
  );

  doc.save(`recu-paylink-${tx.receipt_code.slice(0, 8)}.pdf`);
}

export function exportTransactionsCsv(
  rows: Array<{
    created_at: string;
    direction: "in" | "out";
    counterparty: string;
    amount: number;
    fee: number;
    status: string;
    receipt_code: string;
  }>,
) {
  const header = ["Date", "Sens", "Contrepartie", "Montant", "Frais", "Statut", "Reference"];
  const lines = rows.map((r) =>
    [
      new Date(r.created_at).toISOString(),
      r.direction === "in" ? "Recu" : "Envoye",
      r.counterparty,
      r.amount.toFixed(2),
      r.fee.toFixed(2),
      r.status,
      r.receipt_code,
    ]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(","),
  );
  const csv = "\uFEFF" + [header.join(","), ...lines].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `paylink-historique-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
