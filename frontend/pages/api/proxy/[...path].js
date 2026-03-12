import { Readable } from "stream";

export default async function handler(req, res) {
  const base = process.env.API_BASE || process.env.NEXT_PUBLIC_API_BASE;
  const token = process.env.API_TOKEN;
  if (!base) {
    return res.status(500).json({ error: "API_BASE missing" });
  }
  if (!token) {
    return res.status(500).json({ error: "API_TOKEN missing" });
  }

  const targetPath = Array.isArray(req.query.path)
    ? req.query.path.join("/")
    : req.query.path || "";
  const url = new URL(`${base.replace(/\\/$/, "")}/${targetPath}`);
  for (const [key, value] of Object.entries(req.query)) {
    if (key === "path") continue;
    if (Array.isArray(value)) {
      value.forEach((v) => url.searchParams.append(key, v));
    } else if (typeof value === "string") {
      url.searchParams.append(key, value);
    }
  }

  const headers = {};
  if (req.headers.cookie) headers.cookie = req.headers.cookie;
  if (req.headers["content-type"]) headers["content-type"] = req.headers["content-type"];
  if (req.headers["content-length"]) headers["content-length"] = req.headers["content-length"];
  if (req.headers.accept) headers.accept = req.headers.accept;
  headers["x-api-token"] = token;

  const canHaveBody = !["GET", "HEAD"].includes(req.method);
  const response = await fetch(url, {
    method: req.method,
    headers,
    body: canHaveBody ? req : undefined,
    duplex: canHaveBody ? "half" : undefined
  });

  res.status(response.status);
  const setCookie = response.headers.get("set-cookie");
  if (setCookie) res.setHeader("set-cookie", setCookie);
  const contentType = response.headers.get("content-type");
  if (contentType) res.setHeader("content-type", contentType);
  const contentLength = response.headers.get("content-length");
  if (contentLength) res.setHeader("content-length", contentLength);
  const disposition = response.headers.get("content-disposition");
  if (disposition) res.setHeader("content-disposition", disposition);

  if (!response.body) {
    return res.end();
  }
  Readable.fromWeb(response.body).pipe(res);
}

export const config = {
  api: {
    bodyParser: false,
    responseLimit: false
  }
};
