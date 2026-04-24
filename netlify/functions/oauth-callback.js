export default async (req) => {
  const STRIPE_SECRET = Netlify.env.get('STRIPE_SECRET_KEY');
  const SUPA_URL = Netlify.env.get('SUPABASE_URL');
  const SUPA_KEY = Netlify.env.get('SUPABASE_SERVICE_KEY');
  const BASE_URL = Netlify.env.get('URL') || 'https://avelenov3.netlify.app';

  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state'); // = artist_id (user_id Supabase)
  const error = url.searchParams.get('error');

  if (error) {
    return Response.redirect(`${BASE_URL}?stripe_error=${error}`, 302);
  }

  if (!code || !state) {
    return Response.redirect(`${BASE_URL}?stripe_error=missing_params`, 302);
  }

  // Échanger le code contre un stripe_account_id
  const tokenRes = await fetch('https://connect.stripe.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_secret: STRIPE_SECRET,
    })
  });

  const tokenData = await tokenRes.json();

  if (tokenData.error) {
    return Response.redirect(`${BASE_URL}?stripe_error=${tokenData.error}`, 302);
  }

  const stripeAccountId = tokenData.stripe_user_id;

  // Sauvegarder dans Supabase profiles
  await fetch(`${SUPA_URL}/rest/v1/profiles`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPA_KEY,
      'Authorization': `Bearer ${SUPA_KEY}`,
      'Prefer': 'return=minimal'
    },
    body: JSON.stringify({ stripe_account_id: stripeAccountId }),
    // Filter by user_id
  });

  // Alternative: upsert direct avec user_id
  await fetch(`${SUPA_URL}/rest/v1/profiles?user_id=eq.${state}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPA_KEY,
      'Authorization': `Bearer ${SUPA_KEY}`,
    },
    body: JSON.stringify({ stripe_account_id: stripeAccountId })
  });

  // Rediriger vers le dashboard avec succès
  return Response.redirect(`${BASE_URL}?stripe_connected=1`, 302);
};

export const config = {
  path: '/oauth-callback'
};
