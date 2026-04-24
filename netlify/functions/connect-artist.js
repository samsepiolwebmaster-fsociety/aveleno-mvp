export default async (req) => {
  const STRIPE_SECRET = Netlify.env.get('STRIPE_SECRET_KEY');
  const STRIPE_CLIENT_ID = Netlify.env.get('STRIPE_CONNECT_CLIENT_ID');
  const BASE_URL = Netlify.env.get('URL') || 'https://avelenov3.netlify.app';

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const { artist_id, artist_name, email } = await req.json();

  if (!artist_id) {
    return new Response(JSON.stringify({ error: 'artist_id requis' }), {
      status: 400, headers: { 'Content-Type': 'application/json' }
    });
  }

  // Construire l'URL OAuth Stripe Connect
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: STRIPE_CLIENT_ID,
    scope: 'read_write',
    redirect_uri: `${BASE_URL}/oauth-callback`,
    state: artist_id,
    'stripe_user[email]': email || '',
    'stripe_user[business_name]': artist_name || '',
    'stripe_user[country]': 'FR',
  });

  const connectUrl = `https://connect.stripe.com/oauth/authorize?${params.toString()}`;

  return new Response(JSON.stringify({ url: connectUrl }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
};

export const config = {
  path: '/api/connect-artist'
};
