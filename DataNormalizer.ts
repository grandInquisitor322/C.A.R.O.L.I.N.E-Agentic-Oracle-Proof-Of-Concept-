/**
 * Multichain Wallet Data Normalizer Functions
 * Handles normalization for various blockchain types including Scrypt coins
 * Refactored to functional style for better testability and coverage
 */

// Types
export interface NormalizedTransaction {
  hash: string;
  blockHeight: number;
  timestamp: number;
  from: string;
  to: string;
  amount: string;
  fee: string;
  confirmations: number;
  status: 'pending' | 'confirmed' | 'failed';
  type: 'send' | 'receive';
}

export interface NormalizedBalance {
  address: string;
  balance: string;
  unconfirmedBalance: string;
  currency: string;
}

export interface NormalizedUTXO {
  txid: string;
  vout: number;
  address: string;
  amount: string;
  confirmations: number;
  spendable: boolean;
}

export interface ChainConfig {
  name: string;
  type: 'utxo' | 'account';
  algorithm: 'scrypt' | 'sha256' | 'ethash' | 'other';
  decimals: number;
  minConfirmations: number;
}

// Chain Configurations
export const CHAIN_CONFIGS: Record<string, ChainConfig> = {
  luckycoin: {
    name: 'LuckyCoin',
    type: 'utxo',
    algorithm: 'scrypt',
    decimals: 8,
    minConfirmations: 6,
  },
  litecoin: {
    name: 'Litecoin',
    type: 'utxo',
    algorithm: 'scrypt',
    decimals: 8,
    minConfirmations: 6,
  },
  dogecoin: {
    name: 'Dogecoin',
    type: 'utxo',
    algorithm: 'scrypt',
    decimals: 8,
    minConfirmations: 6,
  },
  bitcoin: {
    name: 'Bitcoin',
    type: 'utxo',
    algorithm: 'sha256',
    decimals: 8,
    minConfirmations: 6,
  },
  ethereum: {
    name: 'Ethereum',
    type: 'account',
    algorithm: 'ethash',
    decimals: 18,
    minConfirmations: 12,
  },
};

/**
 * Get chain configuration or throw if unsupported
 */
function getChainConfig(chain: string): ChainConfig {
  const config = CHAIN_CONFIGS[chain.toLowerCase()];
  if (!config) {
    throw new Error(`Unsupported chain: ${chain}`);
  }
  return config;
}

/**
 * Format amount to proper decimal places based on chain config
 */
function formatAmount(amount: number | string, config: ChainConfig): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  const divisor = 10 ** config.decimals;
  return (num / divisor).toFixed(config.decimals);
}

/**
 * Determine transaction status based on confirmations and chain config
 */
function getTransactionStatus(confirmations: number, config: ChainConfig): 'pending' | 'confirmed' | 'failed' {
  if (confirmations === 0) return 'pending';
  if (confirmations >= config.minConfirmations) return 'confirmed';
  return 'pending';
}

/**
 * Normalize raw transaction data from various sources
 */
export function normalizeTransaction(
  chain: string,
  rawTx: any,
  userAddress: string
): NormalizedTransaction {
  const config = getChainConfig(chain);

  if (config.type === 'utxo') {
    return normalizeUTXOTransaction(rawTx, userAddress, config);
  } else {
    return normalizeAccountTransaction(rawTx, userAddress, config);
  }
}

/**
 * Normalize UTXO-based transaction (Bitcoin, Litecoin, LuckyCoin, etc.)
 */
function normalizeUTXOTransaction(
  rawTx: any,
  userAddress: string,
  config: ChainConfig
): NormalizedTransaction {
  const inputs = rawTx.vin || rawTx.inputs || [];
  const outputs = rawTx.vout || rawTx.outputs || [];

  // Calculate total input and output for user
  let totalInput = 0;
  let totalOutput = 0;
  let from = '';
  let to = '';

  // Check inputs for user ownership and first from addr
  for (const input of inputs) {
    const addr = input.addr || input.address || input.addresses?.[0];
    if (addr === userAddress) {
      totalInput += parseFloat(input.value || input.amount || '0');
    }
    if (!from && addr) from = addr;
  }

  // Check outputs for user ownership and first to addr
  for (const output of outputs) {
    const addr = output.scriptPubKey?.addresses?.[0] || output.address || output.addr;
    if (addr === userAddress) {
      totalOutput += parseFloat(output.value || output.amount || '0');
    }
    if (!to && addr && addr !== userAddress) to = addr;
  }

  const netAmount = totalOutput - totalInput;
  const type: 'send' | 'receive' = netAmount > 0 ? 'receive' : 'send';

  return {
    hash: rawTx.txid || rawTx.hash || rawTx.id || '',
    blockHeight: rawTx.blockheight || rawTx.block_height || rawTx.height || 0,
    timestamp: rawTx.blocktime || rawTx.time || rawTx.timestamp || Math.floor(Date.now() / 1000),
    from: type === 'send' ? userAddress : from,
    to: type === 'receive' ? userAddress : to,
    amount: formatAmount(Math.abs(netAmount), config),
    fee: formatAmount(rawTx.fee || rawTx.fees || 0, config),
    confirmations: rawTx.confirmations || 0,
    status: getTransactionStatus(rawTx.confirmations || 0, config),
    type,
  };
}

