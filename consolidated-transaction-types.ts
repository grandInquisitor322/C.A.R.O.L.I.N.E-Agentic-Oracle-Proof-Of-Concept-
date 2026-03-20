/**
 * consolidated-transaction-types.ts
 *
 * Consolidated from:
 *   - transaction-types.ts
 *   - ChainSpecificTypes.ts
 *   - NormalizedTransactionTypes.ts
 *
 * Supports UTXO-based chains (Bitcoin, Litecoin, Dogecoin, etc.),
 * account-based (Ethereum), and Solana. Includes chain-specific
 * enrichment, normalized transaction structures, and UTXO monitoring types.
 */

import { ChainId } from './ChainConfig20';
import { describe, it, test, expect, beforeEach, afterEach, vi } from 'vitest';

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 1 — SHARED ENUMS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Normalized chain type labels (used in NormalizedTransaction).
 * Mirrors ChainId but as plain string values for external/API use.
 */
export enum ChainType {
  BELLSCOIN   = 'bellscoin',
  BEERSCOIN   = 'beerscoin',
  BITCOIN     = 'bitcoin',
  BONKCOIN    = 'bonkcoin',
  CATCOIN     = 'catcoin',
  DIGIBYTE    = 'digibyte',
  DOGECOIN    = 'dogecoin',
  ETHEREUM    = 'ethereum',
  LITECOIN    = 'litecoin',
  LUCKYCOIN   = 'luckycoin',
  NEWYORKCOIN = 'newyorkcoin',
  PEPECOIN    = 'pepecoin',
  SCRYPT      = 'scrypt',
  SHIBACOIN   = 'shibacoin',
  SOLANA      = 'solana',
}

export enum TransactionStatus {
  PENDING     = 'pending',
  CONFIRMED   = 'confirmed',
  UNCONFIRMED = 'unconfirmed',
  FAILED      = 'failed',
}

/**
 * Address type enum — used in chain-specific UTXO enrichment.
 */
export enum AddressType {
  P2PKH     = 'p2pkh',       // Legacy pay-to-pubkey-hash
  P2SH      = 'p2sh',        // Pay-to-script-hash (Scrypt-friendly for contracts)
  P2WPKH    = 'p2wpkh',      // SegWit v0 pay-to-witness-pubkey-hash
  P2WSH     = 'p2wsh',       // SegWit v0 pay-to-witness-script-hash
  LUCKY_P2LKH = 'lucky-p2lkh', // Hypothetical Luckycoin legacy variant
}

/**
 * Script type enum — used in both normalized and chain-specific layers.
 * NOTE: NormalizedTransactionTypes used a separate ScriptType with P2TR/UNKNOWN;
 * those values are merged in here.
 */
