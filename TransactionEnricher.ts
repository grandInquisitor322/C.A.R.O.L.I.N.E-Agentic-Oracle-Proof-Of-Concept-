import { ChainId, getChainConfig } from './ChainConfig20';

export interface Transaction {
  hash?: string;
  chainId: ChainId;
  time?: number;
  amount: string; // string for satoshis/atoms
  fee: string;
  from: string;
  to: string;
  confirmations: number;
  blockHash?: string;
  blockHeight?: number;
  status?: string;
  category?: TransactionCategory;
  txId?: string;
  toAddress?: string;
  timestamp?: Date;
}

// In TransactionEnricher.ts
// FIXED: Removed partial interface; full EnrichedTransaction now properly extends Transaction with 'amount'
export interface EnrichedTransaction extends Transaction {
  // Additional metadata
  category?: TransactionCategory;
  tags?: string[];
  addressLabels?: {
    from?: string;
    to?: string;
  };
  riskScore?: number;
  estimatedValue?: {
    usd: string;
    timestamp: number;
  };
  // Pattern detection
  isLargeTransaction?: boolean;
  isSuspicious?: boolean;
  isExchange?: boolean;
  isMining?: boolean;
  // Additional context
  notes?: string;
  relatedAddresses?: string[];
  status?: string; // FIXED: Added optional status (e.g., 'pending', 'confirmed') for storageadapter compatibility
  txId?: string; // FIXED: Optional tx ID (alias for hash) for storage mapping
  toAddress?: string; // FIXED: Optional recipient address (alias for 'to') for storage mapping
  isConfirmed?: boolean;  // FIXED: Added optional isConfirmed for storageadapter enrichment (derived from confirmations)
}

export enum TransactionCategory {
  TRANSFER = 'transfer',
  MINING = 'mining',
  EXCHANGE = 'exchange',
  CONSOLIDATION = 'consolidation',
  DISTRIBUTION = 'distribution',
  UNKNOWN = 'unknown',
}

export interface AddressLabel {
  address: string;
  label: string;
  category?: string;
  chainId: ChainId;
}

export interface EnrichmentOptions {
  enablePriceEnrichment?: boolean;
  enablePatternDetection?: boolean;
  enableRiskAnalysis?: boolean;
  enableAddressLabeling?: boolean;
  largeTransactionThreshold?: number; // In whole coins (e.g., >10k DOGE)
}

export class TransactionEnricher {
  private knownAddresses: Map<string, AddressLabel> = new Map();
  private priceCache: Map<ChainId, { price: number; timestamp: number }> = new Map();
  private readonly PRICE_CACHE_TTL = 60000; // 1 minute

  constructor(private options: EnrichmentOptions = {}) {
    this.options = {
      enablePriceEnrichment: true,
      enablePatternDetection: true,
      enableRiskAnalysis: true,
      enableAddressLabeling: true,
      largeTransactionThreshold: 10000, // Default threshold in whole coins
      ...options,
    };

    this.initializeKnownAddresses();
  }

 
  public clearPriceCache(): void {
    this.priceCache.clear();
  }

  /**
   * Initialize known addresses (exchanges, mining pools, etc.)
   */
  private initializeKnownAddresses(): void {
    // Add known exchange addresses
    this.addAddressLabel({
      address: 'DQT4Ht3yE8CqN8jvgVR6rbLYqrSV5QRkfn',
      label: 'Binance Hot Wallet',
      category: 'exchange',
      chainId: ChainId.DOGECOIN,
    });

    // Add more known addresses as needed
    // This could be loaded from a database or external service
  }

  /**
   * Add a known address label
   */
  addAddressLabel(label: AddressLabel): void {
    const key = `${label.chainId}:${label.address}`;
    this.knownAddresses.set(key, label);
  }

  /**
   * Get address label if known
   */
  private getAddressLabel(address: string, chainId: ChainId): AddressLabel | undefined {
    const key = `${chainId}:${address}`;
    return this.knownAddresses.get(key);
  }

