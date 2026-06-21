import 'dotenv/config';
import express, { Request, Response } from 'express';
import axios, { AxiosError } from 'axios';

const app = express();
const PORT = process.env.PORT || 3000;
const CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes

interface CacheEntry {
  data: unknown;
  status: number;
  headers: Record<string, string>;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.all('*', async (req: Request, res: Response) => {
  // Extract service name from the first path segment: /{serviceName}/rest/of/path
  const [, serviceName, ...restSegments] = req.path.split('/');

  if (!serviceName) {
    res.status(502).json({ error: 'Cannot process request' });
    return;
  }

  const recipientURL = process.env[serviceName.toUpperCase()];

  if (!recipientURL) {
    res.status(502).json({ error: 'Cannot process request' });
    return;
  }

  const targetPath = restSegments.length ? `/${restSegments.join('/')}` : '';
  const queryString = Object.keys(req.query).length
    ? `?${new URLSearchParams(req.query as Record<string, string>).toString()}`
    : '';
  const targetURL = `${recipientURL}${targetPath}${queryString}`;

  // Cache logic: only cache GET requests to the product service (getProductsList)
  const isProductListRequest =
    req.method === 'GET' &&
    serviceName.toUpperCase() === 'PRODUCT' &&
    restSegments.length === 0;

  if (isProductListRequest) {
    const cached = cache.get(targetURL);
    if (cached && Date.now() < cached.expiresAt) {
      res.set(cached.headers).status(cached.status).json(cached.data);
      return;
    }
  }

  try {
    const response = await axios({
      method: req.method,
      url: targetURL,
      headers: {
        ...req.headers,
        host: undefined,
      },
      data: ['GET', 'HEAD'].includes(req.method) ? undefined : req.body,
      validateStatus: () => true, // pass all status codes through
    });

    if (isProductListRequest) {
      cache.set(targetURL, {
        data: response.data,
        status: response.status,
        headers: response.headers as Record<string, string>,
        expiresAt: Date.now() + CACHE_TTL_MS,
      });
    }

    res.status(response.status).json(response.data);
  } catch (err) {
    const axiosErr = err as AxiosError;
    const status = axiosErr.response?.status ?? 502;
    const data = axiosErr.response?.data ?? { error: 'Cannot process request' };
    res.status(status).json(data);
  }
});

app.listen(PORT, () => {
  console.log(`BFF Service is running on port ${PORT}`);
});
