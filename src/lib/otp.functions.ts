import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createHash, randomInt } from "crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const hashCode = (code: string) => createHash("sha256").update(code).digest("hex");

const SendSchema = z.object({ email: z.string().email() });
const VerifySchema = z.object({
  email: z.string().email(),
  code: z.string().regex(/^\d{6}$/),
});

async function sendEmailViaResend(to: string, code: string) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY non configurée");

  const html = `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f4f6f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px"><tr><td align="center">
<table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.06)">
<tr><td style="padding:40px 40px 24px 40px">
<div style="width:48px;height:48px;background:linear-gradient(135deg,#0d7c8a,#3eb8c4);border-radius:12px;display:inline-block;text-align:center;line-height:48px;color:#fff;font-weight:700;font-size:22px">P</div>
<h1 style="margin:24px 0 8px 0;font-size:22px;color:#0f172a">Votre code de confirmation</h1>
<p style="margin:0;color:#64748b;font-size:14px;line-height:1.6">Saisissez ce code à 6 chiffres pour confirmer votre adresse email. Il expire dans 10 minutes.</p>
</td></tr>
<tr><td style="padding:0 40px 32px 40px" align="center">
<div style="font-family:'SF Mono',Menlo,monospace;font-size:36px;font-weight:700;letter-spacing:12px;color:#0d7c8a;background:#f0fafc;padding:20px 28px;border-radius:12px;display:inline-block">${code}</div>
</td></tr>
<tr><td style="padding:0 40px 40px 40px;border-top:1px solid #f1f5f9;padding-top:24px">
<p style="margin:0;color:#94a3b8;font-size:12px;line-height:1.6">Si vous n'avez pas demandé ce code, ignorez simplement ce message.</p>
</td></tr>
</table>
<p style="margin:24px 0 0 0;color:#94a3b8;font-size:12px">PayLink — Transferts simples & sécurisés</p>
</td></tr></table></body></html>`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "PayLink <onboarding@resend.dev>",
      to: [to],
      subject: `${code} — Votre code PayLink`,
      html,
    }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Resend error ${res.status}: ${txt}`);
  }
}

export const sendOtp = createServerFn({ method: "POST" })
  .inputValidator((d) => SendSchema.parse(d))
  .handler(async ({ data }) => {
    const email = data.email.toLowerCase().trim();
    const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    // Invalider les anciens codes
    await supabaseAdmin.from("otp_codes").update({ used: true }).eq("email", email).eq("used", false);
    const { error } = await supabaseAdmin.from("otp_codes").insert({
      email,
      code_hash: hashCode(code),
      expires_at: expiresAt,
    });
    if (error) throw new Error(error.message);

    await sendEmailViaResend(email, code);
    return { ok: true };
  });

export const verifyOtp = createServerFn({ method: "POST" })
  .inputValidator((d) => VerifySchema.parse(d))
  .handler(async ({ data }) => {
    const email = data.email.toLowerCase().trim();
    const { data: rows, error } = await supabaseAdmin
      .from("otp_codes")
      .select("*")
      .eq("email", email)
      .eq("used", false)
      .order("created_at", { ascending: false })
      .limit(1);
    if (error) throw new Error(error.message);
    const row = rows?.[0];
    if (!row) throw new Error("Aucun code en attente. Renvoyez-en un.");
    if (new Date(row.expires_at).getTime() < Date.now()) throw new Error("Code expiré.");
    if (row.attempts >= 5) throw new Error("Trop de tentatives. Renvoyez un nouveau code.");

    if (row.code_hash !== hashCode(data.code)) {
      await supabaseAdmin.from("otp_codes").update({ attempts: row.attempts + 1 }).eq("id", row.id);
      throw new Error("Code incorrect.");
    }
    await supabaseAdmin.from("otp_codes").update({ used: true }).eq("id", row.id);
    return { ok: true };
  });
