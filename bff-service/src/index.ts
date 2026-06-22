import 'dotenv/config';
import http, { IncomingMessage, ServerResponse } from 'node:http';

const PORT = Number(process.env.PORT) || 3000;
const CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes

interface CacheEntry {
  data: string;
  status: number;
  contentType: string;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Uint8Array[] = [];
    req.on('data', (chunk: Uint8Array) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString()));
    req.on('error', reject);
  });
}

const server = http.createServer(async (req: IncomingMessage, res: ServerResponse) => {
  const url = new URL(req.url ?? '/', `http://localhost`);
  const [, serviceName, ...restSegments] = url.pathname.split('/');

  if (!serviceName) {
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Cannot process request' }));
    return;
  }

  const recipientURL = process.env[serviceName.toUpperCase()];

  if (!recipientURL) {
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Cannot process request' }));
    return;
  }

  const targetPath = restSegments.length ? `/${restSegments.join('/')}` : '';
  const targetURL = `${recipientURL}${targetPath}${url.search}`;

  // Cache: only GET /product/products
  const isProductListRequest =
    req.method === 'GET' &&
    serviceName.toUpperCase() === 'PRODUCT' &&
    (restSegments.length === 0 || restSegments.join('/') === 'products');

  if (isProductListRequest) {
    const cached = cache.get(targetURL);
    if (cached && Date.now() < cached.expiresAt) {
      res.writeHead(cached.status, { 'Content-Type': cached.contentType });
      res.end(cached.data);
      return;
    }
  }

  try {
    const body = ['GET', 'HEAD'].includes(req.method ?? '') ? undefined : await readBody(req);

    const HOP_BY_HOP = new Set(['host', 'connection', 'keep-alive', 'transfer-encoding', 'te', 'trailers', 'upgrade', 'proxy-authorization', 'proxy-authenticate']);

    const forwardHeaders: Record<string, string> = {};
    for (const [key, value] of Object.entries(req.headers)) {
      if (!HOP_BY_HOP.has(key.toLowerCase()) && value !== undefined) {
        forwardHeaders[key] = Array.isArray(value) ? value.join(', ') : String(value);
      }
    }

    const response = await fetch(targetURL, {
      method: req.method,
      headers: forwardHeaders,
      body,
    });

    const responseText = await response.text();
    const contentType = response.headers.get('content-type') ?? 'application/json';

    if (isProductListRequest) {
      cache.set(targetURL, {
        data: responseText,
        status: response.status,
        contentType,
        expiresAt: Date.now() + CACHE_TTL_MS,
      });
    }

    res.writeHead(response.status, { 'Content-Type': contentType });
    res.end(responseText);
  } catch (err) {
    console.error('BFF proxy error:', err);
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Cannot process request' }));
  }
});

server.listen(PORT, () => {
  console.log(`BFF Service is running on port ${PORT}`);
});
