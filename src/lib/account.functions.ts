import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getRequestHeader } from "@tanstack/react-start/server";

// === DELETE ACCOUNT ===
// Vérifie le JWT du user, puis supprime son compte (et profile via cascade/manuel)
export const deleteAccount = createServerFn({ method: "POST" }).handler(async () => {
  const authHeader = getRequestHeader("authorization") || getRequestHeader("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw new Error("Non authentifié.");
  }
  const token = authHeader.slice("Bearer ".length);

  const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
  if (userErr || !userData.user) throw new Error("Session invalide.");

  const userId = userData.user.id;

  // Supprimer le profile (transactions et user_roles n'ont pas de FK cascade explicite, on les nettoie aussi)
  await supabaseAdmin.from("user_roles").delete().eq("user_id", userId);
  await supabaseAdmin.from("profiles").delete().eq("id", userId);

  const { error: delErr } = await supabaseAdmin.auth.admin.deleteUser(userId);
  if (delErr) throw new Error(delErr.message);

  return { success: true };
});
