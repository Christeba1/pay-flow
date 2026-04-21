import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const RESEND_FROM = "PayLink <onboarding@resend.dev>";

async function sendOtpEmail(email: string, code: string, fullName: string) {
  const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;background:#ffffff">
      <div style="text-align:center;margin-bottom:24px">
        <div style="display:inline-block;width:56px;height:56px;border-radius:14px;background:linear-gradient(135deg,#3b82f6,#8b5cf6);color:white;font-size:28px;font-weight:bold;line-height:56px">P</div>
      </div>
      <h1 style="font-size:22px;color:#0f172a;text-align:center;margin:0 0 8px">Bienvenue sur PayLink</h1>
      <p style="color:#475569;text-align:center;margin:0 0 24px">Bonjour ${fullName}, voici votre code de confirmation :</p>
      <div style="background:#f1f5f9;border-radius:12px;padding:24px;text-align:center;margin:0 0 24px">
        <div style="font-size:36px;font-weight:bold;letter-spacing:8px;color:#0f172a;font-family:monospace">${code}</div>
      </div>
      <p style="color:#64748b;font-size:13px;text-align:center;margin:0">Ce code expire dans 10 minutes.</p>
      <p style="color:#94a3b8;font-size:12px;text-align:center;margin:24px 0 0">Si vous n'avez pas demandé ce code, ignorez cet email.</p>
    </div>
  `;

  // Using Lovable AI Gateway → Resend connector OR direct Resend
  // Try direct Resend via gateway-less call using a public test domain
  const RESEND_API_KEY = process.env.RESEND_API_KEY;

  if (RESEND_API_KEY) {
    // Direct Resend call (if connector configured)
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: RESEND_FROM,
        to: [email],
        subject: `Votre code PayLink : ${code}`,
        html,
      }),
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Resend API error [${res.status}]: ${errText}`);
    }
    return;
  }

  // Fallback: use Lovable connector gateway for Resend
  const res = await fetch("https://connector-gateway.lovable.dev/resend/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "X-Connection-Api-Key": process.env.RESEND_API_KEY || "",
    },
    body: JSON.stringify({
      from: RESEND_FROM,
      to: [email],
      subject: `Votre code PayLink : ${code}`,
      html,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Resend gateway error [${res.status}]: ${errText}`);
  }
}

// === SIGN UP : crée user (auto-confirm OFF côté logique), envoie OTP ===
export const signUpAndSendOtp = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      email: z.string().email().max(255),
      password: z.string().min(6).max(72),
      fullName: z.string().min(1).max(120),
    })
  )
  .handler(async ({ data }) => {
    const { email, password, fullName } = data;

    // Vérifier si user existe déjà et est confirmé
    const { data: existing } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = existing?.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());

    if (existingUser?.email_confirmed_at) {
      throw new Error("Un compte existe déjà avec cet email.");
    }

    // Créer ou récupérer le user (non confirmé)
    if (!existingUser) {
      const { error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: false,
        user_metadata: { full_name: fullName },
      });
      if (createErr) throw new Error(createErr.message);
    } else {
      // mettre à jour le mot de passe
      await supabaseAdmin.auth.admin.updateUserById(existingUser.id, {
        password,
        user_metadata: { full_name: fullName },
      });
    }

    // Générer un code 6 chiffres
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    // Stocker (hashé) en DB
    const { error: rpcErr } = await supabaseAdmin.rpc("create_otp_code", {
      _email: email,
      _plain_code: code,
    });
    if (rpcErr) throw new Error(rpcErr.message);

    // Envoyer par email
    await sendOtpEmail(email, code, fullName);

    return { success: true };
  });

// === RESEND OTP ===
export const resendOtp = createServerFn({ method: "POST" })
  .inputValidator(z.object({ email: z.string().email().max(255) }))
  .handler(async ({ data }) => {
    const { email } = data;

    const { data: existing } = await supabaseAdmin.auth.admin.listUsers();
    const user = existing?.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (!user) throw new Error("Aucun compte trouvé pour cet email.");
    if (user.email_confirmed_at) throw new Error("Ce compte est déjà confirmé.");

    const fullName =
      (user.user_metadata?.full_name as string | undefined) ?? email.split("@")[0];
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    const { error: rpcErr } = await supabaseAdmin.rpc("create_otp_code", {
      _email: email,
      _plain_code: code,
    });
    if (rpcErr) throw new Error(rpcErr.message);

    await sendOtpEmail(email, code, fullName);
    return { success: true };
  });

// === VERIFY OTP : confirme user et renvoie session via magic link ===
export const verifyOtpCode = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      email: z.string().email().max(255),
      code: z.string().regex(/^\d{6}$/),
    })
  )
  .handler(async ({ data }) => {
    const { email, code } = data;

    const { data: ok, error: verifyErr } = await supabaseAdmin.rpc("verify_otp_code", {
      _email: email,
      _plain_code: code,
    });
    if (verifyErr) throw new Error(verifyErr.message);
    if (!ok) throw new Error("Code invalide ou expiré.");

    // Confirmer le user
    const { data: existing } = await supabaseAdmin.auth.admin.listUsers();
    const user = existing?.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (!user) throw new Error("Utilisateur introuvable.");

    if (!user.email_confirmed_at) {
      const { error: updErr } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
        email_confirm: true,
      });
      if (updErr) throw new Error(updErr.message);
    }

    return { success: true };
  });
