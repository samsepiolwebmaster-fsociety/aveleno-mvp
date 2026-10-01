// Compteur d'écoutes et de téléchargements des maquettes (Netlify Blobs, aucune donnée personnelle :
// ni IP, ni cookie, ni identifiant — seulement des totaux par titre).
import { getStore } from "@netlify/blobs";

const TITRES = ["too-litt-rmx", "la-vie-est-chere"];
const TYPES = ["play", "download"];

export default async (req) => {
  const store = getStore("compteurs-maquettes");
  if (req.method === "GET") {
    const out = {};
    for (const t of TITRES) {
      out[t] = {};
      for (const k of TYPES) out[t][k] = Number((await store.get(`${t}:${k}`)) || 0);
    }
    return Response.json(out, { headers: { "cache-control": "no-store" } });
  }
  if (req.method === "POST") {
    const { slug, type } = await req.json().catch(() => ({}));
    if (!TITRES.includes(slug) || !TYPES.includes(type)) return new Response("Bad request", { status: 400 });
    const key = `${slug}:${type}`;
    const n = Number((await store.get(key)) || 0) + 1;
    await store.set(key, String(n));
    return Response.json({ slug, type, n });
  }
  return new Response("Method not allowed", { status: 405 });
};

export const config = { path: "/api/compteur" };
