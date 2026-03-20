import * as bitcoin from 'bitcoinjs-lib';
import { ChainId } from './ChainConfig20'; // Assuming ChainConfig20.ts exists
import type { TxOutput } from 'bitcoinjs-lib';

const customNetworks: Partial<Record<ChainId, bitcoin.Network>> = {
  [ChainId.BITCOIN]: bitcoin.networks.bitcoin,
  [ChainId.LITECOIN]: {
    messagePrefix: '\x19Litecoin Signed Message:\n',
    bech32: 'ltc',
    bip32: { public: 0x019da462, private: 0x019d9cfe },
    pubKeyHash: 0x30,
    scriptHash: 0x32,
    wif: 0xb0,
  },
  [ChainId.DOGECOIN]: {
    messagePrefix: '\x19Dogecoin Signed Message:\n',
    bech32: 'dogecoin',
    bip32: { public: 0x02facafd, private: 0x02fa58ef },
    pubKeyHash: 0x1e,
    scriptHash: 0x16,
    wif: 0x9e,
  },
  [ChainId.DIGIBYTE]: {
    messagePrefix: '\x19DigiByte Signed Message:\n',
    bech32: 'dgb',
    bip32: { public: 0x0488b21e, private: 0x0488ade4 },
    pubKeyHash: 0x1e,
    scriptHash: 0x3f,
    wif: 0x80,
  },
  [ChainId.LUCKYCOIN]: {
    messagePrefix: '\x19Luckycoin Signed Message:\n',
    bech32: 'lky',  // Bech32 HRP for Luckycoin
    bip32: { public: 0x0488b21e, private: 0x0488ade4 }, // Using Bitcoin's BIP32 prefixes
    pubKeyHash: 0x1e, // Luckycoin P2PKH prefix
    scriptHash: 0x3f, // Luckycoin P2SH prefix  
    wif: 0x80, // Private key prefix
  },
  [ChainId.SHIBACOIN]: {
    messagePrefix: '\x19Shibacoin Signed Message:\n',
    bech32: 'shiba',  // Bech32 HRP for Shibacoin    
    bip32: { public: 0x0488b21e, private: 0x0488ade4 }, // Using Bitcoin's BIP32 prefixes 
    pubKeyHash: 0x30, // Shibacoin P2PKH prefix 
    scriptHash: 0x32, // Shibacoin P2SH prefix 
    wif: 0xb0, // Private key prefix    
  }, 
  [ChainId.CATCOIN]: {
    messagePrefix: '\x19Catcoin Signed Message:\n',
    bech32: 'cat',  // Bech32 HRP for Catcoin    
    bip32: { public: 0x0488b21e, private: 0x0488ade4 }, // Using Bitcoin's BIP32 prefixes 
    pubKeyHash: 0x30, // Catcoin P2PKH prefix 
    scriptHash: 0x32, // Catcoin P2SH prefix 
    wif: 0xb0, // Private key prefix    
  }, 
  [ChainId.BEERSCOIN]: {
    messagePrefix: '\x19Beerscoin Signed Message:\n',
    bech32: 'beers',  // Bech32 HRP for Beerscoin    
    bip32: { public: 0x0488b21e, private: 0x0488ade4 }, // Using Bitcoin's BIP32 prefixes 
    pubKeyHash: 0x30, // Beerscoin P2PKH prefix 
    scriptHash: 0x32, // Beerscoin P2SH prefix 
    wif: 0xb0, // Private key prefix    
  },
  [ChainId.BONKCOIN]: {
    messagePrefix: '\x19Bonkcoin Signed Message:\n',
    bech32: 'bonk',  // Bech32 HRP for Bonkcoin    
    bip32: { public: 0x0488b21e, private: 0x0488ade4 }, // Using Bitcoin's BIP32 prefixes 
    pubKeyHash: 0x30, // Bonkcoin P2PKH prefix 
    scriptHash: 0x32, // Bonkcoin P2SH prefix 
    wif: 0xb0, // Private key prefix    
  },
  [ChainId.DINGOCOIN]: {
    messagePrefix: '\x19Dingocoin Signed Message:\n',
    bech32: 'dingo',  // Bech32 HRP for Dingocoin    
    bip32: { public: 0x0488b21e, private: 0x0488ade4 }, // Using Bitcoin's BIP32 prefixes       
    pubKeyHash: 0x30, // Dingocoin P2PKH prefix 
    scriptHash: 0x32, // Dingocoin P2SH prefix 
    wif: 0xb0, // Private key prefix    
  },
  [ChainId.JUNKCOIN]: {
    messagePrefix: '\x19Junkcoin Signed Message:\n',
    bech32: 'junk',  // Bech32 HRP for Junkcoin   
    bip32: { public: 0x0488b21e, private: 0x0488ade4 }, // Using Bitcoin's BIP32 prefixes      
    pubKeyHash: 0x30, // Junkcoin P2PKH prefix 
    scriptHash: 0x32, // Junkcoin P2SH prefix 
    wif: 0xb0, // Private key prefix    
  },
   [ChainId.NEWYORKCOIN]: {
    messagePrefix: '\x19NewYorkcoin Signed Message:\n',
    bech32: 'nyc',  // Bech32 HRP for NewYorkcoin    
    bip32: { public: 0x0488b21e, private: 0x0488ade4 }, // Using Bitcoin's BIP32 prefixes 
    pubKeyHash: 0x30, // NewYorkcoin P2PKH prefix 
    scriptHash: 0x32, // NewYorkcoin P2SH prefix 
    wif: 0xb0, // Private key prefix    
  },
  [ChainId.BELLSCOIN]: {
    messagePrefix: '\x19Bellscoin Signed Message:\n',
    bech32: 'bells',  // Bech32 HRP for Bellscoin    
    bip32: { public: 0x0488b21e, private: 0x0488ade4 }, // Using Bitcoin's BIP32 prefixes 
    pubKeyHash: 0x30, // Bellscoin P2PKH prefix 
    scriptHash: 0x32, // Bellscoin P2SH prefix 
    wif: 0xb0, // Private key prefix    
  },
  [ChainId.PEPECOIN]: {
    messagePrefix: '\x19Pepecoin Signed Message:\n',
    bech32: 'pepe',  // Bech32 HRP for Pepecoin    
    bip32: { public: 0x0488b21e, private: 0x0488ade4 }, // Using Bitcoin's BIP32 prefixes 
    pubKeyHash: 0x30, // Pepecoin P2PKH prefix  
    scriptHash: 0x32, // Pepecoin P2SH prefix 
    wif: 0xb0, // Private key prefix    
  },
  [ChainId.SCRYPT]: {
    messagePrefix: '\x19Scryptcoin Signed Message:\n',
    bech32: 'scrypt',  // Bech32 HRP for Scryptcoin    
    bip32: { public: 0x0488b21e, private: 0x0488ade4 }, // Using Bitcoin's BIP32 prefixes    
    pubKeyHash: 0x30, // Scryptcoin P2PKH prefix    
    scriptHash: 0x32, // Scryptcoin P2SH prefix    
    wif: 0xb0, // Private key prefix    
  },
};

