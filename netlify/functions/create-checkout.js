export default async (req) => {
  const STRIPE_SECRET = Netlify.env.get('STRIPE_SECRET_KEY');
  const SUPA_URL = Netlify.env.get('SUPABASE_URL');
  const SUPA_KEY = Netlify.env.get('SUPABASE_SERVICE_KEY');
  const BASE_URL = Netlify.env.get('URL') || 'https://avelenov3.netlify.app';
  const PLATFORM_FEE_PERCENT = 15; // 15% commission Aveleno

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const { track_id, license_type, price_cents } = await req.json();

  if (!track_id || !license_type || !price_cents) {
    return new Response(JSON.stringify({ error: 'Paramètres manquants' }), {
      status: 400, headers: { 'Content-Type': 'application/json' }
    });
  }

  // Récupérer le morceau + le stripe_account_id de l'artiste depuis Supabase
  const trackRes = await fetch(
    `${SUPA_URL}/rest/v1/tracks?id=eq.${track_id}&select=*,profiles(stripe_account_id,artist_name)`,
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

  const stripeAccountId = track.profiles?.stripe_account_id;
  const applicationFee = Math.round(price_cents * PLATFORM_FEE_PERCENT / 100);

  // Construire les paramètres Checkout
  const checkoutParams = new URLSearchParams({
    'payment_method_types[]': 'card',
    'line_items[0][price_data][currency]': 'eur',
    'line_items[0][price_data][unit_amount]': price_cents,
    'line_items[0][price_data][product_data][name]': `${track.title} — ${license_type}`,
    'line_items[0][price_data][product_data][description]': `Licence ${license_type} par ${track.artist_name || 'Artiste'}`,
    'line_items[0][quantity]': '1',
    'mode': 'payment',
    'success_url': `${BASE_URL}?payment=success&track_id=${track_id}&session_id={CHECKOUT_SESSION_ID}`,
    'cancel_url': `${BASE_URL}?payment=cancelled`,
    'metadata[track_id]': track_id,
    'metadata[license_type]': license_type,
    'metadata[user_id]': track.user_id,
  });

  // Ajouter la commission si l'artiste a connecté Stripe
  if (stripeAccountId) {
    checkoutParams.append('payment_intent_data[application_fee_amount]', applicationFee);
    checkoutParams.append('payment_intent_data[transfer_data][destination]', stripeAccountId);
  }

  const checkoutRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${STRIPE_SECRET}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: checkoutParams
  });

  const session = await checkoutRes.json();

  if (session.error) {
    return new Response(JSON.stringify({ error: session.error.message }), {
      status: 400, headers: { 'Content-Type': 'application/json' }
    });
  }

  return new Response(JSON.stringify({ url: session.url, session_id: session.id }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
};

export const config = {
  path: '/api/create-checkout'
};
