// Pollers/BlockValidators.ts
import { ChainConfig } from '../ChainConfig20';

// Define types inline
export interface RawBlock {
  // Example properties; adjust based on your block structure
  hash: string;
  height: number;
  timestamp: number;
  transactions: RawTransaction[]; // Array of transaction objects
  validator?: string;
  merkleRoot?: string;
  previousHash?: string;
  prevTimestamp?: number;
}

export interface RawTransaction {
  // Example properties; adjust based on your tx structure
  id: string;
  hash: string;
  from: string;
  to: string;
  value: string; // Or bigint/number
  data?: string;
  nonce: number;
  gasLimit: number;
  gasPrice: string;
}

export interface BlockValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  score: number; // 0-100
}

export class BlockValidator {
  constructor(private config: ChainConfig) {}

  validateBlock(block: RawBlock): BlockValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    let score = 100;

    if (!block) {
      errors.push('NULL_BLOCK');
      return { isValid: false, errors, warnings, score: 0 };
    }

    // 1. Header basics
    if (!block.hash || block.hash.length !== 64 || !/^[0-9a-fA-F]{64}$/.test(block.hash)) {
      errors.push('INVALID_BLOCK_HASH');
      score -= 50;
    }
    if (block.height <= 0 || !Number.isInteger(block.height)) {
      errors.push('INVALID_HEIGHT');
      score -= 50;
    }

    // 2. Timestamp sanity (not too future/old)
    const now = Math.floor(Date.now() / 1000);
    if (block.timestamp > now + 3600) { // 1hr future max
      warnings.push('FUTURE_TIMESTAMP');
      score -= 5;
    } else if (block.timestamp < now - 86400 * 7) { // Not >1 week old
      errors.push('STALE_TIMESTAMP');
      score -= 20;
    }

    // 3. Tx count & merkle root
    if (!block.transactions || block.transactions.length === 0) {
      errors.push('NO_TRANSACTIONS');
      score -= 30;
    } else {
      // Stub Merkle root verification (expand with merkle-lib)
      if (block.merkleRoot) {
        const txIds = block.transactions.map((tx: RawTransaction) => tx.id).join('');
        const simpleMerkle = this.simpleHash(txIds);  // Placeholder
        if (simpleMerkle !== block.merkleRoot) {
          errors.push('INVALID_MERKLE_ROOT');
          score -= 40;
        }
      } else {
        warnings.push('MISSING_MERKLE_ROOT');
        score -= 10;
      }
    }

    // 4. Chain-specific interval (requires prevTimestamp)
    const expectedInterval = this.config.blockTime;
    if (block.previousHash && block.height > 1 && block.prevTimestamp !== undefined) {
      const actualInterval = block.timestamp - block.prevTimestamp;
      if (Math.abs(actualInterval - expectedInterval) > expectedInterval * 2) {
        warnings.push(`UNUSUAL_BLOCK_INTERVAL: expected ~${expectedInterval}s, got ${actualInterval}s`);
        score -= 10;
      }
    } else if (block.height > 1) {
      warnings.push('MISSING_PREV_TIMESTAMP; skipping interval check');
      score -= 5;
    }

    const isValid = errors.length === 0;
    return { isValid, errors, warnings, score: Math.max(0, Math.min(100, score)) };
  }

  // Batch for mempool efficiency
  validateBatch(blocks: RawBlock[]): Map<string, BlockValidationResult> {
    const results = new Map<string, BlockValidationResult>();
    blocks.forEach(block => {
      if (block.hash) {
        results.set(block.hash, this.validateBlock(block));
      }
    });
    return results;
  }

  // Private helper for simple Merkle stub (replace with real lib)
  private simpleHash(data: string): string {
    // Placeholder: real impl would use SHA256 pairs
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit int
    }
    return hash.toString(16).padStart(64, '0');  // Dummy 64-char hex
  }
}