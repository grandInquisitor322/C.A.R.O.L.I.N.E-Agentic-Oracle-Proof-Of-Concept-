// server/routes.ts
import { ChainId, ChainConfig, getChainConfig, CHAIN_CONFIGS } from '../ChainConfig20';
import { Router } from 'express';
import fetch from 'node-fetch';
import type { Express } from "express";
import { Request, Response } from 'express';
import { createServer, type Server } from "http";
import { storage, searchByHash, TransactionRow, getAllCoins } from './storageadapter';
import { blockchainService } from "./blockchain-service";
export type { Transaction, Block } from "@shared/schema";

const router = Router();

// Simple in-memory cache for proxy responses
type CacheEntry<T = unknown> = {
  expiresAt: number;
  data: T;
};

const proxyCache = new Map<string, CacheEntry>();

function getCached<T>(key: string): T | null {
  const entry = proxyCache.get(key) as CacheEntry<T> | undefined;
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    proxyCache.delete(key);
    return null;
  }
  return entry.data;
}

function setCached<T>(key: string, data: T, ttlMs: number) {
  proxyCache.set(key, { data, expiresAt: Date.now() + ttlMs });
}

export { router as apiRouter };

// Health route
router.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy' });
});

// --- Backend proxy with caching for public APIs ---

// Proxy to CoinGecko simple price endpoint with short TTL caching
router.get('/proxy/coingecko/simple-price', async (req: Request, res: Response) => {
  try {
    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(req.query)) {
      if (typeof value === 'string') {
        searchParams.append(key, value);
      }
    }

    const upstreamUrl = `https://api.coingecko.com/api/v3/simple/price?${searchParams.toString()}`;
    const cacheKey = `coingecko:simple-price:${searchParams.toString()}`;

    const cached = getCached<unknown>(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const upstreamRes = await fetch(upstreamUrl);
    if (!upstreamRes.ok) {
      return res.status(upstreamRes.status).json({ error: 'Upstream error from CoinGecko' });
    }

    const json = await upstreamRes.json();

    // Cache for 60 seconds
    setCached(cacheKey, json, 60_000);
    res.json(json);
  } catch (error) {
    console.error('[PROXY simple-price] error', error);
    res.status(500).json({ error: 'Failed to proxy simple price request' });
  }
});

