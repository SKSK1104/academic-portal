const SUPABASE_URL = 'https://ujqbwqeuohfoorwxwofi.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_Axfo8dWsS0xx_IHz5V_vfA_YozKzrL4';

export default async function handler(_request, response) {
  try {
    const result = await fetch(`${SUPABASE_URL}/rest/v1/rpc/v2_keepalive`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
        'Content-Type': 'application/json'
      },
      body: '{}'
    });

    if (!result.ok) {
      const detail = await result.text();
      return response.status(502).json({ ok: false, status: result.status, detail });
    }

    return response.status(200).json({ ok: true, pingedAt: await result.json() });
  } catch (error) {
    return response.status(500).json({ ok: false, error: error instanceof Error ? error.message : String(error) });
  }
}
