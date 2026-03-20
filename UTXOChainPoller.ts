// server/Pollers/UTXOChainPoller.ts
import type { ChainId, ChainConfig } from '../ChainConfig20';
import { getChainConfig } from '../ChainConfig20'; // FIXED: Import getChainConfig as value, not type
import type { Transaction } from '../TransactionEnricher'; // Import Transaction type for return type

export interface Block {
  hash: string;
  height: number;
  time: number;
  tx_count?: number;
  size?: number;
  difficulty?: string;
  nonce?: string;
  chainId: ChainId; // FIXED: Added chainId to Block interface for test compatibility
}

export class UTXOChainPoller {
  public lastError: Error | undefined;
  public pollingInterval: number = 10000; // Default 10s
  public chainId: ChainId; // FIXED: Made public for access in manager
  public isPolling: boolean = false;  // FIXED: Changed from private to public (matches CommonPoller; fixes TS2341)
  private pollIntervalId: NodeJS.Timeout | null = null;

  private lastBlockHeight: number = 0;
  private seenTxs: Set<string> = new Set();
  private config: ChainConfig;
  private blockCallback?: (block: Block) => void;
  private txCallback?: (tx: Transaction) => void;

  constructor(chainId: ChainId, config: ChainConfig) {
    this.chainId = chainId;
    this.config = config;
  }

  /**
   * Poll for new blocks starting from last known height
   * @param count - Max number of blocks to fetch (default 1)
   */
  public async pollForBlocks(count: number = 1): Promise<Block[]> {
    try {
      const newBlocks: Block[] = [];
      let currentHeight = this.lastBlockHeight;

      // Get current block count
      const countResponse = await this.makeRpcCall('getblockcount', []);
      if (countResponse.error) {
        throw new Error(`RPC Error: ${countResponse.error.message}`);
      }
      const totalHeight = countResponse.result as number;

      // Fetch new blocks
      for (let i = 0; i < count && currentHeight < totalHeight; i++) {
        currentHeight++;
        const height = currentHeight;

        // Get block hash
        const hashResponse = await this.makeRpcCall('getblockhash', [height]);
        if (hashResponse.error) {
          throw new Error(`RPC Error for block ${height}: ${hashResponse.error.message}`);
        }
        const blockHash = hashResponse.result as string;

        // Get block details
        const blockResponse = await this.makeRpcCall('getblock', [blockHash]);
        if (blockResponse.error) {
          throw new Error(`RPC Error for block ${blockHash}: ${blockResponse.error.message}`);
        }
        const blockData = blockResponse.result as {
          hash: string;
          height: number;
          time: number;
          tx_count?: number;
          size?: number;
          difficulty?: string;
          nonce?: string;
        };

        const block: Block = {
          hash: blockData.hash,
          height: blockData.height,
          time: blockData.time,
          tx_count: blockData.tx_count,
          size: blockData.size,
          difficulty: blockData.difficulty,
          nonce: blockData.nonce,
          chainId: this.chainId, // FIXED: Set chainId
        };

        newBlocks.push(block);

        if (this.blockCallback) {
          this.blockCallback(block);
        }

        this.lastBlockHeight = height;
      }

      this.lastError = undefined;
      return newBlocks;
    } catch (error) {
      this.lastError = error instanceof Error ? error : new Error(String(error));
      console.error(`Polling error for ${this.chainId}:`, this.lastError);
      return [];
    }
  }

