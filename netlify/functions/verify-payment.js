export default async (req) => {
  const STRIPE_SECRET = Netlify.env.get('STRIPE_SECRET_KEY');
  const SUPA_URL = Netlify.env.get('SUPABASE_URL');
  const SUPA_KEY = Netlify.env.get('SUPABASE_SERVICE_KEY');

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const { session_id, track_id } = await req.json();

  if (!session_id || !track_id) {
    return new Response(JSON.stringify({ error: 'Paramètres manquants' }), {
      status: 400, headers: { 'Content-Type': 'application/json' }
    });
  }

  // 1. Vérifier le paiement auprès de Stripe
  const sessionRes = await fetch(
    `https://api.stripe.com/v1/checkout/sessions/${session_id}`,
    {
      headers: { 'Authorization': `Bearer ${STRIPE_SECRET}` }
    }
  );
  const session = await sessionRes.json();

  if (!session || session.payment_status !== 'paid') {
    return new Response(JSON.stringify({ error: 'Paiement non confirmé' }), {
      status: 402, headers: { 'Content-Type': 'application/json' }
    });
  }

  // 2. Récupérer le file_path du morceau depuis Supabase
  const trackRes = await fetch(
    `${SUPA_URL}/rest/v1/tracks?id=eq.${track_id}&select=file_path,title,artist_name`,
    {
      headers: {
        'apikey': SUPA_KEY,
        'Authorization': `Bearer ${SUPA_KEY}`
      }
    }
  );
  const tracks = await trackRes.json();
  const track = tracks[0];

  if (!track) {
    return new Response(JSON.stringify({ error: 'Morceau introuvable' }), {
      status: 404, headers: { 'Content-Type': 'application/json' }
    });
  }

  // 3. Générer une URL signée Supabase (expire dans 1h)
  const signedRes = await fetch(
    `${SUPA_URL}/storage/v1/object/sign/tracks/${track.file_path}`,
    {
      method: 'POST',
      headers: {
        'apikey': SUPA_KEY,
        'Authorization': `Bearer ${SUPA_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ expiresIn: 3600 })
    }
  );
  const signed = await signedRes.json();

  if (!signed.signedURL) {
    return new Response(JSON.stringify({ error: 'Impossible de générer le lien' }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }

  // 4. Enregistrer la commande dans Supabase
  await fetch(`${SUPA_URL}/rest/v1/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPA_KEY,
      'Authorization': `Bearer ${SUPA_KEY}`,
      'Prefer': 'return=minimal'
    },
    body: JSON.stringify({
      track_id,
      license_type: session.metadata?.license_type || 'MP3',
      buyer_email: session.customer_details?.email,
      stripe_session_id: session_id,
      amount_cents: session.amount_total,
      status: 'paid'
    })
  });

  return new Response(JSON.stringify({
    download_url: `${SUPA_URL}/storage/v1${signed.signedURL}`,
    title: track.title,
    artist: track.artist_name,
    expires_in: 3600
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
};

export const config = {
  path: '/api/verify-payment'
};
