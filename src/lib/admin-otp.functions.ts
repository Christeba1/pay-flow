import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const InputSchema = z.object({ accessToken: z.string().min(10) });

async function assertAdmin(accessToken: string) {
  const { data: userData, error } = await supabaseAdmin.auth.getUser(accessToken);
  if (error || !userData.user) throw new Error("Session invalide.");
  const { data: role } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userData.user.id)
    .eq("role", "admin")
    .maybeSingle();
  if (!role) throw new Error("Accès refusé.");
}

export type OtpRow = {
  id: string;
  email: string;
  created_at: string;
  expires_at: string;
  used: boolean;
  attempts: number;
  status: "active" | "used" | "expired";
};

export const listOtpCodes = createServerFn({ method: "POST" })
  .inputValidator(InputSchema)
  .handler(async ({ data }): Promise<OtpRow[]> => {
    await assertAdmin(data.accessToken);
    const { data: rows, error } = await supabaseAdmin
      .from("otp_codes")
      .select("id,email,created_at,expires_at,used,attempts")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    const now = Date.now();
    return (rows ?? []).map((r) => ({
      ...r,
      status: r.used
        ? "used"
        : new Date(r.expires_at).getTime() < now
          ? "expired"
          : "active",
    })) as OtpRow[];
  });

export const purgeExpiredOtpCodes = createServerFn({ method: "POST" })
  .inputValidator(InputSchema)
  .handler(async ({ data }) => {
    await assertAdmin(data.accessToken);
    const { error, count } = await supabaseAdmin
      .from("otp_codes")
      .delete({ count: "exact" })
      .or(`used.eq.true,expires_at.lt.${new Date().toISOString()}`);
    if (error) throw new Error(error.message);
    return { deleted: count ?? 0 };
  });
