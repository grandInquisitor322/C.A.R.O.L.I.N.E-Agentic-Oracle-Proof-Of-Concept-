// Pollers/EVMPoller.ts
import type { CommonPoller } from './PollingManager'; // FIXED: Correct path to PollingManager (exports CommonPoller)
import { ChainId, ChainConfig, getChainConfig } from '../ChainConfig20';
import type { Transaction } from '../TransactionEnricher';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';  
import type { Block } from './UTXOChainPoller'; 

export interface EVMBlock {
  hash: string;
  number: number;
  timestamp: number;
  parentHash: string;
  nonce: string;
  difficulty: string;
  gasLimit: string;
  gasUsed: string;
  miner: string;
  baseFeePerGas?: string;
  transactions?: any[]; // For full tx objects when includeTxs=true
  transactionCount: number;
  chainId: ChainId;
}

export interface EVMLog {
  address: string;
  topics: string[];
  data: string;
  blockNumber: number;
  transactionHash: string;
  transactionIndex: number;
  blockHash: string;
  logIndex: number;
  removed: boolean;
}

interface JSONRPCRequest {
  jsonrpc: string;
  id: number;
  method: string;
  params: any[];
}

interface JSONRPCResponse<T> {
  jsonrpc: string;
  id: number;
  result?: T;
  error?: {
    code: number;
    message: string;
  };
}

export interface EVMPollingOptions {
  interval?: number; // Polling interval in ms
  onBlock?: (block: Block) => void;
  onTransaction?: (tx: Transaction) => void;
  onLog?: (log: EVMLog) => void;
  onError?: (error: Error, chainId: ChainId) => void;
  enabled?: boolean;
  startBlock?: number; // Start polling from specific block
  maxBlocksPerPoll?: number; // Maximum blocks to fetch per poll
  trackPendingTransactions?: boolean; // Monitor mempool
}

export class EVMPoller implements CommonPoller {
  public lastError?: Error;
  public pollingInterval: number = 10000; // Default 10s
  public chainId?: ChainId; // FIXED: Optional until init
  public isPolling: boolean = false;
  private pollIntervalId: NodeJS.Timeout | null = null;
  private consecutiveErrors: number = 0;
  private maxConsecutiveErrors: number = 5;
  private requestIdCounter: number = 1;
  private options: EVMPollingOptions; // FIXED: Use the exported interface for type safety
  private lastBlockHeight: number = 0; // FIXED: Renamed from lastBlockNumber for CommonPoller compatibility
  private seenPendingTxs: Set<string> = new Set(); // FIXED: Added for tx tracking like UTXO
  private config?: ChainConfig; // FIXED: Optional until init
  private failedRpcUrls: Set<string> = new Set(); // FIXED: Added class property for reset

  constructor() { // FIXED: No-args constructor for test compatibility (e.g., new EVMPoller())
    this.options = {
      enabled: true,
      maxBlocksPerPoll: 10,
      trackPendingTransactions: true, // FIXED: Default to true for mempool polling like UTXO
      startBlock: 0,
      interval: undefined, // FIXED: Explicit for type
      onBlock: undefined,
      onTransaction: undefined,
      onLog: undefined,
      onError: undefined,
    };
    this.lastError = undefined;
  }

  /**
   * Initialize the poller with chain-specific config (called by manager)
   */
  public init(chainId: ChainId, config: ChainConfig, pollingInterval?: number): void { // FIXED: Added init method for lazy instantiation
    if (this.chainId) {
      console.warn(`EVMPoller for ${this.chainId} already initialized; skipping.`);
      return;
    }
    this.chainId = chainId;
    this.config = config;
    this.lastBlockHeight = this.options.startBlock ?? 0;
    this.pollingInterval = pollingInterval ?? this.options.interval ?? (this.config.blockTime ? (this.config.blockTime * 1000 / 2) : 10000); // FIXED: Null-check blockTime
  }

  /**
   * Start polling for this poller
   */
  public start(blockCallback?: (block: Block) => void, txCallback?: (tx: Transaction) => void): void {
    if (!this.chainId || !this.config) { 
      throw new Error('EVMPoller not initialized; call init() first.'); 
    }
    if (!this.options.enabled || this.isPolling) {
      return;
    }
    this.options.onBlock = blockCallback ?? this.options.onBlock;
    this.options.onTransaction = txCallback ?? this.options.onTransaction;
    this.isPolling = true;
    this.pollIntervalId = setInterval(async () => {
      await this.checkForNewBlocks();
      if (this.options.trackPendingTransactions) {
        await this.pollForPendingTransactions();
      }
    }, this.pollingInterval);
    // Initial check
    this.checkForNewBlocks().then(() => {
      if (this.options.trackPendingTransactions) {
        this.pollForPendingTransactions();
      }
    });
  }

