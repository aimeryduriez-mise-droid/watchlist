const URL   = process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const KEY   = "watchlist";

async function redis(args) {
  const r = await fetch(URL + "/" + args.map(encodeURIComponent).join("/"), {
    headers: { Authorization: "Bearer " + TOKEN }
  });
  return r.json();
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  if (req.method === "GET") {
    const data = await redis(["GET", KEY]);
    const list = data.result ? JSON.parse(data.result) : [];
    return res.status(200).json(list);
  }

  if (req.method === "POST") {
    const list = req.body;
    await redis(["SET", KEY, JSON.stringify(list)]);
    return res.status(200).json({ ok: true });
  }

  res.status(405).end();
}
