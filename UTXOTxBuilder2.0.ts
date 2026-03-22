// server/UTXOTxBuilder2.0.ts
import { ChainId, getChainConfig } from './ChainConfig20'; // Fixed path: dot-free filename from root
import * as bitcoin from 'bitcoinjs-lib'; // npm i bitcoinjs-lib @types/bitcoinjs-lib (for types)

// Custom networks for Scrypt/UTXO chains (bitcoinjs-lib doesn't include all by default)
const customNetworks: Record<ChainId, bitcoin.Network | undefined> = {
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
  // Add more for PEPECOIN, BONKCOIN, etc., as needed (research params)
  [ChainId.SCRYPT]: bitcoin.networks.bitcoin, // Fallback; customize if unique
  [ChainId.PEPECOIN]: bitcoin.networks.bitcoin, // Fallback
  [ChainId.BONKCOIN]: bitcoin.networks.bitcoin, // Fallback
  [ChainId.BELLSCOIN]: bitcoin.networks.bitcoin, // Fallbac
  [ChainId.DINGOCOIN]: bitcoin.networks.bitcoin, // Fallback
  [ChainId.JUNKCOIN]: bitcoin.networks.bitcoin, // Fallback
  [ChainId.SHIBACOIN]: bitcoin.networks.bitcoin, // Fallback
  [ChainId.CATCOIN]: bitcoin.networks.bitcoin, // Fallback
  [ChainId.BEERSCOIN]: bitcoin.networks.bitcoin, // Fallback
  [ChainId.NEWYORKCOIN]: bitcoin.networks.bitcoin, // Fallback
  [ChainId.LUCKYCOIN]: bitcoin.networks.bitcoin, // Fallback
  [ChainId.SOLANA]: undefined, // Non-UTXO; skip or error
  [ChainId.ETHEREUM]: undefined, // Non-UTXO
};

export class UTXOTxBuilder {
  constructor(private chainId: ChainId) {
    if (!customNetworks[this.chainId]) {
      throw new Error(`Unsupported chain for PSBT: ${this.chainId}`);
    }
  }

  buildPsbt(inputs: { txHash: string; vout: number }[], outputs: { address: string; value: number }[], feeRate: number): string {
    const network = this.getNetwork();
    const psbt = new bitcoin.Psbt({ network });
    // Add inputs/outputs (expand with real logic; feeRate for estimation)
    inputs.forEach(input => psbt.addInput({ hash: input.txHash, index: input.vout }));
    outputs.forEach(output => psbt.addOutput({ address: output.address, value: output.value }));
    psbt.finalizeAllInputs();
    return psbt.toHex();
  }

  private getNetwork(): bitcoin.Network {
    return customNetworks[this.chainId]!;
  }
}