  /**
   * Enrich a single transaction
   */
  async enrichTransaction(tx: Transaction): Promise<EnrichedTransaction> {
    const enriched: EnrichedTransaction = { ...tx };

    // Add address labels
    if (this.options.enableAddressLabeling && tx.from) {
      const fromLabel = this.getAddressLabel(tx.from, tx.chainId);
      const toLabel = tx.to ? this.getAddressLabel(tx.to, tx.chainId) : undefined;

      if (fromLabel || toLabel) {
        enriched.addressLabels = {
          from: fromLabel?.label,
          to: toLabel?.label,
        };
      }
    }

    // Detect transaction category
    enriched.category = this.detectCategory(tx);

    // Pattern detection
    if (this.options.enablePatternDetection) {
      const patterns = this.detectPatterns(tx);
      enriched.isLargeTransaction = patterns.isLarge;
      enriched.isMining = patterns.isMining;
      enriched.isExchange = patterns.isExchange;
      enriched.tags = patterns.tags;
    }

    // Risk analysis
    if (this.options.enableRiskAnalysis) {
      enriched.riskScore = await this.calculateRiskScore(enriched);
      enriched.isSuspicious = enriched.riskScore > 70;
    }

    // Price enrichment
    if (this.options.enablePriceEnrichment) {
      enriched.estimatedValue = await this.estimateValue(tx);
    }

    return enriched;
  }

  /**
   * Enrich multiple transactions
   */
  async enrichTransactions(transactions: Transaction[]): Promise<EnrichedTransaction[]> {
    return Promise.all(transactions.map(tx => this.enrichTransaction(tx)));
  }

  /**
   * Detect transaction category
   */
  private detectCategory(tx: Transaction): TransactionCategory {
    // Mining/coinbase transactions (no from address or fee = 0)
    if (!tx.from || parseFloat(tx.fee) === 0) {
      return TransactionCategory.MINING;
    }

    // Check for known exchange addresses
    if (tx.from || tx.to) {
      const fromLabel = tx.from ? this.getAddressLabel(tx.from, tx.chainId) : undefined;
      const toLabel = tx.to ? this.getAddressLabel(tx.to, tx.chainId) : undefined;

      if (fromLabel?.category === 'exchange' || toLabel?.category === 'exchange') {
        return TransactionCategory.EXCHANGE;
      }
    }

    // Simple transfer
    return TransactionCategory.TRANSFER;
  }

  /**
   * Detect transaction patterns
   */
  private detectPatterns(tx: Transaction): {
    isLarge: boolean;
    isMining: boolean;
    isExchange: boolean;
    tags: string[];
  } {
    const tags: string[] = [];

    // FIXED: Normalize by decimals for chain-aware checks
    const chainConfig = getChainConfig(tx.chainId);
    const decimals = chainConfig.decimals;
    const amountNorm = parseFloat(tx.amount) / Math.pow(10, decimals); // Whole coins
    const feeNorm = parseFloat(tx.fee) / Math.pow(10, decimals); // Whole coins
    const threshold = this.options.largeTransactionThreshold || 10000; // Whole coins (e.g., >10k DOGE)

    // Large transaction detection (normalized)
    const isLarge = amountNorm > threshold;
    if (isLarge) {
      tags.push('large-transaction');
    }

    // Mining detection
    const isMining = !tx.from || tx.confirmations === 0 && parseFloat(tx.fee) === 0;
    if (isMining) {
      tags.push('mining');
      tags.push('coinbase');
    }

    // Exchange detection
    const fromLabel = tx.from ? this.getAddressLabel(tx.from, tx.chainId) : undefined;
    const toLabel = tx.to ? this.getAddressLabel(tx.to, tx.chainId) : undefined;
    const isExchange = fromLabel?.category === 'exchange' || toLabel?.category === 'exchange';
    if (isExchange) {
      tags.push('exchange');
    }

    // FIXED: Low fee detection (relative to amount, as absolute fails for satoshis)
    if (amountNorm > 0 && (feeNorm / amountNorm) < 0.001) { // <0.1% fee ratio
      tags.push('low-fee');
    }

    // High fee detection (relative to amount)
    if (amountNorm > 0) {
      const feePercentage = (feeNorm / amountNorm) * 100;
      if (feePercentage > 5) {
        tags.push('high-fee');
      }
    }

    return { isLarge, isMining, isExchange, tags };
  }