  /**
   * Stop polling for this poller
   */
  public stop(): void {
    if (this.pollIntervalId) {
      clearInterval(this.pollIntervalId);
      this.pollIntervalId = null;
    }
    this.isPolling = false;
  }

  /**
   * Reset polling state
   */
  public reset(): void {
    this.lastBlockHeight = 0;
    this.seenPendingTxs.clear();
    this.consecutiveErrors = 0;
    this.failedRpcUrls.clear();
    this.lastError = undefined;
  }

  /**
   * Get current polling state
   */
  public getState(): {
    lastBlockHeight: number;
    seenTxCount: number;
    lastError?: Error;
  } {
    return {
      lastBlockHeight: this.lastBlockHeight,
      seenTxCount: this.seenPendingTxs.size,
      lastError: this.lastError,
    };
  }

  public clearSeenTxs(): void {
    this.seenPendingTxs.clear();
  }

  public getSeenTxCount(): number {
    return this.seenPendingTxs.size;
  }

  /**
   * Check for new blocks via RPC
   */
  private async checkForNewBlocks(): Promise<void> {
    if (!this.config) return; // FIXED: Guard
    try {
      const currentBlock = await this.getBlockNumber();
      this.lastError = undefined; // FIXED: Clear on success start

      if (currentBlock <= this.lastBlockHeight) {
        return;
      }

      const startBlock = this.lastBlockHeight + 1;
      const endBlock = Math.min(
        currentBlock,
        this.lastBlockHeight + (this.options.maxBlocksPerPoll ?? 10)
      );

      const includeTxs = !!(this.options.onTransaction);

      for (let blockNum = startBlock; blockNum <= endBlock; blockNum++) {
        const evmBlock = await this.getBlockByNumber(blockNum, includeTxs);
        if (!evmBlock) continue;

        // Map to shared Block
        const sharedBlock: Block = {
          hash: evmBlock.hash,
          height: evmBlock.number,
          time: evmBlock.timestamp,
          tx_count: evmBlock.transactionCount,
          chainId: this.chainId!,
        };

        this.options.onBlock?.(sharedBlock);

        // Process transactions if enabled
        if (includeTxs && evmBlock.transactions && this.options.onTransaction) {
          for (const tx of evmBlock.transactions) {
            const transaction = this.txToShared(tx, evmBlock);
            this.options.onTransaction!(transaction);
          }
        }

        this.lastBlockHeight = blockNum;
        this.consecutiveErrors = 0;
      }
    } catch (error) {
      this.consecutiveErrors++;
      this.lastError = error instanceof Error ? error : new Error(String(error));
      console.error(`Polling error for ${this.chainId}:`, this.lastError);

      if (this.consecutiveErrors >= this.maxConsecutiveErrors) {
        console.error(`Too many consecutive errors for ${this.config.name}, stopping poller`);
        this.stop();
      }

      this.options.onError?.(this.lastError, this.chainId!);
    }
  }

  /**
   * Poll for pending transactions (mempool)
   */
  private async pollForPendingTransactions(): Promise<void> {
    if (!this.config) return; // FIXED: Guard
    try {
      const pendingResponse = await this.rpcCall<any>('eth_getBlockByNumber', ['pending', true]);
      if (!pendingResponse.result?.transactions) return;

      for (const tx of pendingResponse.result.transactions) {
        if (this.seenPendingTxs.has(tx.hash)) continue;
        this.seenPendingTxs.add(tx.hash);

        const transaction: Transaction = {
          hash: tx.hash,
          chainId: this.chainId!,
          time: Date.now() / 1000,
          amount: this.weiToEther(tx.value),
          fee: this.calculateFeeEther(tx),
          from: tx.from || '',
          to: tx.to || '',
          confirmations: 0,
          blockHash: '',
          blockHeight: 0,
          status: 'unconfirmed',
        };

        this.options.onTransaction?.(transaction);
      }

      this.lastError = undefined;
    } catch (error) {
      this.lastError = error instanceof Error ? error : new Error(String(error));
      console.error(`Mempool polling error for ${this.chainId}:`, this.lastError);
    }
  }

  /**
   * Map EVM tx to shared Transaction
   */
  private txToShared(tx: any, block?: EVMBlock): Transaction {
    const amount = this.weiToEther(tx.value);
    const fee = this.calculateFeeEther(tx);
    return {
      hash: tx.hash,
      chainId: this.chainId!,
      time: block?.timestamp || Date.now() / 1000,
      amount,
      fee,
      from: tx.from || '',
      to: tx.to || '',
      confirmations: block ? 1 : 0,
      blockHash: block?.hash || '',
      blockHeight: block?.number || 0,
      status: block ? 'confirmed' : 'unconfirmed',
    };
  }