  /**
   * Poll for new transactions from mempool
   * @param maxTxs - Max number of transactions to fetch (default 10)
   */
  public async pollForTransactions(maxTxs: number = 10): Promise<Transaction[]> {
    try {
      const newTxs: Transaction[] = [];
      const decimals = this.config.decimals || 8;
      const satToBtc = (sats: number) => (sats / Math.pow(10, decimals)).toFixed(decimals);

      // Get mempool
      const mempoolResponse = await this.makeRpcCall('getrawmempool', []);
      if (mempoolResponse.error) {
        throw new Error(`RPC Error: ${mempoolResponse.error.message}`);
      }
      const txIds = (mempoolResponse.result as string[]) || [];

      // Filter unseen txs
      const unseenTxIds = txIds.slice(0, maxTxs).filter((txId) => !this.seenTxs.has(txId));

      // Fetch details for unseen txs
      for (const txId of unseenTxIds) {
        const txResponse = await this.makeRpcCall('getrawtransaction', [txId, true]);
        if (txResponse.error) {
          console.warn(`Failed to fetch tx ${txId}: ${txResponse.error.message}`);
          continue;
        }

        const txData = txResponse.result as {
          txid: string;
          time?: number;
          vout: Array<{ value: number; scriptPubKey: { addresses?: string[] } }>;
          vin: Array<{ prevout?: { scriptPubKey: { addresses?: string[] } } }>;
          fee?: number;
        };

        if (!txData.vout || txData.vout.length === 0) {
          // FIXED: Include txs with no outputs (e.g., coinbase or OP_RETURN-only) with amount=0
          const tx: Transaction = {
            hash: txData.txid,
            chainId: this.chainId,
            time: txData.time || Date.now() / 1000,
            amount: '0.00000000',  // Zero for no outputs
            fee: satToBtc(txData.fee || 0),
            from: '',
            to: '',
            confirmations: 0, // Mempool txs have 0 confirmations
            blockHash: '',
            blockHeight: 0,
            status: 'unconfirmed',
          };
          newTxs.push(tx);
          if (this.txCallback) {
            this.txCallback(tx);
          }
          this.seenTxs.add(txId);
          continue;
        }

        const totalOutput = txData.vout.reduce((sum, out) => sum + (out.value || 0), 0);
        const fee = txData.fee || 0;
        const amount = satToBtc(totalOutput);
        const feeBtc = satToBtc(fee);

        const fromAddresses = txData.vin
          .map((vin) => vin.prevout?.scriptPubKey.addresses?.[0])
          .filter(Boolean);
        const toAddresses = txData.vout
          .map((vout) => vout.scriptPubKey.addresses?.[0])
          .filter(Boolean);

        const tx: Transaction = {
          hash: txData.txid,
          chainId: this.chainId,
          time: txData.time || Date.now() / 1000,
          amount: amount,
          fee: feeBtc,  // FIXED: Converted sats to BTC string
          from: fromAddresses[0] || '',
          to: toAddresses[0] || '',
          confirmations: 0, // Mempool txs have 0 confirmations
          blockHash: '',
          blockHeight: 0,
          status: 'unconfirmed',
        };

        newTxs.push(tx);

        if (this.txCallback) {
          this.txCallback(tx);
        }

        this.seenTxs.add(txId);
      }

      this.lastError = undefined;
      return newTxs;
    } catch (error) {
      this.lastError = error instanceof Error ? error : new Error(String(error));
      console.error(`Mempool polling error for ${this.chainId}:`, this.lastError);
      return [];
    }
  }

  /**
   * Start polling for this poller
   */
  public start(blockCallback?: (block: Block) => void, txCallback?: (tx: Transaction) => void): void {
    this.blockCallback = blockCallback;
    this.txCallback = txCallback;
    if (!this.isPolling) {
      this.isPolling = true;
      this.pollIntervalId = setInterval(async () => {
        await this.pollForBlocks(1);
        await this.pollForTransactions(10);
      }, this.pollingInterval);
    }
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
    this.seenTxs.clear();
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
      seenTxCount: this.seenTxs.size,  // FIXED: Direct access fine here (internal)
      lastError: this.lastError,
    };
  }

  // FIXED: Added for Sentinel/tests: Public clear for seen txs (e.g., resume polling)
  public clearSeenTxs(): void {
    this.seenTxs.clear();
  }

  // FIXED: Added for Sentinel: Public query for seen count (no Set exposure)
  public getSeenTxCount(): number {
    return this.seenTxs.size;
  }

  /**
   * Make RPC call helper
   * @private
   */
  private async makeRpcCall(method: string, params: any[]): Promise<{ result?: any; error?: { code: number; message: string } }> {
    const requestBody = JSON.stringify({
      jsonrpc: '1.0',
      id: Date.now(),
      method,
      params,
    });

    const response = await fetch(this.config.rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: requestBody,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return data;
  }
}

// FIXED: Enhanced UTXOPollingManager with all required methods: addPoller, getActivePollers, startAll, stopAll
export class UTXOPollingManager {
  private pollers: Map<ChainId, UTXOChainPoller> = new Map();

  addPoller(chainId: ChainId, config: ChainConfig): void {
    this.pollers.set(chainId, new UTXOChainPoller(chainId, config));
  }

  getPoller(chainId: ChainId): UTXOChainPoller {
    if (!this.pollers.has(chainId)) {
      const config = getChainConfig(chainId);
      this.pollers.set(chainId, new UTXOChainPoller(chainId, config));
    }
    return this.pollers.get(chainId)!;
  }

  getActivePollers(): UTXOChainPoller[] {
    // FIXED: Filter by isPolling = true (consistent with EVM; fixes length 3 → 2)
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

  // FIXED: Added getAllPollers() and getChainIds() for PollingManager support (no inline comments in body)
  public getAllPollers(): UTXOChainPoller[] {
    return Array.from(this.pollers.values());
  }

  public getChainIds(): ChainId[] {
    return Array.from(this.pollers.keys());
  }
}