  /**
   * Calculate risk score (0-100)
   */
  private async calculateRiskScore(tx: EnrichedTransaction): Promise<number> {
    let score = 0;

    // Base risk factors
    const amount = parseFloat(tx.amount);
    const fee = parseFloat(tx.fee);

    // Large transactions increase risk slightly
    if (tx.isLargeTransaction) {
      score += 10;
    }

    // Unconfirmed transactions have higher risk
    if (!tx.confirmations || tx.confirmations < 6) {
      score += 20;
    }

    // Very low fees might indicate spam or attack
    if (fee > 0 && fee < 0.00001) {
      score += 15;
    }

    // Unknown addresses have moderate risk
    if (!tx.addressLabels?.from && !tx.addressLabels?.to) {
      score += 5;
    }

    // Mining transactions are generally safe
    if (tx.isMining) {
      score -= 10;
    }

    // Exchange transactions are generally safe
    if (tx.isExchange) {
      score -= 15;
    }

    // Ensure score is within bounds
    return Math.max(0, Math.min(100, score));
  }

  /**
   * Estimate USD value of transaction
   */
  private async estimateValue(tx: Transaction): Promise<{ usd: string; timestamp: number } | undefined> {
    const price = await this.getPrice(tx.chainId);
    if (!price) {
      return undefined; // Silently handle—no extra logging here
    }

    // FIXED: Fetch chain config for decimals normalization
    const chainConfig = getChainConfig(tx.chainId);
    const decimals = chainConfig.decimals;
    const amount = parseFloat(tx.amount) / Math.pow(10, decimals);
    const usdValue = amount * price.price;

    return {
      usd: usdValue.toFixed(2),
      timestamp: price.timestamp,
    };
  }

  /**
   * Get current price for a chain (with caching)
   * FIXED: Single body read via .text() + manual JSON.parse() to prevent double-consumption.
   * Updated: Dynamic coinId mapping for multi-chain; standardized TTL; optional bodyUsed safeguard.
   */
  private async getPrice(chainId: ChainId): Promise<{ price: number; timestamp: number } | null> {
    // Use Partial for optional mappings (avoids exhaustive keys for all 17 ChainId enums)
    const coinIdMap: Partial<Record<ChainId, string>> = {
      [ChainId.DOGECOIN]: 'dogecoin',
      [ChainId.BITCOIN]: 'bitcoin',
      [ChainId.LITECOIN]: 'litecoin',
      [ChainId.ETHEREUM]: 'ethereum',
      [ChainId.SOLANA]: 'solana',
      // Add more as needed; others fallback below
    };
    const coinId = coinIdMap[chainId] || 'dogecoin'; // Default fallback for unmapped chains
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd`;

    const cached = this.priceCache.get(chainId);
    if (cached && Date.now() - cached.timestamp < this.PRICE_CACHE_TTL) {  // Fixed: Use class prop, not 'as any'
      return cached;
    }

    try {
      const response = await fetch(url);

      // Optional safeguard: Warn if body pre-consumed (e.g., mock issues)
      if (response.bodyUsed) {
        console.warn(`[WARN] Response body already used for ${chainId}—possible mock/env issue`);
        return null;  // Bail early
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // SINGLE READ: Get raw text once, then parse (handles JSON errors without re-reading)
      const bodyText = await response.text();
      let data: Record<string, { usd?: number }>;
      try {
        data = JSON.parse(bodyText);
      } catch (parseError) {
        // Log snippet for debug (already read, no re-consume)
        throw new Error(`Invalid JSON for ${chainId}: ${parseError instanceof Error ? parseError.message : 'Unknown'}. Raw snippet: ${bodyText.slice(0, 200)}...`);
      }

      const usdPrice = data[coinId]?.usd;
      if (usdPrice === undefined) {
        throw new Error(`No USD price for ${coinId} in response`);
      }

      const result = { price: usdPrice, timestamp: Date.now() };
      this.priceCache.set(chainId, result);
      return result;
    } catch (error) {
      console.error(`Error fetching price for ${chainId}:`, error);
      return null;
    }
  }
}