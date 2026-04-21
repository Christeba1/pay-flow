import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// === DELETE ACCOUNT ===
// Le client envoie son access_token, on le vérifie côté serveur.
export const deleteAccount = createServerFn({ method: "POST" })
  .inputValidator(z.object({ accessToken: z.string().min(10) }))
  .handler(async ({ data }) => {
    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(data.accessToken);
    if (userErr || !userData.user) throw new Error("Session invalide.");

    const userId = userData.user.id;

    // Nettoyer les données associées (les transactions restent pour audit, on anonymise via SET NULL serait mieux,
    // mais ici on les supprime aussi pour respecter la suppression de compte)
    await supabaseAdmin.from("user_roles").delete().eq("user_id", userId);
    await supabaseAdmin.from("profiles").delete().eq("id", userId);

    const { error: delErr } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (delErr) throw new Error(delErr.message);

    return { success: true };
  });