export interface CategorizedTransaction {
  txId: string;
  chainId: ChainId;
  category: TransactionCategory;
  details: {
    inputsCount: number;
    outputsCount: number;
    totalInputValue: bigint; // Changed to bigint
    totalOutputValue: bigint; // Changed to bigint
    fee: bigint; // Changed to bigint
    isIncoming: boolean;
    opReturnData?: Buffer;
    splinterOps?: Array<{ type: string; data: Buffer }>;
    error?: string; // New: For fallbacks
  };
  timestamp?: Date;
}

export class TransactionCategorizer {
  private dustThreshold: bigint = 546n; // bigint; chain-specific

  constructor(private chainId: ChainId) {
    if (this.chainId === ChainId.LUCKYCOIN) {
      this.dustThreshold = 100n; // Lower for LKY
    }
  }

  private getNetwork(): bitcoin.Network {
    return customNetworks[this.chainId] || bitcoin.networks.bitcoin; // Fallback to Bitcoin network
  }

  categorize(txHex: string, monitoredAddress?: string): CategorizedTransaction {
    let tx: bitcoin.Transaction;
    let parseError: string | undefined;
    try {
      tx = bitcoin.Transaction.fromHex(txHex);
    } catch (error) {
      parseError = error instanceof Error ? error.message : 'Unknown parse error';
      // Fallback: Minimal object (no tx access)
      return {
        txId: 'fallback-txid',
        chainId: this.chainId,
        category: TransactionCategory.TRANSFER,
        details: {
          inputsCount: 0,
          outputsCount: 0,
          totalInputValue: 0n,
          totalOutputValue: 0n,
          fee: 0n,
          isIncoming: false,
          error: parseError,
        },
      };
    }

    const network = this.getNetwork();
    const inputsCount = tx.ins?.length ?? 0;
    const outputsCount = tx.outs?.length ?? 0;
    const totalInputValue = 0n; // RPC needed for real
    const totalOutputValue = tx.outs.reduce((sum, output) => {
      const val = (output && typeof output.value === 'number') ? BigInt(output.value) : 0n;
      return sum + val;
    }, 0n);
    const fee = 0n; // Placeholder

    const outputValues = tx.outs
      .map(output => (output && typeof output.value === 'number') ? output.value : 0)
      .filter(v => v > 0);
    const maxOutputValue = outputValues.length > 0 ? Math.max(...outputValues) : 0;
    const isDust = BigInt(maxOutputValue) <= this.dustThreshold;

    let hasOpReturn = false;
    let opReturnData: Buffer | undefined;
    let splinterOps: Array<{ type: string; data: Buffer }> | undefined;
    let scriptError: string | undefined;

    try {
      hasOpReturn = this.hasOpReturnOutput(tx);
      if (hasOpReturn) {
        opReturnData = this.extractOpReturnData(tx);
        if (this.chainId === ChainId.LUCKYCOIN && opReturnData) {
          splinterOps = this.decodeSplinterData(opReturnData);
        }
      }
    } catch (error) {
      scriptError = error instanceof Error ? error.message : 'Script decode error';
    }

    const isConsolidation = inputsCount > 1 && outputsCount === 1 && !hasOpReturn;

    let category: TransactionCategory;
    if (isDust) {
      category = TransactionCategory.DUST;
    } else if (isConsolidation) {
      category = TransactionCategory.CONSOLIDATION;
    } else if (hasOpReturn) {
      category = this.chainId === ChainId.LUCKYCOIN && splinterOps && splinterOps.length > 0
        ? TransactionCategory.SPLINTER
        : TransactionCategory.OP_RETURN;
    } else {
      category = TransactionCategory.TRANSFER;
    }

    const details: CategorizedTransaction['details'] = {
      inputsCount,
      outputsCount,
      totalInputValue,
      totalOutputValue,
      fee,
      isIncoming: monitoredAddress ? this.isIncomingToAddress(tx, monitoredAddress, network) : false,
      opReturnData,
      splinterOps,
      error: scriptError,
    };

    return {
      txId: tx.getId(),
      chainId: this.chainId,
      category,
      details,
    };
  }