  /**
   * Calculate approximate fee in ether
   */
  private calculateFeeEther(tx: any): string {
    const gas = this.hexToDecimal(tx.gas);
    const gasPrice = this.hexToDecimal(tx.gasPrice || tx.maxFeePerGas || '0x0');
    const feeWei = BigInt(gas) * BigInt(gasPrice);
    return this.weiToEther(feeWei.toString());
  }

  /**
   * Get current block number
   */
  private async getBlockNumber(): Promise<number> {
    const response = await this.rpcCall<string>('eth_blockNumber', []);
    return this.hexToNumber(response.result!);
  }

  /**
   * Get block by number
   */
  private async getBlockByNumber(
    blockNumber: number,
    includeTxs: boolean = false
  ): Promise<EVMBlock | null> {
    if (!this.config) return null; // FIXED: Guard
    const response = await this.rpcCall<any>('eth_getBlockByNumber', [
      this.toHex(blockNumber),
      includeTxs,
    ]);

    const block = response.result;
    if (!block) return null;

    const parsedBlock: EVMBlock = { // FIXED: Explicit object to avoid spread type issues
      hash: block.hash,
      number: this.hexToNumber(block.number),
      timestamp: this.hexToNumber(block.timestamp),
      parentHash: block.parentHash,
      nonce: block.nonce,
      difficulty: this.hexToDecimal(block.difficulty),
      gasLimit: this.hexToDecimal(block.gasLimit),
      gasUsed: this.hexToDecimal(block.gasUsed),
      miner: block.miner,
      baseFeePerGas: block.baseFeePerGas ? this.hexToDecimal(block.baseFeePerGas) : undefined,
      transactionCount: Array.isArray(block.transactions) ? block.transactions.length : 0,
      chainId: this.chainId!,
    };

    if (includeTxs && Array.isArray(block.transactions)) {
      parsedBlock.transactions = block.transactions;
    }

    return parsedBlock;
  }

  /**
   * Get transaction by hash
   */
  async getTransaction(txHash: string): Promise<any> { // FIXED: Return any for flexibility; map if needed
    if (!this.config) return null; // FIXED: Guard
    const response = await this.rpcCall<any>('eth_getTransactionByHash', [txHash]);
    return response.result;
  }

  /**
   * Get transaction receipt
   */
  async getTransactionReceipt(txHash: string): Promise<{
    status: number;
    gasUsed: string;
    logs: EVMLog[];
  } | null> {
    if (!this.config) return null; // FIXED: Guard
    const response = await this.rpcCall<any>('eth_getTransactionReceipt', [txHash]);
    const receipt = response.result;
    if (!receipt) return null;

    return {
      status: this.hexToNumber(receipt.status || '0x1'), // FIXED: Default to success if missing
      gasUsed: this.hexToDecimal(receipt.gasUsed),
      logs: receipt.logs?.map((log: any) => ({
        address: log.address,
        topics: log.topics,
        data: log.data,
        blockNumber: this.hexToNumber(log.blockNumber),
        transactionHash: log.transactionHash,
        transactionIndex: this.hexToNumber(log.transactionIndex),
        blockHash: log.blockHash,
        logIndex: this.hexToNumber(log.logIndex),
        removed: log.removed || false,
      })) || [],
    };
  }

  /**
   * Get logs (events) for a filter
   */
  async getLogs(filter: {
    fromBlock?: number | string;
    toBlock?: number | string;
    address?: string | string[];
    topics?: (string | string[] | null)[];
  }): Promise<EVMLog[]> {
    if (!this.config) return []; // FIXED: Guard
    const params: any = {};

    if (filter.fromBlock !== undefined) {
      params.fromBlock = typeof filter.fromBlock === 'number' ? this.toHex(filter.fromBlock) : filter.fromBlock;
    }
    if (filter.toBlock !== undefined) {
      params.toBlock = typeof filter.toBlock === 'number' ? this.toHex(filter.toBlock) : filter.toBlock;
    }
    if (filter.address) {
      params.address = filter.address;
    }
    if (filter.topics) {
      params.topics = filter.topics;
    }

    const response = await this.rpcCall<any[]>('eth_getLogs', [params]);

    return (response.result || []).map((log: any) => ({
      address: log.address,
      topics: log.topics,
      data: log.data,
      blockNumber: this.hexToNumber(log.blockNumber),
      transactionHash: log.transactionHash,
      transactionIndex: this.hexToNumber(log.transactionIndex),
      blockHash: log.blockHash,
      logIndex: this.hexToNumber(log.logIndex),
      removed: log.removed || false,
    }));
  }

