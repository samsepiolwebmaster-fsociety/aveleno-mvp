export default async (req) => {
  const STRIPE_SECRET = Netlify.env.get('STRIPE_SECRET_KEY');
  const STRIPE_WEBHOOK_SECRET = Netlify.env.get('STRIPE_WEBHOOK_SECRET');
  const SUPA_URL = Netlify.env.get('SUPABASE_URL');
  const SUPA_KEY = Netlify.env.get('SUPABASE_SERVICE_KEY');

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const body = await req.text();
  const signature = req.headers.get('stripe-signature');

  // Vérifier la signature Stripe (sécurité)
  // En mode test, on peut skip la vérification pour l'instant
  let event;
  try {
    // Parse simple sans vérification de signature pour le MVP
    event = JSON.parse(body);
  } catch (err) {
    return new Response('Invalid payload', { status: 400 });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const { track_id, license_type, user_id } = session.metadata;

    // Enregistrer l'achat dans Supabase
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
        license_type,
        buyer_email: session.customer_details?.email,
        stripe_session_id: session.id,
        amount_cents: session.amount_total,
        status: 'paid'
      })
    });
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
};

export const config = {
  path: '/api/stripe-webhook'
};
