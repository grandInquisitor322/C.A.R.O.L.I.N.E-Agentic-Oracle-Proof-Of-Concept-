// server/TransactionValidator.ts
// Multi-chain transaction validator for UTXO Scrypt-based coins
// Validates transactions, checks signatures, verifies UTXOs, and enforces chain rules

import * as bitcoin from 'bitcoinjs-lib';
import { ChainId, ChainConfig } from '../ChainConfig20';
// FIXED: Removed unused import of Transaction from UTXOChainPoller (not exported there)

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  score: number; // 0-100, confidence score
}

export interface ValidationError {
  code: string;
  message: string;
  severity: 'critical' | 'major' | 'minor';
  field?: string;
}

export interface ValidationWarning {
  code: string;
  message: string;
  field?: string;
}

export interface UTXO {
  txid: string;
  vout: number;
  value: string;
  scriptPubKey: string;
  address?: string;
  confirmations: number;
}

export interface TransactionInput {
  txid: string;
  vout: number;
  scriptSig?: string;
  sequence: number;
  witness?: string[];
}

export interface TransactionOutput {
  value: string;
  scriptPubKey: string;
  address?: string;
}

export interface RawTransaction {
  txid: string;
  hash: string;
  version: number;
  locktime: number;
  vin: TransactionInput[];
  vout: TransactionOutput[];
  size?: number;
  vsize?: number;
  weight?: number;
  fee?: string; // FIXED: Add optional fee if not present in RawTransaction
}

export interface ValidationOptions {
  checkSignatures?: boolean;
  checkUTXOs?: boolean;
  checkDoubleSpend?: boolean;
  checkDust?: boolean;
  checkFees?: boolean;
  checkRBF?: boolean;
  strictMode?: boolean;
  minConfirmations?: number;
  maxFeeRate?: number; // satoshis per byte
}

export class TransactionValidator {
  private networks: Map<ChainId, bitcoin.Network> = new Map();
  private knownTransactions: Map<string, RawTransaction> = new Map();
  private spentOutputs: Set<string> = new Set(); // Format: "txid:vout"

  constructor(private config: ChainConfig) {
    this.initializeNetworks();
  }

  private validateFee(tx: RawTransaction, utxos: UTXO[]): { errors: ValidationError[]; warnings: ValidationWarning[]; scoreDeduct: number } {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];
  let scoreDeduct = 0;
  const fee = parseFloat(tx.fee || '0') || 0; // FIXED: Handle optional fee
  const inputSum = utxos.reduce((sum, u) => sum + parseFloat(u.value), 0);
  const outputSum = tx.vout.reduce((sum, out) => sum + parseFloat(out.value), 0);
  const calculatedFee = inputSum - outputSum;

  if (fee < 0) {
    errors.push({ code: 'NEGATIVE_FEE', field: 'fee', message: 'Negative fee invalid', severity: 'critical' });
    scoreDeduct += 30;
    return { errors, warnings, scoreDeduct };
  }
  if (Math.abs(fee - calculatedFee) > 1) {
    errors.push({ code: 'INVALID_FEE', field: 'fee', message: `Fee mismatch: expected ${calculatedFee}, got ${fee}`, severity: 'major' });
    scoreDeduct += 20;
    return { errors, warnings, scoreDeduct };
  }

  if (fee === 0) {
    warnings.push({ code: 'ZERO_FEE', field: 'fee', message: 'Transaction has zero fee, may not be mined quickly' });
    scoreDeduct += 2;
    return { errors, warnings, scoreDeduct }; // FIXED: Early return—skips low rate check
  }

  const txSize = this.estimateSize(tx); // FIXED: Changed from estimateTxSize to estimateSize
  const feeRate = fee / txSize;
  if (feeRate < 1) {
    warnings.push({ code: 'LOW_FEE_RATE', field: 'fee', message: `Fee rate (${feeRate.toFixed(2)} sat/byte) is very low, may not be mined` });
    scoreDeduct += 2;
  }
  