  batchCategorize(txHexes: string[], monitoredAddress?: string): CategorizedTransaction[] {
    return txHexes.map(txHex => this.categorize(txHex, monitoredAddress));
  }

 private extractOpReturnData(tx: bitcoin.Transaction): Buffer | undefined {
  const opReturnOutput = tx.outs?.find(output => {
    if (!output?.script || !Buffer.isBuffer(output.script) || output.script.length < 2) {
      return false;
    }
    return output.script[0] === bitcoin.opcodes.OP_RETURN;  // 0x6a
  });

  if (!opReturnOutput?.script) return undefined;

  const script = opReturnOutput.script;
  const opcodeLen = script[1];  // Assume single-byte push (0-75); common for OP_RETURN

  if (opcodeLen > 75 || 2 + opcodeLen > script.length) return undefined;  // Invalid or OOB

  // Slice data (post-0x6a + len byte)
  return script.slice(2, 2 + opcodeLen);
}

// Update this method too (replace the old hasOpReturnOutput)
private hasOpReturnOutput(tx: bitcoin.Transaction): boolean {
  return (tx.outs || []).some(output => {
    if (!output?.script || !Buffer.isBuffer(output.script) || output.script.length < 2) {
      return false;
    }
    return output.script[0] === bitcoin.opcodes.OP_RETURN;  // Simple & robust
  });
}

  private decodeSplinterData(payload: Buffer): Array<{ type: string; data: Buffer }> {
    const ops: Array<{ type: string; data: Buffer }> = [];
    try {
      if (payload.length < 1) throw new Error('Payload too short');
      let offset = 0;
      const numOps = payload.readUInt8(offset++);
      if (numOps === 0 || offset + numOps > payload.length) throw new Error('Invalid numOps or bounds');
      for (let i = 0; i < numOps; i++) {
        // Null-terminated type
        const typeEnd = payload.indexOf(0, offset);
        if (typeEnd === -1) throw new Error(`Unexpected data: No null terminator at op ${i}`);
        const type = payload.slice(offset, typeEnd).toString('utf8');
        offset = typeEnd + 1;
        if (offset >= payload.length) throw new Error(`Unexpected end after type ${i}`);
        const dataLen = payload.readUInt8(offset++);
        if (offset + dataLen > payload.length) throw new Error(`Unexpected data length at op ${i}`);
        const data = payload.slice(offset, offset + dataLen);
        offset += dataLen;
        ops.push({ type, data });
      }
      if (offset !== payload.length) throw new Error('Unexpected trailing data');
    } catch (error) {
      console.warn(`Splinter decode failed: ${error instanceof Error ? error.message : 'Unknown'}`);
      return []; // Graceful: Empty array instead of undefined
    }
    return ops;
  }

  private isIncomingToAddress(tx: bitcoin.Transaction, address: string, network: bitcoin.Network): boolean {
    try {
      const outputScript = bitcoin.address.toOutputScript(address, network);
      return (tx.outs || []).some(output => {
        if (!output || !output.script) return false;
        return output.script.equals(outputScript);
      });
    } catch (error) {
      console.warn(`Invalid address ${address}: ${error instanceof Error ? error.message : 'Unknown'}`);
      return false;
    }
  }

  setDustThreshold(threshold: number): void {
    this.dustThreshold = BigInt(threshold);
  }
}

export enum TransactionCategory {
  TRANSFER = 'TRANSFER',
  CONSOLIDATION = 'CONSOLIDATION',
  DUST = 'DUST',
  OP_RETURN = 'OP_RETURN',
  SPLINTER = 'SPLINTER',
  UNKNOWN = 'UNKNOWN',
}