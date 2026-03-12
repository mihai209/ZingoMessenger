export default async function handler(req, res) {
  const base = process.env.API_BASE || process.env.NEXT_PUBLIC_API_BASE;
  const token = process.env.API_TOKEN;
  if (!base) {
    res.status(500).end("API_BASE missing");
    return;
  }
  if (!token) {
    res.status(500).end("API_TOKEN missing");
    return;
  }

  const url = new URL(`${base.replace(/\\/$/, "")}/events`);
  const headers = {
    accept: "text/event-stream",
    "x-api-token": token
  };
  if (req.headers.cookie) headers.cookie = req.headers.cookie;

  const upstream = await fetch(url, { headers });
  res.status(upstream.status);
  res.setHeader("content-type", "text/event-stream");
  res.setHeader("cache-control", "no-cache");
  res.setHeader("connection", "keep-alive");

  const reader = upstream.body?.getReader();
  if (!reader) {
    res.end();
    return;
  }

  const encoder = new TextEncoder();
  const pump = async () => {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(encoder.decode(value));
    }
    res.end();
  };
  pump();
}

export const config = {
  api: {
    bodyParser: false,
    responseLimit: false
  }
};