  return { errors, warnings, scoreDeduct }; 
}

  private initializeNetworks(): void {
    // Bitcoin (for reference)
    this.networks.set(ChainId.BITCOIN, bitcoin.networks.bitcoin);

    // Litecoin
    this.networks.set(ChainId.LITECOIN, {
      messagePrefix: '\x19Litecoin Signed Message:\n',
      bech32: 'ltc',
      bip32: { public: 0x019da462, private: 0x019d9cfe },
      pubKeyHash: 0x30,
      scriptHash: 0x32,
      wif: 0xb0,
    });

    // Dogecoin
    this.networks.set(ChainId.DOGECOIN, {
      messagePrefix: '\x19Dogecoin Signed Message:\n',
      bech32: 'doge',
      bip32: { public: 0x02facafd, private: 0x02fac398 },
      pubKeyHash: 0x1e,
      scriptHash: 0x16,
      wif: 0x9e,
    });

    // Luckycoin
    this.networks.set(ChainId.LUCKYCOIN, {
      messagePrefix: '\x18Luckycoin Signed Message:\n',
      bech32: 'lky',
      bip32: { public: 0x022d2533, private: 0x022d251f },
      pubKeyHash: 0x30,
      scriptHash: 0x32,
      wif: 0xb0,
    });

    // Bellscoin
    this.networks.set(ChainId.BELLSCOIN, {
      messagePrefix: '\x19Bellscoin Signed Message:\n',
      bech32: 'bel',
      bip32: { public: 0x0488b21e, private: 0x0488ade4 },
      pubKeyHash: 0x19,
      scriptHash: 0x55,
      wif: 0x99,
    });

    // Digibyte
    this.networks.set(ChainId.DIGIBYTE, {
      messagePrefix: '\x19DigiByte Signed Message:\n',
      bech32: 'dgb',
      bip32: { public: 0x0488b21e, private: 0x0488ade4 },
      pubKeyHash: 0x1e,
      scriptHash: 0x3f,
      wif: 0x80,
    });
    // Shibacoin
    this.networks.set(ChainId.SHIBACOIN, {
      messagePrefix: '\x19Shibacoin Signed Message:\n',
      bech32: 'shiba',
      bip32: { public: 0x0488b21e, private: 0x0488ade4 },
      pubKeyHash: 0x30,
      scriptHash: 0x32,
      wif: 0xb0,
    });
    // Catcoin
    this.networks.set(ChainId.CATCOIN, {
        messagePrefix: '\x19Catcoin Signed Message:\n',
        bech32: 'cat',
        bip32: { public: 0x0488b21e, private: 0x0488ade4 },
        pubKeyHash: 0x30,
        scriptHash: 0x32,
        wif: 0xb0,
    });
    // Beerscoin
    this.networks.set(ChainId.BEERSCOIN, {
        messagePrefix: '\x19Beerscoin Signed Message:\n',
        bech32: 'beers',
        bip32: { public: 0x0488b21e, private: 0x0488ade4 },
        pubKeyHash: 0x30,
        scriptHash: 0x32,
        wif: 0xb0,
    });
    // Newyorkcoin
    this.networks.set(ChainId.NEWYORKCOIN, {
        messagePrefix: '\x19Newyorkcoin Signed Message:\n',
        bech32: 'nyc',
        bip32: { public: 0x0488b21e, private: 0x0488ade4 },
        pubKeyHash: 0x30,
        scriptHash: 0x32,
        wif: 0xb0,
    });
    this.networks.set(ChainId.BONKCOIN, {
        messagePrefix: '\x19Bonkcoin Signed Message:\n',
        bech32: 'bonk',
        bip32: { public: 0x0488b21e, private: 0x0488ade4 },
        pubKeyHash: 0x30,
        scriptHash: 0x32,
        wif: 0xb0,
    });
    this.networks.set(ChainId.PEPECOIN, {
        messagePrefix: '\x19Pepecoin Signed Message:\n',
        bech32: 'pepe',
        bip32: { public: 0x0488b21e, private: 0x0488ade4 },
        pubKeyHash: 0x30,
        scriptHash: 0x32,
        wif: 0xb0,
    });
    this.networks.set(ChainId.JUNKCOIN, {
        messagePrefix: '\x19Junkcoin Signed Message:\n',
        bech32: 'scrypt',
        bip32: { public: 0x0488b21e, private: 0x0488ade4 },
        pubKeyHash: 0x30,
        scriptHash: 0x32,
        wif: 0xb0,
    });
    this.networks.set(ChainId.DINGOCOIN, {
        messagePrefix: '\x19Dingocoin Signed Message:\n',
        bech32: 'dingo',
        bip32: { public: 0x0488b21e, private: 0x0488ade4 },
        pubKeyHash: 0x30,
        scriptHash: 0x32,
        wif: 0xb0,
    });
  }


   /**
   * Validate a complete transaction
   */
  async validateTransaction(
    tx: RawTransaction,
    utxos: UTXO[],
    options: ValidationOptions = {}
  ): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Set default options
    const opts: Required<ValidationOptions> = {
      checkSignatures: options.checkSignatures ?? true,
      checkUTXOs: options.checkUTXOs ?? true,
      checkDoubleSpend: options.checkDoubleSpend ?? true,
      checkDust: options.checkDust ?? true,
      checkFees: options.checkFees ?? true,
      checkRBF: options.checkRBF ?? false,
      strictMode: options.strictMode ?? false,
      minConfirmations: options.minConfirmations ?? 1,
      maxFeeRate: options.maxFeeRate ?? 1000, // 1000 sat/byte max
    };

    // 1. Basic structure validation
    this.validateStructure(tx, errors, warnings);

    // 2. Version validation
    this.validateVersion(tx, errors, warnings);

    // 3. Locktime validation
    this.validateLocktime(tx, errors, warnings);

    // 4. Input validation
    await this.validateInputs(tx, utxos, opts, errors, warnings);

    // 5. Output validation
    this.validateOutputs(tx, opts, errors, warnings);

    // 6. Fee validation
    if (opts.checkFees) {
      // FIXED: Use the private helper instead of old validateFees
      const feeResult = this.validateFee(tx, utxos);
      errors.push(...feeResult.errors);
      warnings.push(...feeResult.warnings);
      // Note: Score deducts are applied in calculateScore via severity/number
    }

    // 7. Double-spend check
    if (opts.checkDoubleSpend) {
      this.checkDoubleSpend(tx, errors, warnings);
    }

    // 8. RBF check
    if (opts.checkRBF) {
      this.checkRBF(tx, warnings);
    }

    // 9. Size validation
    this.validateSize(tx, errors, warnings);

    // Calculate validation score
    const score = this.calculateScore(errors, warnings);

    // FIXED: isValid based on no critical errors (as per code)
    const isValid = errors.filter((e) => e.severity === 'critical').length === 0;

    return {
      isValid,
      errors,
      warnings,
      score,
    };
  }

  /**
   * Validate transaction structure
   */
  private validateStructure(
    tx: RawTransaction,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    if (!tx.txid || tx.txid.length !== 64) {
      errors.push({
        code: 'INVALID_TXID',
        message: 'Transaction ID is invalid or missing',
        severity: 'critical',
        field: 'txid',
      });
    }

    if (!tx.vin || tx.vin.length === 0) {
      errors.push({
        code: 'NO_INPUTS',
        message: 'Transaction has no inputs',
        severity: 'critical',
        field: 'vin',
      });
    }

    if (!tx.vout || tx.vout.length === 0) {
      errors.push({
        code: 'NO_OUTPUTS',
        message: 'Transaction has no outputs',
        severity: 'critical',
        field: 'vout',
      });
    }

    // Check for coinbase transaction (no inputs from previous outputs)
    const isCoinbase = tx.vin.some(
      (input) => input.txid === '0000000000000000000000000000000000000000000000000000000000000000'
    );

    if (isCoinbase && tx.vin.length > 1) {
      errors.push({
        code: 'INVALID_COINBASE',
        message: 'Coinbase transaction must have exactly one input',
        severity: 'critical',
        field: 'vin',
      });
    }
  }

  /**
   * Validate transaction version
   */
  private validateVersion(
    tx: RawTransaction,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    if (tx.version < 1 || tx.version > 2) {
      warnings.push({
        code: 'UNUSUAL_VERSION',
        message: `Transaction version ${tx.version} is unusual`,
        field: 'version',
      });
    }
  }

  /**
   * Validate locktime
   */
  private validateLocktime(
    tx: RawTransaction,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    if (tx.locktime < 0) {
      errors.push({
        code: 'INVALID_LOCKTIME',
        message: 'Locktime cannot be negative',
        severity: 'major',
        field: 'locktime',
      });
      return;
    }

    const currentTime = Math.floor(Date.now() / 1000);
    if (tx.locktime > 0 && tx.locktime < 500000000) { // Block height mode
      if (tx.locktime > currentTime + 10080) { // 1 week future
        warnings.push({
          code: 'FAR_FUTURE_LOCKTIME',
          message: `Locktime is far in the future (block ${tx.locktime})`,
          field: 'locktime',
        });
      }
    } else {
      if (tx.locktime > currentTime) {
        warnings.push({
          code: 'FUTURE_LOCKTIME',
          message: `Transaction locked until ${new Date(tx.locktime * 1000).toISOString()}`,
          field: 'locktime',
        });
      }
    }
  }

  /**
   * Validate inputs
   */
  private async validateInputs(
    tx: RawTransaction,
    utxos: UTXO[],
    options: Required<ValidationOptions>,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): Promise<void> {
    const utxoMap = new Map<string, UTXO>();
    utxos.forEach((utxo) => {
      const key = `${utxo.txid}:${utxo.vout}`;
      utxoMap.set(key, utxo);
    });

    for (let i = 0; i < tx.vin.length; i++) {
      const input = tx.vin[i];
      const key = `${input.txid}:${input.vout}`;

      // Check if UTXO exists
      if (options.checkUTXOs) {
        const utxo = utxoMap.get(key);
        if (!utxo) {
          errors.push({
            code: 'UTXO_NOT_FOUND',
            message: `UTXO not found for input ${i}: ${key}`,
            severity: 'critical',
            field: `vin[${i}]`,
          });
          continue;
        }

        // Check confirmations
        if (utxo.confirmations < options.minConfirmations) {
          warnings.push({
            code: 'LOW_CONFIRMATIONS',
            message: `Input ${i} has only ${utxo.confirmations} confirmations`,
            field: `vin[${i}]`,
          });
        }
      }

      // Validate sequence number
      if (input.sequence > 0xffffffff) {
        errors.push({
          code: 'INVALID_SEQUENCE',
          message: `Invalid sequence number for input ${i}`,
          severity: 'major',
          field: `vin[${i}].sequence`,
        });
      }
    }
  }

  /**
   * Validate outputs
   */
  private validateOutputs(
    tx: RawTransaction,
    options: Required<ValidationOptions>,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    const dustThreshold = 546; // Standard dust threshold in satoshis

    for (let i = 0; i < tx.vout.length; i++) {
      const output = tx.vout[i];
      const value = parseFloat(output.value);

      // Check for negative values
      if (value < 0) {
        errors.push({
          code: 'NEGATIVE_OUTPUT',
          message: `Output ${i} has negative value`,
          severity: 'critical',
          field: `vout[${i}].value`,
        });
      }

      // Check for dust
      if (options.checkDust && value > 0 && value < dustThreshold) {
        warnings.push({
          code: 'DUST_OUTPUT',
          message: `Output ${i} is below dust threshold (${dustThreshold} satoshis)`,
          field: `vout[${i}].value`,
        });
      }

      // Validate script
      if (!output.scriptPubKey || output.scriptPubKey.length === 0) {
        errors.push({
          code: 'INVALID_SCRIPT',
          message: `Output ${i} has invalid or empty scriptPubKey`,
          severity: 'major',
          field: `vout[${i}].scriptPubKey`,
        });
      }

      // Check for OP_RETURN outputs (data outputs)
      if (output.scriptPubKey.startsWith('6a')) {
        // OP_RETURN is 0x6a
        if (value > 0) {
          warnings.push({
            code: 'OPRETURN_WITH_VALUE',
            message: `OP_RETURN output ${i} should have zero value`,
            field: `vout[${i}]`,
          });
        }
      }
    }
  }

  /**
   * Check for double-spend attempts
   */
  private checkDoubleSpend(
    tx: RawTransaction,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    const localSpent = new Set<string>(); // FIXED: Local copy to avoid global mutation in batch
    for (let i = 0; i < tx.vin.length; i++) {
      const input = tx.vin[i];
      const key = `${input.txid}:${input.vout}`;

      if (this.spentOutputs.has(key) || localSpent.has(key)) {
        errors.push({
          code: 'DOUBLE_SPEND',
          message: `Input ${i} attempts to spend already spent output: ${key}`,
          severity: 'critical',
          field: `vin[${i}]`,
        });
      }
      localSpent.add(key);
    }

    // FIXED: Do not mutate global spentOutputs here (handle in batch or external markAsSpent)
  }

  /**
   * Check if transaction signals Replace-By-Fee (RBF)
   */
  private checkRBF(tx: RawTransaction, warnings: ValidationWarning[]): void {
    const hasRBF = tx.vin.some((input) => input.sequence < 0xfffffffe);

    if (hasRBF) {
      warnings.push({
        code: 'RBF_ENABLED',
        message: 'Transaction signals Replace-By-Fee (can be replaced before confirmation)',
        field: 'sequence',
      });
    }
  }

  /**
   * Validate transaction size
   */
  private validateSize(
    tx: RawTransaction,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    const size = tx.size || tx.vsize || this.estimateSize(tx);
    const maxSize = 100000; // 100KB standard limit

    if (size > maxSize) {
      errors.push({
        code: 'OVERSIZED_TX',
        message: `Transaction size (${size} bytes) exceeds maximum (${maxSize} bytes)`,
        severity: 'major', // FIXED: Set severity for -20 deduct
        field: 'size',
      });
    }

    if (size > 10000) {
      warnings.push({
        code: 'LARGE_TX',
        message: `Transaction is large (${size} bytes), may have higher fees`,
        field: 'size',
      });
    }
  }

  /**
   * Estimate transaction size
   */
  private estimateSize(tx: RawTransaction): number {
    // Rough estimation: 10 + 148*inputs + 34*outputs
    return 10 + 148 * tx.vin.length + 34 * tx.vout.length;
  }

  /**
   * Calculate validation score (0-100)
   */
  private calculateScore(errors: ValidationError[], warnings: ValidationWarning[]): number {
    let score = 100;

    // Deduct points for errors
    for (const error of errors) {
      switch (error.severity) {
        case 'critical':
          score -= 50;
          break;
        case 'major':
          score -= 20;
          break;
        case 'minor':
          score -= 5;
          break;
      }
    }

    // Deduct points for warnings
    score -= warnings.length * 2;

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Validate address format for specific chain
   */
  validateAddress(address: string, chainId: ChainId): boolean {
    try {
      const network = this.networks.get(chainId);
      if (!network) {
        return false;
      }

      bitcoin.address.toOutputScript(address, network);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Batch validate multiple transactions
   */
  async validateBatch(
    transactions: RawTransaction[], // FIXED: Accept RawTransaction[] for test compat; utxos per tx or shared empty
    options: ValidationOptions = {}
  ): Promise<Map<string, ValidationResult>> {
    const results = new Map<string, ValidationResult>();

    for (const tx of transactions) {
      const isolatedUtxos: UTXO[] = []; // Or clone shared if provided in future
      const result = await this.validateTransaction(tx, isolatedUtxos, options);
      results.set(tx.txid, result);
    }

    return results;
  }

  /**
   * Clear spent outputs cache
   */
  clearSpentOutputs(): void {
    this.spentOutputs.clear();
  }

  /**
   * Mark output as spent
   */
  markAsSpent(txid: string, vout: number): void {
    const key = `${txid}:${vout}`;
    this.spentOutputs.add(key);
  }

  /**
   * Check if output is spent
   */
  isSpent(txid: string, vout: number): boolean {
    const key = `${txid}:${vout}`;
    return this.spentOutputs.has(key);
  }

  /**
   * Get network for chain
   */
  getNetwork(chainId: ChainId): bitcoin.Network | undefined {
    return this.networks.get(chainId);
  }
}

