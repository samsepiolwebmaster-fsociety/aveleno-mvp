// Basic Auth — verrou sur tout le site (SITE_PASSWORD / SITE_USER, défaut "davis"). Fail-closed.
export default async (request, context) => {
  const USER = Netlify.env.get("SITE_USER") || "davis";
  const PASS = Netlify.env.get("SITE_PASSWORD");
  if (!PASS) return new Response("Site verrouillé : SITE_PASSWORD manquant.", { status: 503, headers: { "content-type": "text/plain; charset=utf-8" } });
  const [scheme, encoded] = (request.headers.get("authorization") || "").split(" ");
  if (scheme === "Basic" && encoded) { const d = atob(encoded); const i = d.indexOf(":"); if (d.slice(0,i)===USER && d.slice(i+1)===PASS) return context.next(); }
  return new Response("Authentification requise.", { status: 401, headers: { "WWW-Authenticate": 'Basic realm="Aveleno", charset="UTF-8"', "content-type": "text/plain; charset=utf-8" } });
};