/**
 * Normalize account-based transaction (Ethereum, etc.)
 */
function normalizeAccountTransaction(
  rawTx: any,
  userAddress: string,
  config: ChainConfig
): NormalizedTransaction {
  const from = (rawTx.from || '').toLowerCase();
  const to = (rawTx.to || '').toLowerCase();
  const userAddr = userAddress.toLowerCase();
  const type: 'send' | 'receive' = from === userAddr ? 'send' : 'receive';

  const gasFee = (rawTx.gasUsed || rawTx.gas || 0) * (rawTx.gasPrice || rawTx.effectiveGasPrice || 0);

  return {
    hash: rawTx.hash || rawTx.transactionHash || '',
    blockHeight: rawTx.blockNumber || 0,
    timestamp: rawTx.timestamp || rawTx.timeStamp || Math.floor(Date.now() / 1000),
    from: rawTx.from || '',
    to: rawTx.to || '',
    amount: formatAmount(rawTx.value || 0, config),
    fee: formatAmount(gasFee, config),
    confirmations: rawTx.confirmations || 0,
    status: getTransactionStatus(rawTx.confirmations || 0, config),
    type,
  };
}

/**
 * Normalize balance data
 */
export function normalizeBalance(
  chain: string,
  rawBalance: any,
  address: string
): NormalizedBalance {
  const config = getChainConfig(chain);
  const balance = rawBalance.balance || rawBalance.confirmed || rawBalance.final_balance || 0;
  const unconfirmed =
    rawBalance.unconfirmed_balance || rawBalance.unconfirmed || rawBalance.pending || 0;

  return {
    address,
    balance: formatAmount(balance, config),
    unconfirmedBalance: formatAmount(unconfirmed, config),
    currency: config.name,
  };
}

/**
 * Normalize UTXO data (for UTXO-based chains)
 */
export function normalizeUTXO(
  chain: string,
  rawUtxo: any
): NormalizedUTXO {
  const config = getChainConfig(chain);
  if (config.type !== 'utxo') {
    throw new Error(`UTXO normalization only supported for UTXO chains: ${chain}`);
  }

  return {
    txid: rawUtxo.txid || rawUtxo.tx_hash || rawUtxo.hash || '',
    vout: rawUtxo.vout || rawUtxo.output_index || rawUtxo.index || 0,
    address: rawUtxo.address || rawUtxo.addr || '',
    amount: formatAmount(rawUtxo.value || rawUtxo.amount || 0, config),
    confirmations: rawUtxo.confirmations || 0,
    spendable: (rawUtxo.confirmations || 0) >= config.minConfirmations,
  };
}

/**
 * Check if chain uses Scrypt algorithm
 */
export function isScryptChain(chain: string): boolean {
  const config = getChainConfig(chain);
  return config.algorithm === 'scrypt';
}

// Example usage (for testing)
if (import.meta.url === `file://${process.argv[1]}`) {
  const rawLuckyCoinTx = {
    txid: '1a2b3c4d5e6f7g8h9i0j',
    blockheight: 150000,
    blocktime: 1703980800,
    confirmations: 10,
    vin: [
      {
        address: 'LKyAddress1234567890',
        value: 100000000, // 1 LKY in satoshis
      },
    ],
    vout: [
      {
        scriptPubKey: {
          addresses: ['LKyAddress9876543210'],
        },
        value: 95000000, // 0.95 LKY
      },
    ],
    fee: 5000000, // 0.05 LKY
  };

  const normalizedTx = normalizeTransaction('luckycoin', rawLuckyCoinTx, 'LKyAddress1234567890');
  console.log('Normalized Transaction:', normalizedTx);
  console.log('Is Scrypt Chain:', isScryptChain('luckycoin'));
}