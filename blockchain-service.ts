import { coins, transactions, blocks } from '@shared/schema';
export interface BlockchainService {
  getTransactionsByAddress: (minConf: number, addr: string) => Promise<any[]>;
  getUTXOs: (minConf: number, addr: string) => Promise<any[]>;
  getAddressBalance: (addr: string) => Promise<string>;
  // ... other methods
}

// Infer Insert types from schema
type InsertCoin = typeof coins.$inferInsert;
type InsertTransaction = typeof transactions.$inferInsert;
type InsertBlock = typeof blocks.$inferInsert;

// Infer Select types (for return values)
type Coin = typeof coins.$inferSelect;
type Transaction = typeof transactions.$inferSelect;
type Block = typeof blocks.$inferSelect;

// Import your storage/database service
// TODO: Update this path to match your actual storage service location
import { storage } from './storage'; // Adjust path as needed

interface CoinGeckoPriceData {
  [key: string]: {
    usd?: number;
    usd_24h_change?: number;
    usd_market_cap?: number;
  };
}

interface BlockchainDataFetcher {
  fetchCoinData(): Promise<Partial<InsertCoin>>;
  fetchTransactions(limit?: number): Promise<InsertTransaction[]>;
  fetchBlocks(limit?: number): Promise<InsertBlock[]>;
}

// Helper function to create a chainId from symbol
function getChainIdFromSymbol(symbol: string): number {
  const chainIds: Record<string, number> = {
    'DOGE': 1,
    'LTC': 2,
    'DGB': 3,
    'LKY': 4,
    'PEPE': 5,
    'BONK': 6,
    'BELLS': 7,
    'SHIC': 8,
    'CAT': 9
  };
  return chainIds[symbol] || 0;
}

