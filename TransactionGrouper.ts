// TransactionGrouper.ts
import { ChainId } from './ChainConfig20';

export interface UTXOTransaction {
  id: string; // txid
  amount: number;
  category?: string;
  date?: string; // ISO format
  description?: string;
  chainId: ChainId; // Required for multi-chain
  blockHeight?: number;
  confirmations?: number;
  fee?: number;
  inputs?: UTXOInput[];
  outputs?: UTXOOutput[];
  type?: 'send' | 'receive' | 'internal';
  status?: 'confirmed' | 'pending' | 'failed';
}

export interface UTXOInput {
  txid: string;
  vout: number;
  address?: string;
  value: number;
}

export interface UTXOOutput {
  address: string;
  value: number;
  scriptPubKey?: string;
}

export interface GroupedStats {
  count: number;
  totalAmount: number;
  averageAmount: number;
  totalFees?: number;
}

export class TransactionGrouper {
  /**
   * Groups transactions by blockchain chain
   */
  static groupByChain(transactions: UTXOTransaction[]): Map<ChainId, UTXOTransaction[]> {
    const grouped = new Map<ChainId, UTXOTransaction[]>();
    transactions.forEach((tx) => {
      if (!grouped.has(tx.chainId)) {
        grouped.set(tx.chainId, []);
      }
      grouped.get(tx.chainId)!.push(tx);
    });
    return grouped;
  }

  /**
   * Groups transactions by category (default: 'uncategorized')
   */
  static groupByCategory(transactions: UTXOTransaction[]): Map<string, UTXOTransaction[]> {
    const grouped = new Map<string, UTXOTransaction[]>();
    transactions.forEach((tx) => {
      const cat = tx.category || 'uncategorized';
      if (!grouped.has(cat)) {
        grouped.set(cat, []);
      }
      grouped.get(cat)!.push(tx);
    });
    return grouped;
  }

  /**
   * Groups transactions by date (YYYY-MM-DD)
   */
  static groupByDate(transactions: UTXOTransaction[]): Map<string, UTXOTransaction[]> {
    const grouped = new Map<string, UTXOTransaction[]>();
    transactions.forEach((tx) => {
      if (!tx.date) return;
      const dateKey = tx.date.split('T')[0];
      if (!grouped.has(dateKey)) {
        grouped.set(dateKey, []);
      }
      grouped.get(dateKey)!.push(tx);
    });
    return grouped;
  }

  /**
   * Groups transactions by confirmation status
   */
  static groupByStatus(transactions: UTXOTransaction[]): Map<string, UTXOTransaction[]> {
    const grouped = new Map<string, UTXOTransaction[]>();
    transactions.forEach((tx) => {
      const status = tx.status || 'unknown';
      if (!grouped.has(status)) {
        grouped.set(status, []);
      }
      grouped.get(status)!.push(tx);
    });
    return grouped;
  }

  /**
   * Groups transactions by type (send/receive/internal)
   */
  static groupByType(transactions: UTXOTransaction[]): Map<string, UTXOTransaction[]> {
    const grouped = new Map<string, UTXOTransaction[]>();
    transactions.forEach((tx) => {
      const type = tx.type || 'unknown';
      if (!grouped.has(type)) {
        grouped.set(type, []);
      }
      grouped.get(type)!.push(tx);
    });
    return grouped;
  }

  /**
   * Groups transactions by block height ranges
   */
  static groupByBlockRange(
    transactions: UTXOTransaction[],
    rangeSize: number = 1000
  ): Map<string, UTXOTransaction[]> {
    const grouped = new Map<string, UTXOTransaction[]>();
    transactions.forEach((tx) => {
      if (tx.blockHeight === undefined) return;
      const rangeStart = Math.floor(tx.blockHeight / rangeSize) * rangeSize;
      const rangeKey = `${rangeStart}-${rangeStart + rangeSize - 1}`;
      if (!grouped.has(rangeKey)) {
        grouped.set(rangeKey, []);
      }
      grouped.get(rangeKey)!.push(tx);
    });
    return grouped;
  }

  /**
   * Multi-level grouping: by chain, then by date
   */
  static groupByChainAndDate(
    transactions: UTXOTransaction[]
  ): Map<ChainId, Map<string, UTXOTransaction[]>> {
    const result = new Map<ChainId, Map<string, UTXOTransaction[]>>();
    const byChain = this.groupByChain(transactions);
    
    byChain.forEach((txs, chainId) => {
      result.set(chainId, this.groupByDate(txs));
    });
    
    return result;
  }

