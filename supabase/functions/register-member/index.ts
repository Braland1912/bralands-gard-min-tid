import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { token, firstName, lastName, email, phone, password } = await req.json();

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Validate invitation token
    const { data: invitation, error: invError } = await supabaseAdmin
      .from("invitations")
      .select("*")
      .eq("token", token)
      .single();

    if (invError || !invitation) {
      return new Response(
        JSON.stringify({ error: "Ogiltig inbjudningslänk." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (new Date(invitation.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: "Inbjudningslänken har gått ut." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if email already registered
    const { data: existing } = await supabaseAdmin
      .from("pending_members")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (existing) {
      return new Response(
        JSON.stringify({ error: "E-postadressen är redan registrerad." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create auth user (auto-confirmed but they can't do anything until approved)
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { first_name: firstName, last_name: lastName, phone, status: "pending" },
    });

    if (authError) {
      if (authError.message.includes("already been registered")) {
        return new Response(
          JSON.stringify({ error: "E-postadressen är redan registrerad." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw authError;
    }

    // Insert pending member
    const { error: insertError } = await supabaseAdmin
      .from("pending_members")
      .insert({
        first_name: firstName,
        last_name: lastName,
        email,
        phone,
        invitation_id: invitation.id,
        user_id: authData.user.id,
        status: "pending",
      });

    if (insertError) throw insertError;

    // Update invitation used count
    await supabaseAdmin
      .from("invitations")
      .update({ used_count: invitation.used_count + 1 })
      .eq("id", invitation.id);

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