  /**
   * Get balance of an address
   */
  async getBalance(address: string, blockNumber: number | 'latest' = 'latest'): Promise<string> {
    if (!this.config) return '0'; // FIXED: Guard
    const blockParam = blockNumber === 'latest' ? 'latest' : this.toHex(blockNumber);
    const response = await this.rpcCall<string>('eth_getBalance', [address, blockParam]);
    return this.hexToDecimal(response.result || '0x0'); // FIXED: Default to 0 if missing
  }

  /**
   * Generic JSON-RPC call with fallback and retry logic
   */
  private async rpcCall<T>(method: string, params: any[] = []): Promise<JSONRPCResponse<T>> {
    if (!this.config) { // FIXED: Guard
      throw new Error('EVMPoller not initialized; no config available.');
    }
    const errors: Error[] = [];

    // Try each RPC URL in sequence
    const rpcUrls = this.config.rpcUrls ?? [this.config.rpcUrl!];
    for (const rpcUrl of rpcUrls) {
      if (this.failedRpcUrls.has(rpcUrl)) {
        continue;
      }

      try {
        const request: JSONRPCRequest = {
          jsonrpc: '2.0',
          id: this.requestIdCounter++,
          method,
          params,
        };

        const response = await fetch(rpcUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(request),
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json() as JSONRPCResponse<T>;

        if (data.error) {
          throw new Error(`RPC error: ${data.error.message} (code: ${data.error.code})`);
        }

        // Success - remove from failed list if it was there
        this.failedRpcUrls.delete(rpcUrl);

        return data;
      } catch (error) {
        errors.push(error as Error);

        // Mark this URL as failed temporarily
        this.failedRpcUrls.add(rpcUrl);

        // Clear failed URLs after 5 minutes
        setTimeout(() => {
          this.failedRpcUrls.delete(rpcUrl);
        }, 5 * 60 * 1000);

        continue;
      }
    }

    // All URLs failed
    throw new Error(
      `All RPC endpoints failed for ${this.config.name}. Errors: ${errors.map((e) => e.message).join('; ')}`
    );
  }

  /**
   * Utility: Convert hex to number
   */
  private hexToNumber(hex: string): number {
    return parseInt(hex, 16);
  }

  /**
   * Utility: Convert hex to decimal string (for large numbers)
   */
  private hexToDecimal(hex: string): string {
    if (!hex || hex === '0x0') return '0';
    return BigInt(hex).toString();
  }

  /**
   * Utility: Convert number to hex
   */
  private toHex(num: number): string {
    return `0x${num.toString(16)}`;
  }

  /**
   * Utility: Convert wei to ether string
   */
  private weiToEther(wei: string): string {
    if (!wei || wei === '0x0') return '0.000000000000000000';
    const bigWei = BigInt(wei);
    const decimals = this.config?.decimals || 18; // FIXED: Safe access
    const divisor = 10n ** BigInt(decimals);
    const integerPart = (bigWei / divisor).toString();
    let fractionalPart = (bigWei % divisor).toString();
    fractionalPart = fractionalPart.padStart(Number(decimals), '0').slice(0, Number(decimals));
    return `${integerPart}.${fractionalPart}`;
  }
}

// FIXED: Proper EVMPollingManager (replaces stub; exported separately)
export class EVMPollingManager {
  private pollers: Map<ChainId, EVMPoller> = new Map();

  addPoller(chainId: ChainId, config: ChainConfig): void {
    const poller = new EVMPoller();
    poller.init(chainId, config); // FIXED: Use init() after no-args constructor
    this.pollers.set(chainId, poller);
  }

  getPoller(chainId: ChainId): EVMPoller {
    if (!this.pollers.has(chainId)) {
      const config = getChainConfig(chainId);
      const poller = new EVMPoller();
      poller.init(chainId, config); // FIXED: Use init() for lazy-add
      this.pollers.set(chainId, poller);
    }
    return this.pollers.get(chainId)!;
  }

  getActivePollers(): EVMPoller[] {
    return Array.from(this.pollers.values()).filter(p => p.isPolling);
  }

  startAll(blockCallback?: (block: Block) => void, txCallback?: (tx: Transaction) => void): void {
    for (const poller of this.pollers.values()) {
      poller.start(blockCallback, txCallback);
    }
  }

  stopAll(): void {
    for (const poller of this.pollers.values()) {
      poller.stop();
    }
  }

  public getAllPollers(): EVMPoller[] {
    return Array.from(this.pollers.values());
  }

  public getChainIds(): ChainId[] {
    return Array.from(this.pollers.keys());
  }
}