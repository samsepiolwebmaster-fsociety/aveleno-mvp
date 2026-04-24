export default async (req) => {
  const STRIPE_SECRET = Netlify.env.get('STRIPE_SECRET_KEY');
  const BASE_URL = Netlify.env.get('URL') || 'https://avelenov3.netlify.app';

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const { track_id, track_title, artist_name, license_type, price_cents } = await req.json();

  if (!track_id || !price_cents) {
    return new Response(JSON.stringify({ error: 'Paramètres manquants' }), {
      status: 400, headers: { 'Content-Type': 'application/json' }
    });
  }

  const checkoutParams = new URLSearchParams({
    'payment_method_types[]': 'card',
    'line_items[0][price_data][currency]': 'eur',
    'line_items[0][price_data][unit_amount]': String(price_cents),
    'line_items[0][price_data][product_data][name]': `${track_title || 'Morceau'} — ${license_type || 'MP3'}`,
    'line_items[0][price_data][product_data][description]': `Téléchargement par ${artist_name || 'Artiste'} via Aveleno`,
    'line_items[0][quantity]': '1',
    'mode': 'payment',
    'success_url': `${BASE_URL}?payment=success&track_id=${track_id}&session_id={CHECKOUT_SESSION_ID}`,
    'cancel_url': `${BASE_URL}?payment=cancelled`,
    'metadata[track_id]': track_id,
    'metadata[license_type]': license_type || 'MP3',
  });

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