  /**
   * Multi-level grouping: by chain, then by type
   */
  static groupByChainAndType(
    transactions: UTXOTransaction[]
  ): Map<ChainId, Map<string, UTXOTransaction[]>> {
    const result = new Map<ChainId, Map<string, UTXOTransaction[]>>();
    const byChain = this.groupByChain(transactions);
    
    byChain.forEach((txs, chainId) => {
      result.set(chainId, this.groupByType(txs));
    });
    
    return result;
  }

  /**
   * Validates UTXO transactions
   */
  static validateTransactions(transactions: UTXOTransaction[]): {
    valid: UTXOTransaction[];
    errors: string[];
  } {
    const errors: string[] = [];
    const valid: UTXOTransaction[] = [];

    transactions.forEach((tx, index) => {
      if (!tx.id) {
        errors.push(`Transaction at index ${index}: Missing ID`);
      } else if (!tx.chainId) {
        errors.push(`Transaction ${tx.id}: Missing chainId`);
      } else if (typeof tx.amount !== 'number' || tx.amount < 0) {
        errors.push(`Transaction ${tx.id}: Invalid amount`);
      } else if (tx.confirmations !== undefined && tx.confirmations < 0) {
        errors.push(`Transaction ${tx.id}: Invalid confirmations`);
      } else {
        valid.push(tx);
      }
    });

    return { valid, errors };
  }

  /**
   * Get statistics for grouped transactions
   */
  static getGroupStats(grouped: Map<string, UTXOTransaction[]>): Map<string, GroupedStats> {
    const stats = new Map<string, GroupedStats>();
    
    grouped.forEach((txs, key) => {
      const totalAmount = txs.reduce((sum, tx) => sum + tx.amount, 0);
      const totalFees = txs.reduce((sum, tx) => sum + (tx.fee || 0), 0);
      
      stats.set(key, {
        count: txs.length,
        totalAmount,
        averageAmount: totalAmount / txs.length,
        totalFees: totalFees > 0 ? totalFees : undefined,
      });
    });
    
    return stats;
  }

  /**
   * Get totals per category
   */
  static getTotalsByCategory(grouped: Map<string, UTXOTransaction[]>): Map<string, number> {
    const totals = new Map<string, number>();
    grouped.forEach((txs, category) => {
      const total = txs.reduce((sum, tx) => sum + tx.amount, 0);
      totals.set(category, total);
    });
    return totals;
  }

  /**
   * Get totals per chain
   */
  static getTotalsByChain(grouped: Map<ChainId, UTXOTransaction[]>): Map<ChainId, number> {
    const totals = new Map<ChainId, number>();
    grouped.forEach((txs, chainId) => {
      const total = txs.reduce((sum, tx) => sum + tx.amount, 0);
      totals.set(chainId, total);
    });
    return totals;
  }

  /**
   * Filter transactions by confirmation threshold
   */
  static filterByConfirmations(
    transactions: UTXOTransaction[],
    minConfirmations: number
  ): UTXOTransaction[] {
    return transactions.filter(
      (tx) => tx.confirmations !== undefined && tx.confirmations >= minConfirmations
    );
  }

  /**
   * Filter transactions by amount range
   */
  static filterByAmountRange(
    transactions: UTXOTransaction[],
    minAmount: number,
    maxAmount: number = Infinity
  ): UTXOTransaction[] {
    return transactions.filter(
      (tx) => tx.amount >= minAmount && tx.amount <= maxAmount
    );
  }

  /**
   * Get pending transactions (< 6 confirmations or status pending)
   */
  static getPendingTransactions(transactions: UTXOTransaction[]): UTXOTransaction[] {
    return transactions.filter(
      (tx) =>
        tx.status === 'pending' ||
        (tx.confirmations !== undefined && tx.confirmations < 6)
    );
  }

  /**
   * Sort transactions by most recent first
   */
  static sortByDate(transactions: UTXOTransaction[], descending = true): UTXOTransaction[] {
    return [...transactions].sort((a, b) => {
      if (!a.date || !b.date) return 0;
      const comparison = new Date(a.date).getTime() - new Date(b.date).getTime();
      return descending ? -comparison : comparison;
    });
  }

  /**
   * Sort transactions by block height
   */
  static sortByBlockHeight(
    transactions: UTXOTransaction[],
    descending = true
  ): UTXOTransaction[] {
    return [...transactions].sort((a, b) => {
      if (a.blockHeight === undefined || b.blockHeight === undefined) return 0;
      return descending ? b.blockHeight - a.blockHeight : a.blockHeight - b.blockHeight;
    });
  }
}