export enum ScriptType {
  // Normalized layer values
  P2PKH           = 'p2pkh',
  P2SH            = 'p2sh',
  P2WPKH          = 'p2wpkh',
  P2WSH           = 'p2wsh',
  P2TR            = 'p2tr',          // Pay to Taproot
  MULTISIG        = 'multisig',
  UNKNOWN         = 'unknown',
  // Chain-specific extensions
  STANDARD        = 'standard',
  SCRYPT_CONTRACT = 'scrypt-contract', // Scrypt-locked outputs (e.g., smart contracts)
  OP_RETURN       = 'op_return',
  LUCKY_CLAIM     = 'lucky-claim-script', // For Luckycoin's claim mechanics
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 2 — BASE TRANSACTION TYPES (from transaction-types.ts)
// ─────────────────────────────────────────────────────────────────────────────

export interface BaseTransaction {
  id: string;
  chainId: ChainId;
  kind: 'utxo' | 'account' | 'solana';
  version?: number;
  timestamp?: number;
  blockHash?: string;
  blockHeight?: number;
  blockTime?: number;
  confirmations?: number;
  timeFirstSeen?: number;
  fee?: number | string;
  size?: number;
  isCoinbase?: boolean;
  relayedBy?: string;
}

export interface Script {
  asm: string;
  hex: string;
  type: string;
  reqSigs?: number;
  addresses?: string[];
}

export interface TxInput {
  txid: string;
  vout: number;
  prevOut?: TxOutput;
  scriptSig?: Script;
  sequence: number;
  witness?: string[];
}

export interface TxOutput {
  value: number | string;
  n: number;
  scriptPubKey: Script;
  spentTxId?: string;
  spentIndex?: number;
  spentHeight?: number;
}

export interface UtxoTransaction extends BaseTransaction {
  kind: 'utxo';
  locktime: number;
  inputs: TxInput[];
  outputs: TxOutput[];
  vsize?: number;
  weight?: number;
}

export interface EthTransaction extends BaseTransaction {
  kind: 'account';
  from: string;
  to?: string;
  value: string;
  nonce: number;
  gas: number;
  gasPrice?: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
  input: string;
  r: string;
  s: string;
  v: number | string;
  type?: 0 | 1 | 2;
  accessList?: { address: string; storageKeys: string[] }[];
  eip155ChainId?: number;
}

export interface SolanaInstruction {
  programIdIndex: number;
  accounts: number[];
  data: string;
}

export interface SolanaAddressTableLookup {
  accountKey: string;
  writableIndexes: number[];
  readonlyIndexes: number[];
}

export interface SolanaMessage {
  header: {
    numRequiredSignatures: number;
    numReadonlySignedAccounts: number;
    numReadonlyUnsignedAccounts: number;
  };
  accountKeys: string[];
  recentBlockhash: string;
  instructions: SolanaInstruction[];
  optionaladdressTableLookups?: SolanaAddressTableLookup[];
  version?: 0;
  addressTableLookups?: SolanaAddressTableLookup[];
}

export interface SolanaTransaction extends BaseTransaction {
  kind: 'solana';
  signature: string;
  message: SolanaMessage;
  slot?: number;
  blockTime?: number;
  meta?: {
    err: any;
    fee: number;
    preBalances: number[];
    postBalances: number[];
    logMessages?: string[];
    preTokenBalances?: any[];
    postTokenBalances?: any[];
    rewards?: any[];
  };
}

export type Transaction = UtxoTransaction | EthTransaction | SolanaTransaction;

export interface Utxo {
  txid: string;
  vout: number;
  value: number | string;
  scriptPubKey: string;
  confirmations: number;
  blockHeight?: number;
  address?: string;
}

export interface TransactionWithUtxos extends UtxoTransaction {
  utxos: Utxo[];
}

export interface TxEvent {
  tx: Transaction;
  eventType: 'mempool' | 'confirmed' | 'double-spend' | 'reorg' | 'failed';
  timestamp: number;
  nodeId?: string;
}

export type TxStatus = 'pending' | 'confirmed' | 'failed' | 'replaced';

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 3 — TYPE GUARDS & HELPERS (from transaction-types.ts)
// ─────────────────────────────────────────────────────────────────────────────

export function getTransactionKind(chainId: ChainId): 'utxo' | 'account' | 'solana' {
  switch (chainId) {
    case ChainId.ETHEREUM: return 'account';
    case ChainId.SOLANA:   return 'solana';
    default:               return 'utxo';
  }
}

export function isUtxoTransaction(tx: Transaction): tx is UtxoTransaction {
  return tx.kind === 'utxo';
}

export function isEthTransaction(tx: Transaction): tx is EthTransaction {
  return tx.kind === 'account';
}

export function isSolanaTransaction(tx: Transaction): tx is SolanaTransaction {
  return tx.kind === 'solana';
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 4 — CHAIN CONFIG (from ChainSpecificTypes.ts)
// ─────────────────────────────────────────────────────────────────────────────

export interface ChainConfig {
  chainId: ChainId;
  networkMagic: number;
  pubKeyHash: number;
  scriptHash: number;
  witnessVersion: number;
  supportsScrypt: boolean;
  maxBlockSize?: number;
  luckyOpcodePrefix?: number;
}

export const CHAIN_CONFIGS: Partial<Record<ChainId, ChainConfig>> = {
  [ChainId.BITCOIN]: {
    chainId: ChainId.BITCOIN,
    networkMagic: 0xd9b4bef9,
    pubKeyHash: 0x00,
    scriptHash: 0x05,
    witnessVersion: 0,
    supportsScrypt: false,
    maxBlockSize: 4000000,
  },
  [ChainId.SCRYPT]: {
    chainId: ChainId.SCRYPT,
    networkMagic: 0xd9b4bef9,
    pubKeyHash: 0x00,
    scriptHash: 0x05,
    witnessVersion: 0,
    supportsScrypt: true,
    maxBlockSize: 1000000,
  },
  [ChainId.DOGECOIN]: {
    chainId: ChainId.DOGECOIN,
    networkMagic: 0xc0c0c0c0,
    pubKeyHash: 0x1e,
    scriptHash: 0x16,
    witnessVersion: 0,
    supportsScrypt: true,
    maxBlockSize: 1000000,
  },
  [ChainId.LITECOIN]: {
    chainId: ChainId.LITECOIN,
    networkMagic: 0xfbc0b6db,
    pubKeyHash: 0x30,
    scriptHash: 0x32,
    witnessVersion: 0,
    supportsScrypt: true,
    maxBlockSize: 4194304,
  },
  [ChainId.DIGIBYTE]: {
    chainId: ChainId.DIGIBYTE,
    networkMagic: 0x0699e07e,
    pubKeyHash: 0x1e,
    scriptHash: 0x03,
    witnessVersion: 0,
    supportsScrypt: true,
    maxBlockSize: 2000000,
  },
  [ChainId.LUCKYCOIN]: {
    chainId: ChainId.LUCKYCOIN,
    networkMagic: 0xfbc0b6db,
    pubKeyHash: 0x30,
    scriptHash: 0x32,
    witnessVersion: 0,
    supportsScrypt: true,
    luckyOpcodePrefix: 0xab,
    maxBlockSize: 1000000,
  },
  [ChainId.PEPECOIN]: {
    chainId: ChainId.PEPECOIN,
    networkMagic: 0xfbc0b6db,
    pubKeyHash: 0x30,
    scriptHash: 0x32,
    witnessVersion: 0,
    supportsScrypt: true,
    maxBlockSize: 1000000,
  },
  [ChainId.BONKCOIN]: {
    chainId: ChainId.BONKCOIN,
    networkMagic: 0xfbc0b6db,
    pubKeyHash: 0x30,
    scriptHash: 0x32,
    witnessVersion: 0,
    supportsScrypt: true,
    maxBlockSize: 1000000,
  },
  [ChainId.BELLSCOIN]: {
    chainId: ChainId.BELLSCOIN,
    networkMagic: 0xfbc0b6db,
    pubKeyHash: 0x30,
    scriptHash: 0x32,
    witnessVersion: 0,
    supportsScrypt: true,
    maxBlockSize: 1000000,
  },
  [ChainId.SHIBACOIN]: {
    chainId: ChainId.SHIBACOIN,
    networkMagic: 0xfbc0b6db,
    pubKeyHash: 0x30,
    scriptHash: 0x32,
    witnessVersion: 0,
    supportsScrypt: true,
    maxBlockSize: 1000000,
  },
  [ChainId.CATCOIN]: {
    chainId: ChainId.CATCOIN,
    networkMagic: 0xfbc0b6db,
    pubKeyHash: 0x30,
    scriptHash: 0x32,
    witnessVersion: 0,
    supportsScrypt: true,
    maxBlockSize: 1000000,
  },
  [ChainId.BEERSCOIN]: {
    chainId: ChainId.BEERSCOIN,
    networkMagic: 0xfbc0b6db,
    pubKeyHash: 0x30,
    scriptHash: 0x32,
    witnessVersion: 0,
    supportsScrypt: true,
    maxBlockSize: 1000000,
  },
  [ChainId.NEWYORKCOIN]: {
    chainId: ChainId.NEWYORKCOIN,
    networkMagic: 0xfbc0b6db,
    pubKeyHash: 0x30,
    scriptHash: 0x32,
    witnessVersion: 0,
    supportsScrypt: true,
    maxBlockSize: 1000000,
  },
  [ChainId.DINGOCOIN]: {
    chainId: ChainId.DINGOCOIN,
    networkMagic: 0xc1c1c1c1,
    pubKeyHash: 0x1e,
    scriptHash: 0x16,
    witnessVersion: 0,
    supportsScrypt: true,
    maxBlockSize: 1000000,
  },
};

export const getChainConfig = (chainId: ChainId): ChainConfig => {
  const config = CHAIN_CONFIGS[chainId];
  if (!config) throw new Error(`Unsupported chain: ${chainId}`);
  return config;
};

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 5 — CHAIN-SPECIFIC UTXO & TX TYPES (from ChainSpecificTypes.ts)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Chain-specific UTXO — extends the base Utxo with enriched typing and
 * optional monitoring/storage fields.
 */
export type ChainSpecificUtxo = Omit<Utxo, 'addressType' | 'scriptType'> & {
  chainId: ChainId;
  addressType: AddressType;
  scriptType: ScriptType;
  config: ChainConfig;
  witnessData?: string[];
  scryptContractData?: string;
  luckyClaimScript?: string;
  timestamp?: Date | string | number;
  spent?: boolean;
  spentTxId?: string;
  spentHeight?: number;
};

export type ChainSpecificTxInput = TxInput & {
  chainId: ChainId;
  addressType?: AddressType;
  scriptType?: ScriptType;
};

export type ChainSpecificTxOutput = TxOutput & {
  chainId: ChainId;
  addressType: AddressType;
  scriptType: ScriptType;
  value?: bigint;
};

export type ChainSpecificUtxoTransaction = UtxoTransaction & {
  chainId: ChainId;
  inputs: ChainSpecificTxInput[];
  outputs: ChainSpecificTxOutput[];
  scryptEvents?: Array<{ type: 'unlock' | 'lock'; script: string }>;
};

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 6 — CHAIN ENRICHMENT FUNCTIONS (from ChainSpecificTypes.ts)
// ─────────────────────────────────────────────────────────────────────────────

export function enrichWithChainSpecifics(
  tx: UtxoTransaction,
  config: ChainConfig
): ChainSpecificUtxoTransaction {
  if (!isUtxoTransaction(tx)) {
    throw new Error('Only UTXO transactions supported for chain specifics');
  }

  const enrichedInputs = tx.inputs.map(input => ({
    ...input,
    chainId: config.chainId,
    addressType: inferAddressType(input.scriptSig?.type || ''),
    scriptType: inferScriptType(input.scriptSig?.type || ''),
  })) as ChainSpecificTxInput[];

  const enrichedOutputs = tx.outputs.map(output => ({
    ...output,
    chainId: config.chainId,
    addressType: inferAddressType(output.scriptPubKey.type),
    scriptType: inferScriptType(output.scriptPubKey.type),
    value: BigInt(output.value as string | number),
  })) as ChainSpecificTxOutput[];

  return {
    ...tx,
    chainId: config.chainId,
    inputs: enrichedInputs,
    outputs: enrichedOutputs,
  };
}

function inferAddressType(scriptType: string): AddressType {
  if (scriptType.includes('pubkeyhash'))         return AddressType.P2PKH;
  if (scriptType.includes('scripthash'))          return AddressType.P2SH;
  if (scriptType.includes('witness_v0_keyhash'))  return AddressType.P2WPKH;
  if (scriptType.includes('lucky'))               return AddressType.LUCKY_P2LKH;
  return AddressType.P2PKH;
}

function inferScriptType(scriptType: string): ScriptType {
  if (scriptType.includes('scrypt'))       return ScriptType.SCRYPT_CONTRACT;
  if (scriptType.includes('lucky-claim')) return ScriptType.LUCKY_CLAIM;
  if (scriptType === 'multisig')           return ScriptType.MULTISIG;
  return ScriptType.STANDARD;
}

export function validateChainSpecificUtxo(utxo: ChainSpecificUtxo): boolean {
  const config = getChainConfig(utxo.chainId);
  if (!config.supportsScrypt && utxo.scriptType === ScriptType.SCRYPT_CONTRACT) {
    return false;
  }
  if (
    utxo.chainId === ChainId.LUCKYCOIN &&
    !utxo.luckyClaimScript &&
    utxo.scriptType === ScriptType.LUCKY_CLAIM
  ) {
    return false;
  }
  if (utxo.spent === true) {
    if (!utxo.spentTxId || typeof utxo.spentHeight !== 'number') {
      return false;
    }
  }
  return true;
}

export function mockChainSpecificUtxo(chainId: ChainId = ChainId.BITCOIN): ChainSpecificUtxo {
  const config = getChainConfig(chainId);
  return {
    txid: 'mock-txid-123',
    vout: 0,
    value: '100000',
    scriptPubKey: '76a914mock-pubkey-hash88ac',
    confirmations: 6,
    blockHeight: 800000,
    address: 'mock-address',
    chainId,
    addressType: AddressType.P2PKH,
    scriptType: ScriptType.STANDARD,
    config,
    scryptContractData: chainId === ChainId.SCRYPT ? 'scrypt-mock-hex' : undefined,
    luckyClaimScript: chainId === ChainId.LUCKYCOIN ? 'lucky-mock-script' : undefined,
    timestamp: new Date().toISOString(),
    spent: false,
    spentTxId: undefined,
    spentHeight: undefined,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 7 — NORMALIZED TRANSACTION TYPES (from NormalizedTransactionTypes.ts)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Normalized UTXO Input — for external/API representations.
 */
export interface NormalizedInput {
  txid: string;
  vout: number;
  scriptSig?: string;
  scriptSigAsm?: string;
  sequence: number;
  witness?: string[];
  prevout?: {
    scriptPubKey: string;
    scriptPubKeyAsm?: string;
    scriptPubKeyType?: ScriptType;
    value: string;
    address?: string;
  };
  coinbase?: string;
}

/**
 * Normalized UTXO Output — for external/API representations.
 */
export interface NormalizedOutput {
  value: string;
  n: number;
  scriptPubKey: string;
  scriptPubKeyAsm?: string;
  scriptPubKeyType: ScriptType;
  address?: string;
  addresses?: string[];
  spent?: boolean;
  spentTxid?: string;
  spentIndex?: number;
}

export interface TransactionFee {
  amount: string;
  rate?: number;
  size: number;
  vsize?: number;
  weight?: number;
}

export interface BlockInfo {
  hash: string;
  height: number;
  timestamp: number;
  confirmations: number;
}

export interface NormalizedTransaction {
  chain: ChainType;
  network: 'mainnet' | 'testnet';
  txid: string;
  hash: string;
  version: number;
  inputs: NormalizedInput[];
  outputs: NormalizedOutput[];
  locktime: number;
  totalInput: string;
  totalOutput: string;
  fee: TransactionFee;
  status: TransactionStatus;
  blockInfo?: BlockInfo;
  firstSeen?: number;
  confirmedAt?: number;
  isCoinbase: boolean;
  isSegWit: boolean;
  isRBF: boolean;
  size: number;
  vsize?: number;
  weight?: number;
  hex?: string;
}

export interface WalletTransaction {
  transaction: NormalizedTransaction;
  walletAddresses: string[];
  received: string;
  sent: string;
  netChange: string;
  direction: 'incoming' | 'outgoing' | 'self';
  relatedTxids?: string[];
  label?: string;
  notes?: string;
  tags?: string[];
}

export interface UTXOEntry {
  txid: string;
  vout: number;
  address: string;
  scriptPubKey: string;
  scriptPubKeyType: ScriptType;
  amount: string;
  confirmations: number;
  spendable: boolean;
  solvable: boolean;
  safe: boolean;
  chain: ChainType;
  blockHeight?: number;
  timestamp?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 8 — TRANSACTION NORMALIZER (from NormalizedTransactionTypes.ts)
// ─────────────────────────────────────────────────────────────────────────────

export class TransactionNormalizer {
  static calculateTotalInput(inputs: NormalizedInput[]): string {
    return inputs.reduce((sum, input) => {
      const value = input.prevout?.value || '0';
      return (BigInt(sum) + BigInt(value)).toString();
    }, '0');
  }

  static calculateTotalOutput(outputs: NormalizedOutput[]): string {
    return outputs.reduce(
      (sum, output) => (BigInt(sum) + BigInt(output.value)).toString(),
      '0'
    );
  }

  static calculateFee(totalInput: string, totalOutput: string): string {
    return (BigInt(totalInput) - BigInt(totalOutput)).toString();
  }

  static isSegWitTransaction(inputs: NormalizedInput[]): boolean {
    return inputs.some(input => input.witness && input.witness.length > 0);
  }

  static isRBFEnabled(inputs: NormalizedInput[]): boolean {
    return inputs.some(input => input.sequence < 0xfffffffe);
  }

  static satoshisToCoin(satoshis: string, decimals: number = 8): string {
    const value = BigInt(satoshis);
    const divisor = BigInt(10 ** decimals);
    const whole = value / divisor;
    const remainder = value % divisor;
    return `${whole}.${remainder.toString().padStart(decimals, '0')}`;
  }

  static coinToSatoshis(amount: string, decimals: number = 8): string {
    const [whole, fraction = ''] = amount.split('.');
    const paddedFraction = fraction.padEnd(decimals, '0').slice(0, decimals);
    return (BigInt(whole) * BigInt(10 ** decimals) + BigInt(paddedFraction)).toString();
  }
}

export default NormalizedTransaction;
