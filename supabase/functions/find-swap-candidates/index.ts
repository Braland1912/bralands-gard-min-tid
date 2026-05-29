import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const SHIFT_LABELS: Record<string, string> = {
  morning: 'Morgon',
  day: 'Dag',
  evening: 'Kväll',
  fishing: 'Fiske',
  clearing: 'Röja',
};

const WORK_SHIFTS = new Set(['morning', 'day', 'evening', 'fishing', 'clearing']);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const date: string = body?.date;
    const requesterWorkerId: string | undefined = body?.requesterWorkerId;
    const requesterShiftType: string | undefined = body?.requesterShiftType;

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return new Response(JSON.stringify({ error: 'date krävs (YYYY-MM-DD)' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const [workersRes, schedulesRes, phonesRes, requesterRes] = await Promise.all([
      supabase.from('workers').select('id, name, user_id'),
      supabase.from('schedules').select('user_id, shift_type, note').eq('date', date),
      supabase.from('pending_members').select('user_id, phone'),
      requesterWorkerId
        ? supabase.from('workers').select('name').eq('id', requesterWorkerId).maybeSingle()
        : Promise.resolve({ data: null } as any),
    ]);

    if (workersRes.error) throw workersRes.error;
    if (schedulesRes.error) throw schedulesRes.error;

    const phoneByUser = new Map<string, string>();
    for (const p of (phonesRes.data ?? []) as any[]) {
      if (p.user_id && p.phone) phoneByUser.set(p.user_id, p.phone);
    }

    const scheduleByUser = new Map<string, any[]>();
    for (const s of (schedulesRes.data ?? []) as any[]) {
      const arr = scheduleByUser.get(s.user_id) ?? [];
      arr.push(s);
      scheduleByUser.set(s.user_id, arr);
    }

    type Candidate = { name: string; phone: string | null; status: string };
    const candidates: Candidate[] = [];

    for (const w of (workersRes.data ?? []) as any[]) {
      if (!w.user_id) continue;
      if (requesterWorkerId && w.id === requesterWorkerId) continue;

      const entries = scheduleByUser.get(w.user_id) ?? [];
      const hasWorkShift = entries.some((e) => WORK_SHIFTS.has(e.shift_type));
      if (hasWorkShift) continue;

      const busy = entries.find((e) => e.shift_type === 'busy');
      let status = 'Inget pass schemalagt';
      if (busy) {
        status = busy.note ? `Markerad upptagen: ${busy.note}` : 'Markerad som upptagen';
      }

      candidates.push({
        name: (w.name ?? '').trim(),
        phone: phoneByUser.get(w.user_id) ?? null,
        status,
      });
    }

    candidates.sort((a, b) => {
      const aBusy = a.status.startsWith('Markerad');
      const bBusy = b.status.startsWith('Markerad');
      if (aBusy !== bBusy) return aBusy ? 1 : -1;
      const aPhone = !!a.phone;
      const bPhone = !!b.phone;
      if (aPhone !== bPhone) return aPhone ? -1 : 1;
      return a.name.localeCompare(b.name, 'sv');
    });

    // AI-genererat SMS-utkast
    let smsDraft = '';
    const apiKey = Deno.env.get('LOVABLE_API_KEY');
    if (apiKey) {
      try {
        const requesterName = (requesterRes as any)?.data?.name ?? '';
        const dateNice = new Date(date + 'T00:00:00').toLocaleDateString('sv-SE', {
          weekday: 'long', day: 'numeric', month: 'long',
        });
        const shiftLabel = requesterShiftType ? SHIFT_LABELS[requesterShiftType] ?? requesterShiftType : '';

        const aiRes = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Lovable-API-Key': apiKey,
          },
          body: JSON.stringify({
            model: 'google/gemini-3-flash-preview',
            messages: [
              {
                role: 'system',
                content:
                  'Du skriver korta, varma och enkla SMS på svenska. Max 2 meningar. Inga emojis. Tonen ska passa en 15-åring som skriver till en jobbarkompis på Brålands Gård. Svara endast med själva SMS-texten, ingen inledning.',
              },
              {
                role: 'user',
                content: `Skriv ett SMS där ${requesterName || 'jag'} frågar om personen kan byta pass ${dateNice}${shiftLabel ? ' (' + shiftLabel + ')' : ''}. Använd platshållaren {namn} där mottagarens namn ska stå.`,
              },
            ],
          }),
        });
        if (aiRes.ok) {
          const json = await aiRes.json();
          smsDraft = json?.choices?.[0]?.message?.content?.trim() ?? '';
        }
      } catch (_e) {
        // ignorera AI-fel, fall tillbaka på tom mall
      }
    }

    return new Response(
      JSON.stringify({ candidates, smsDraft }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (e) {
    console.error('find-swap-candidates error', e);
    return new Response(JSON.stringify({ error: String((e as any)?.message ?? e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
