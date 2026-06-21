"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const axios_1 = __importDefault(require("axios"));
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3000;
const CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes
const cache = new Map();
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
app.all('/{*splat}', async (req, res) => {
    var _a, _b, _c, _d;
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
        ? `?${new URLSearchParams(req.query).toString()}`
        : '';
    const targetURL = `${recipientURL}${targetPath}${queryString}`;
    // Cache logic: only cache GET requests to the product service (getProductsList)
    const isProductListRequest = req.method === 'GET' &&
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
        const response = await (0, axios_1.default)({
            method: req.method,
            url: targetURL,
            headers: Object.assign(Object.assign({}, req.headers), { host: undefined }),
            data: ['GET', 'HEAD'].includes(req.method) ? undefined : req.body,
            validateStatus: () => true, // pass all status codes through
        });
        if (isProductListRequest) {
            cache.set(targetURL, {
                data: response.data,
                status: response.status,
                headers: response.headers,
                expiresAt: Date.now() + CACHE_TTL_MS,
            });
        }
        res.status(response.status).json(response.data);
    }
    catch (err) {
        const axiosErr = err;
        const status = (_b = (_a = axiosErr.response) === null || _a === void 0 ? void 0 : _a.status) !== null && _b !== void 0 ? _b : 502;
        const data = (_d = (_c = axiosErr.response) === null || _c === void 0 ? void 0 : _c.data) !== null && _d !== void 0 ? _d : { error: 'Cannot process request' };
        res.status(status).json(data);
    }
});
app.listen(PORT, () => {
    console.log(`BFF Service is running on port ${PORT}`);
});