// Helper to fetch price data from CoinGecko for any coin
async function fetchPriceData(symbol: string): Promise<{ price: string; priceChange24h: string; marketCap: string; volume24h: string }> {
  try {
    const coinIdMap: Record<string, string> = {
      'DOGE': 'dogecoin',
      'LTC': 'litecoin',
      'DGB': 'digibyte',
      // Add mappings for others as needed; fallback to symbol for generic
    };
    const coinId = coinIdMap[symbol] || symbol.toLowerCase();
    const response = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd&include_24hr_change=true&include_market_cap=true&include_24hr_vol=true`);
    const data: CoinGeckoPriceData = await response.json();
    const priceData = data[coinId];
    if (priceData) {
      return {
        price: priceData.usd?.toFixed(8) || '0.00000000',
        priceChange24h: (priceData.usd_24h_change || 0).toFixed(2),
        marketCap: (priceData.usd_market_cap || 0).toFixed(2),
        volume24h: (priceData.usd_market_cap || 0).toFixed(2), // Approximate with market cap if no vol
      };
    }
  } catch (error) {
    console.error(`Price fetch error for ${symbol}:`, error);
  }
  return { price: '0.00000000', priceChange24h: '0.00', marketCap: '0', volume24h: '0' };
}

// Dogecoin Data Fetcher (Blockchair API - more reliable)
class DogecoinFetcher implements BlockchainDataFetcher {
  private readonly baseUrl = 'https://api.blockchair.com/dogecoin';
  private readonly symbol = 'DOGE';

  async fetchCoinData(): Promise<Partial<InsertCoin>> {
    try {
      const [statsResponse, priceData] = await Promise.all([
        fetch(`${this.baseUrl}/stats`),
        fetchPriceData(this.symbol)
      ]);
      const stats: any = await statsResponse.json();
      const chainData = stats.data;

      return {
        symbol: this.symbol,
        name: 'Dogecoin',
        chainId: getChainIdFromSymbol(this.symbol),
        price: priceData.price,
        priceChange24h: priceData.priceChange24h,
        marketCap: priceData.marketCap,
        volume24h: priceData.volume24h,
        blockHeight: chainData.blocks,
        blockTime: '72.00',
        totalSupply: '142100000000.00000000',
        circulatingSupply: '142100000000.00000000',
        hashRate: `${chainData.hashrate} TH/s`,
        difficulty: `${chainData.difficulty}M`,
        decimals: 8,
        isActive: true,
        metadata: JSON.stringify({}),
        networkMagic: 0xd9b4bef9,
        pubKeyHash: 0x76a914,
        supportsScrypt: false,
      };
    } catch (error) {
      console.error('Dogecoin fetch error:', error);
      const priceData = await fetchPriceData(this.symbol);
      return { 
        symbol: this.symbol, 
        name: 'Dogecoin',
        chainId: getChainIdFromSymbol(this.symbol),
        price: priceData.price,
        priceChange24h: priceData.priceChange24h,
        marketCap: priceData.marketCap,
        volume24h: priceData.volume24h,
        decimals: 8,
        isActive: true,
        metadata: JSON.stringify({}),
        networkMagic: 0xd9b4bef9,
        pubKeyHash: 0x76a914,
        supportsScrypt: false,
      };
    }
  }

  async fetchTransactions(limit = 10): Promise<InsertTransaction[]> {
    try {
      const response = await fetch(`${this.baseUrl}/mempool/transactions`);
      const data: any = await response.json();
      
      const txs = data.data || [];
      if (!Array.isArray(txs)) {
        console.warn('Dogecoin API returned non-array transactions data');
        return [];
      }
      
      return txs.slice(0, limit).map((tx: any) => ({
        txId: tx.hash,
        chainId: getChainIdFromSymbol(this.symbol),
        amount: BigInt(tx.output_total || 0),
        fee: BigInt(tx.fee || 0),
        timestamp: new Date(tx.time * 1000),
        fromAddress: tx.input_addresses?.[0] || 'Unknown',
        toAddress: tx.output_addresses?.[0] || 'Multiple outputs',
        blockHeight: tx.block_id || 0,
        confirmations: 0,
        category: 'transfer',
        status: 'pending',
      }));
    } catch (error) {
      console.error('Dogecoin transactions fetch error:', error);
      return [];
    }
  }

  async fetchBlocks(limit = 10): Promise<InsertBlock[]> {
    try {
      const response = await fetch(`${this.baseUrl}/blocks?limit=${limit}&sort=height:desc`);
      const data: any = await response.json();
      
      const blockData = data.data || [];
      if (!Array.isArray(blockData)) {
        console.warn('Dogecoin API returned non-array blocks data');
        return [];
      }
      
      return blockData.map((block: any) => ({
        hash: block.hash,
        chainId: getChainIdFromSymbol(this.symbol),
        height: block.id,
        timestamp: new Date(block.time * 1000),
        txCount: block.transaction_count,
        size: block.size,
        difficulty: block.difficulty.toString(),
        nonce: block.nonce.toString(),
        previousHash: block.prev_hash,
        confirmations: 0, // Will be updated later
      }));
    } catch (error) {
      console.error('Dogecoin blocks fetch error:', error);
      return [];
    }
  }
}

// Litecoin Data Fetcher (litecoinspace.org API)
class LitecoinFetcher implements BlockchainDataFetcher {
  private readonly baseUrl = 'https://litecoinspace.org/api';
  private readonly symbol = 'LTC';

  async fetchCoinData(): Promise<Partial<InsertCoin>> {
    try {
      const [heightResponse, priceData] = await Promise.all([
        fetch(`${this.baseUrl}/blocks/tip/height`),
        fetchPriceData(this.symbol)
      ]);
      const blockHeight = parseInt(await heightResponse.text(), 10);

      return {
        symbol: this.symbol,
        name: 'Litecoin',
        chainId: getChainIdFromSymbol(this.symbol),
        price: priceData.price,
        priceChange24h: priceData.priceChange24h,
        marketCap: priceData.marketCap,
        volume24h: priceData.volume24h,
        blockHeight,
        blockTime: '150.00',
        totalSupply: '84000000.00000000',
        circulatingSupply: '74000000.00000000',
        hashRate: '450.0 TH/s', // Static or fetch if available
        difficulty: '25.0M',
        decimals: 8,
        isActive: true,
        metadata: JSON.stringify({}),
        networkMagic: 0xfbc0b6db,
        pubKeyHash: 0x30,
        supportsScrypt: true,
      };
    } catch (error) {
      console.error('Litecoin fetch error:', error);
      const priceData = await fetchPriceData(this.symbol);
      return { 
        symbol: this.symbol, 
        name: 'Litecoin',
        chainId: getChainIdFromSymbol(this.symbol),
        price: priceData.price,
        priceChange24h: priceData.priceChange24h,
        marketCap: priceData.marketCap,
        volume24h: priceData.volume24h,
        decimals: 8,
        isActive: true,
        metadata: JSON.stringify({}),
        networkMagic: 0xfbc0b6db,
        pubKeyHash: 0x30,
        supportsScrypt: true,
      };
    }
  }

  async fetchTransactions(limit = 10): Promise<InsertTransaction[]> {
    try {
      const response = await fetch(`${this.baseUrl}/mempool`);
      const data: any = await response.json();
      
      // Handle case where data might not be an array
      const txArray = Array.isArray(data) ? data : [];
      
      return txArray.slice(0, limit).map((tx: any, index: number) => ({
        txId: tx.txid || `ltc_tx_${index}`,
        chainId: getChainIdFromSymbol(this.symbol),
        amount: BigInt((tx.vout?.[0]?.value || 0) * 100000000), // Assume satoshis
        fee: BigInt(tx.fee || 0),
        timestamp: new Date(),
        fromAddress: tx.vin?.[0]?.prevout?.scriptpubkey_address || 'Unknown',
        toAddress: tx.vout?.[0]?.scriptpubkey_address || 'Multiple outputs',
        blockHeight: 0,
        confirmations: 0,
        category: 'transfer',
        status: 'pending',
      }));
    } catch (error) {
      console.error('Litecoin transactions fetch error:', error);
      return [];
    }
  }

  async fetchBlocks(limit = 10): Promise<InsertBlock[]> {
    try {
      const response = await fetch(`${this.baseUrl}/blocks`);
      const blockData: any = await response.json();
      
      if (!Array.isArray(blockData)) {
        console.warn('Litecoin API returned non-array blocks data');
        return [];
      }
      
      return blockData.slice(0, limit).map((block: any) => ({
        hash: block.id,
        chainId: getChainIdFromSymbol(this.symbol),
        height: block.height,
        timestamp: new Date(block.timestamp * 1000),
        txCount: block.tx_count,
        size: block.size,
        difficulty: block.difficulty?.toString() || '0',
        nonce: block.nonce?.toString() || '0',
        previousHash: block.prev_hash || '',
        confirmations: 0,
      }));
    } catch (error) {
      console.error('Litecoin blocks fetch error:', error);
      return [];
    }
  }
}

// Generic fetcher for other cryptocurrencies (mock data)
class GenericCryptoFetcher implements BlockchainDataFetcher {
  constructor(
    private symbol: string,
    private name: string,
    private blockTime: string = '60'
  ) {}

  async fetchCoinData(): Promise<Partial<InsertCoin>> {
    const priceData = await fetchPriceData(this.symbol);
    return {
      symbol: this.symbol,
      name: this.name,
      chainId: getChainIdFromSymbol(this.symbol),
      price: priceData.price,
      priceChange24h: priceData.priceChange24h,
      marketCap: priceData.marketCap,
      volume24h: priceData.volume24h,
      blockHeight: Math.floor(Math.random() * 10000000),
      blockTime: this.blockTime,
      totalSupply: '21000000.00000000',
      circulatingSupply: '18000000.00000000',
      hashRate: '100.0 TH/s',
      difficulty: '1.0M',
      decimals: 8,
      isActive: true,
      metadata: JSON.stringify({}),
      networkMagic: 0xd9b4bef9, // Default
      pubKeyHash: 0x1e, // Default
      supportsScrypt: true,
    };
  }

  async fetchTransactions(limit = 10): Promise<InsertTransaction[]> {
    const transactions: InsertTransaction[] = [];
    for (let i = 0; i < limit; i++) {
      transactions.push({
        txId: `${this.symbol.toLowerCase()}_tx_${Math.random().toString(36).substring(2, 15)}`,
        chainId: getChainIdFromSymbol(this.symbol),
        amount: BigInt(Math.floor(Math.random() * 100000000)),
        fee: BigInt(Math.floor(Math.random() * 10000)),
        timestamp: new Date(Date.now() - (i * 60000)),
        fromAddress: `${this.symbol}_addr_from_${Math.random().toString(36).substring(2, 10)}`,
        toAddress: `${this.symbol}_addr_to_${Math.random().toString(36).substring(2, 10)}`,
        blockHeight: Math.floor(Math.random() * 1000000),
        confirmations: Math.floor(Math.random() * 100),
        category: 'transfer',
        status: 'confirmed',
      });
    }
    return transactions;
  }

  async fetchBlocks(limit = 10): Promise<InsertBlock[]> {
    const blocks: InsertBlock[] = [];
    const currentHeight = Math.floor(Math.random() * 1000000) + 500000;
    
    for (let i = 0; i < limit; i++) {
      blocks.push({
        hash: `${this.symbol.toLowerCase()}_block_${Math.random().toString(36).substring(2, 15)}`,
        chainId: getChainIdFromSymbol(this.symbol),
        height: currentHeight - i,
        timestamp: new Date(Date.now() - (i * parseInt(this.blockTime) * 1000)),
        size: Math.floor(Math.random() * 1500) + 500,
        txCount: Math.floor(Math.random() * 150) + 10,
        difficulty: (Math.random() * 10 + 1).toFixed(1) + 'M',
        nonce: Math.random().toString(36).substring(2, 15),
        previousHash: `${this.symbol.toLowerCase()}_prev_${Math.random().toString(36).substring(2, 10)}`,
        confirmations: Math.floor(Math.random() * 100),
      });
    }
    return blocks;
  }
}

// Blockchain Service Manager
export class BlockchainService {
  private fetchers: Map<string, BlockchainDataFetcher> = new Map();
  private updateInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.initializeFetchers();
  }

  private initializeFetchers() {
    this.fetchers.set('DOGE', new DogecoinFetcher());
    this.fetchers.set('LTC', new LitecoinFetcher());
    this.fetchers.set('DGB', new GenericCryptoFetcher('DGB', 'DigiByte', '15'));
    this.fetchers.set('LKY', new GenericCryptoFetcher('LKY', 'Luckycoin', '60'));
    this.fetchers.set('PEPE', new GenericCryptoFetcher('PEPE', 'Pepecoin', '30'));
    this.fetchers.set('BONK', new GenericCryptoFetcher('BONK', 'Bonkcoin', '45'));
    this.fetchers.set('BELLS', new GenericCryptoFetcher('BELLS', 'Bellscoin', '60'));
    this.fetchers.set('SHIC', new GenericCryptoFetcher('SHIC', 'Shibacoin', '90'));
    this.fetchers.set('CAT', new GenericCryptoFetcher('CAT', 'Catcoin', '60'));
  }

  async updateAllCoinData(): Promise<void> {
    console.log('Starting blockchain data update...');
    
    const symbols = Array.from(this.fetchers.keys());
    
    for (const symbol of symbols) {
      const fetcher = this.fetchers.get(symbol);
      if (!fetcher) continue;
      
      try {
        // Update coin data
        const coinData = await fetcher.fetchCoinData();
        if (coinData.symbol && coinData.chainId !== undefined) {  // Guard required fields
          await storage.upsertCoin(coinData as InsertCoin);
        }

        // Update transactions (limit to prevent database overflow)
        const transactions = await fetcher.fetchTransactions(5);
        for (const tx of transactions) {
          try {
            await storage.createTransaction(tx);
          } catch (error: unknown) {
            if (error instanceof Error && !error.message.includes('UNIQUE constraint failed')) {
              console.error(`Failed to create transaction for ${symbol}:`, error);
            }
          }
        }

        // Update blocks (limit to prevent database overflow)
        const blocks = await fetcher.fetchBlocks(3);
        for (const block of blocks) {
          try {
            await storage.createBlock(block);
          } catch (error: unknown) {
            if (error instanceof Error && !error.message.includes('UNIQUE constraint failed')) {
              console.error(`Failed to create block for ${symbol}:`, error);
            }
          }
        }

        console.log(`Updated ${symbol} data successfully`);
      } catch (error) {
        console.error(`Failed to update ${symbol} data:`, error);
      }
    }
    
    console.log('Blockchain data update completed');
  }

  startPeriodicUpdates(intervalMinutes = 2): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }

    // Initial update
    this.updateAllCoinData();

    // Set up periodic updates
    this.updateInterval = setInterval(() => {
      this.updateAllCoinData();
    }, intervalMinutes * 60 * 1000);

    console.log(`Started periodic blockchain updates every ${intervalMinutes} minutes`);
  }

  stopPeriodicUpdates(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
      console.log('Stopped periodic blockchain updates');
    }
  }

  async getCoinData(symbol: string): Promise<Coin | undefined> {
    return await storage.getCoin(symbol);
  }

  async getTransactions(symbol: string, limit = 10): Promise<Transaction[]> {
    return await storage.getTransactionsByCoin(symbol, limit);
  }

  async getBlocks(symbol: string, limit = 10): Promise<Block[]> {
    return await storage.getBlocksByCoin(symbol, limit);
  }
}

export const blockchainService = new BlockchainService();