// Proxy to CoinGecko coins list with longer TTL caching
router.get('/proxy/coingecko/coins-list', async (_req: Request, res: Response) => {
  try {
    const upstreamUrl = 'https://api.coingecko.com/api/v3/coins/list';
    const cacheKey = 'coingecko:coins-list';

    const cached = getCached<unknown>(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const upstreamRes = await fetch(upstreamUrl);
    if (!upstreamRes.ok) {
      return res.status(upstreamRes.status).json({ error: 'Upstream error from CoinGecko' });
    }

    const json = await upstreamRes.json();

    // Cache for 10 minutes
    setCached(cacheKey, json, 10 * 60_000);
    res.json(json);
  } catch (error) {
    console.error('[PROXY coins-list] error', error);
    res.status(500).json({ error: 'Failed to proxy coins list request' });
  }
});

// Balance route
router.get('/balance/:address', async (req: Request, res: Response) => {
  const { address } = req.params;

  // Get chainId from query param or default to 1
  const chainIdRaw = req.query.chainId ? Number(req.query.chainId) : 1;

  if (isNaN(chainIdRaw) || chainIdRaw <= 0) {
    return res.status(400).json({ error: "Invalid chainId (must be positive integer)" });
  }

  const chainId = chainIdRaw as unknown as ChainId; // safe cast after validation

  console.log('[DEBUG BALANCE] Address requested:', address);
  console.log('[DEBUG BALANCE] Using chainId:', chainId);

  try {
    let balance: string = '0';

    if (storage && 'getAddressBalance' in storage) {
      console.log('[DEBUG BALANCE] getAddressBalance exists');
      
      // Correct call: chainId first, address second
      balance = await storage.getAddressBalance(chainId, address);
      
      console.log('[DEBUG BALANCE] Balance fetched:', balance);
    } else {
      console.log('[DEBUG BALANCE] getAddressBalance NOT found in storage');
    }

    res.status(200).json({ balance });
  } catch (error) {
    console.error('[BALANCE ROUTE ERROR]', error);
    res.status(500).json({
      error: 'Failed to fetch balance',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

// Transactions route
router.get('/transactions/:address', async (req: Request, res: Response) => {
  const { address } = req.params;

  // Get chainId from query param or default to 1
  const chainIdRaw = req.query.chainId ? Number(req.query.chainId) : 1;

  if (isNaN(chainIdRaw) || chainIdRaw <= 0) {
    return res.status(400).json({ error: "Invalid chainId (must be positive integer)" });
  }

  const chainId = chainIdRaw as unknown as ChainId; // safe cast after validation

  try {
    const txs = await storage.getTransactionsByAddress(chainId, address);
    res.status(200).json(txs);
  } catch (error) {
    console.error("Error fetching transactions:", error);
    res.status(500).json({ error: "Failed to fetch transactions" });
  }
});

// UTXOs route (moved from registerRoutes)
router.get("/utxos/:address", async (req: Request, res: Response) => {
  const { address } = req.params;

  // Get chainId from query param or default to 1
  const chainIdRaw = req.query.chainId ? Number(req.query.chainId) : 1;

  if (isNaN(chainIdRaw) || chainIdRaw <= 0) {
    return res.status(400).json({ error: "Invalid chainId (must be positive integer)" });
  }

  const chainId = chainIdRaw as unknown as ChainId; // safe cast after validation

  try {
    const utxos = await storage.getUTXOs(chainId, address);
    res.status(200).json(utxos ?? []);
  } catch (error) {
    console.error("Error fetching UTXOs:", error);
    res.status(500).json({ error: "Failed to fetch UTXOs" });
  }
});

// Interfaces for API responses (keep as is)
interface LuckyscanTxResponse {
  txid?: string;
  hash?: string;
  version?: number;
  size?: number;
  vsize?: number;
  weight?: number;
  locktime?: number;
  fee?: number;
  status?: {
    confirmed?: boolean;
    block_height?: number;
    block_hash?: string;
    block_time?: number;
  };
  confirmations?: number;
  block_height?: number;
  block_hash?: string;
  block_time?: number;
  vin?: any[];
  vout?: any[];
}

interface BlockchairTxResponse {
  data: {
    [hash: string]: {
      transaction: {
        version?: number;
        size?: number;
        fee?: string;
        time?: number;
        block_id?: number;
      };
      inputs?: any[];
      outputs?: any[];
      block?: {
        hash?: string;
      };
    };
  };
}

interface SoChainTxResponse {
  status: string;
  data?: {
    version?: number;
    size?: number;
    fee?: string;
    confirmations?: number;
    block_no?: number;
    blockhash?: string;
    time?: number;
    inputs?: any[];
    outputs?: any[];
  };
}

interface DogechainTxResponse {
  success: number;
  transaction?: {
    block_hash?: string | null;
    confirmations?: number;
    fee?: string;
    hash?: string;
    locktime?: number;
    inputs?: any[];
    outputs?: any[];
    outputs_n?: number;
    outputs_value?: string;
    size?: number;
    time?: number;
  };
}

interface LitecoinSpaceTxResponse {
  txid?: string;
  version?: number;
  size?: number;
  vsize?: number;
  weight?: number;
  locktime?: number;
  fee?: number;
  status?: {
    confirmed?: boolean;
    block_height?: number;
    block_hash?: string;
    block_time?: number;
  };
  vin?: any[];
  vout?: any[];
}

interface DogechainBlockResponse {
  success: number;
  block?: {
    hash?: string;
    height?: number;
    time?: number;
    txs?: any[];
    size?: number;
    difficulty?: string;
    nonce?: string;
  };
}

interface SoChainAddressResponse {
  status: string;
  data?: {
    confirmed_balance?: string;
    unconfirmed_balance?: string;
    total_balance?: string;
    total_txs?: number;
  };
}

// Get all supported coins (moved from registerRoutes)
router.get("/coins", async (req, res) => {
  try {
    const coins = await getAllCoins();
    res.json(coins);
  } catch (error) {
    console.error("Error fetching coins:", error);
    res.status(500).json({ error: "Failed to fetch coins" });
  }
});

// Get specific coin data (moved from registerRoutes)
router.get("/coins/:symbol", async (req, res) => {
  try {
    const { symbol } = req.params;
    const coin = await blockchainService.getCoinData(symbol.toUpperCase());

    if (!coin) {
      return res.status(404).json({ error: "Coin not found" });
    }

    res.json(coin);
  } catch (error) {
    console.error("Error fetching coin:", error);
    res.status(500).json({ error: "Failed to fetch coin data" });
  }
});

// Get latest transactions for a coin (moved from registerRoutes)
router.get("/coins/:symbol/transactions", async (req, res) => {
  try {
    const { symbol } = req.params;
    const limit = parseInt(req.query.limit as string) || 10;

    const transactions = await blockchainService.getTransactions(symbol.toUpperCase(), limit);
    res.json(transactions);
  } catch (error) {
    console.error("Error fetching transactions:", error);
    res.status(500).json({ error: "Failed to fetch transactions" });
  }
});

// Get latest blocks for a coin (moved from registerRoutes)
router.get("/coins/:symbol/blocks", async (req, res) => {
  try {
    const { symbol } = req.params;
    const limit = parseInt(req.query.limit as string) || 10;

    const blocks = await blockchainService.getBlocks(symbol.toUpperCase(), limit);
    res.json(blocks);
  } catch (error) {
    console.error("Error fetching blocks:", error);
    res.status(500).json({ error: "Failed to fetch blocks" });
  }
});

// Search endpoint (moved from registerRoutes)
router.get("/search", async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || typeof q !== 'string') {
      return res.status(400).json({ error: "Query parameter 'q' is required" });
    }

    const searchQuery = q.trim();

    const results = await searchByHash(searchQuery);

    res.json(results);
  } catch (error) {
    console.error("Search error:", error);
    res.status(500).json({ error: "Search failed" });
  }
});

// CoinGecko API integration for enhanced price data (moved from registerRoutes)
router.get("/coingecko/price/:coinId", async (req, res) => {
  try {
    const { coinId } = req.params;

    const response = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd&include_24hr_change=true&include_market_cap=true&include_24hr_vol=true`
    );

    if (!response.ok) {
      throw new Error(`CoinGecko API error: ${response.status}`);
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error("CoinGecko price API error:", error);
    res.status(500).json({ error: "Failed to fetch CoinGecko price data" });
  }
});

// GeckoTerminal API for DEX data (moved from registerRoutes)
router.get("/geckoterminal/pools/:network/:address", async (req, res) => {
  try {
    const { network, address } = req.params;

    const response = await fetch(
      `https://api.geckoterminal.com/api/v2/networks/${network}/pools/${address}`
    );

    if (!response.ok) {
      throw new Error(`GeckoTerminal API error: ${response.status}`);
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error("GeckoTerminal API error:", error);
    res.status(500).json({ error: "Failed to fetch GeckoTerminal data" });
  }
});

// External API proxy endpoints to avoid CORS issues (moved from registerRoutes)

router.get("/external/dogecoin/*endpoint", async (req: Request<{ endpoint?: string[] }>, res: Response) => {
  try {
    const segments = req.params.endpoint ?? []; 
    const endpointPath = segments.join("/") || "";

    const apiKey = process.env.CHAIN_SO_API_KEY || process.env.API_KEY || "";

    const response = await fetch(`https://chain.so/api/v3/${endpointPath}`, {
      headers: {
        "API-KEY": apiKey,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error("Dogecoin API error:", error);
    res.status(500).json({ error: "Failed to fetch Dogecoin data" });
  }
});

router.get("/external/litecoin/*endpoint", async (req: Request<{ endpoint?: string[] }>, res: Response) => {
  try {
    const segments = req.params.endpoint ?? [];

    const endpointPath = segments.join("/") || "";

    const response = await fetch(`https://litecoinspace.org/api/${endpointPath}`);

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error("Litecoin API error:", error);
    res.status(500).json({ error: "Failed to fetch Litecoin data" });
  }
});

router.get("/external/digibyte-pool/*endpoint", async (req: Request<{ endpoint?: string[] }>, res: Response) => {
  try {
    const segments = req.params.endpoint ?? [];  // string[] | undefined → empty array fallback
    const endpointPath = segments.join('/') || '';

    const response = await fetch(`https://digihash.digibyte.io/api/${endpointPath}`);

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error("Digibyte Pool API error:", error);
    res.status(500).json({ error: "Failed to fetch Digibyte Pool data" });
  }
});

// Proxy Digibyte Pool API (digihash.digibyte.io) - if duplicate, keep one
router.get("/external/digibyte-pool/*endpoint", async (req: Request<{ endpoint?: string[] }>, res: Response) => {
  try {
    const segments = req.params.endpoint ?? [];  // string[] | undefined → empty array fallback
    const endpointPath = segments.join('/') || '';

    const response = await fetch(`https://digihash.digibyte.io/api/${endpointPath}`);

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error("Digibyte Pool API error:", error);
    res.status(500).json({ error: "Failed to fetch Digibyte Pool data" });
  }
});

// registerRoutes (minimal - just start updates and return server)
export async function registerRoutes(app: Express): Promise<Server> {
  blockchainService.startPeriodicUpdates(5); // Update every 5 minutes to avoid rate limits
  const server = createServer(app);
  return server;
}

export default router;