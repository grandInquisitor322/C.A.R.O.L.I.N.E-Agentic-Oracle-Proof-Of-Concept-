export enum ChainId {
  BELLSCOIN = 'bellscoin',
  BEERSCOIN = 'beerscoin',
  BITCOIN = 'bitcoin',
  BONKCOIN = 'bonkcoin',
  CATCOIN = 'catcoin',
  DIGIBYTE = 'digibyte',
  DINGOCOIN = 'dingocoin',
  DOGECOIN = 'dogecoin',
  ETHEREUM = 'ethereum',
  JUNKCOIN = 'junkcoin',
  LITECOIN = 'litecoin',
  LUCKYCOIN = 'luckycoin',
  NEWYORKCOIN = 'newyorkcoin',
  PEPECOIN = 'pepecoin',
  SCRYPT = 'scrypt',
  SHIBACOIN = 'shibacoin',
  SOLANA = 'solana',
}

export enum AddressType {
  P2PKH = 'p2pkh',
  P2SH = 'p2sh',
  P2WPKH = 'p2wpkh',
  P2WSH = 'p2wsh',
}

export enum ScriptType {
  STANDARD = 'standard',
  MULTISIG = 'multisig',
  // Add more as needed
}

export interface ChainConfig {
  chainId: ChainId;
  name: string;
  rpcUrl: string;
  rpcUrls?: string[];
  blockheight: number;
  chainType?: 'utxo' | 'evm' | 'account';
  explorerUrl: string;
  pollingInterval: number;  // ms
  blockTime: number;  // seconds
  decimals: number;
  websocketUrl?: string; 
  // UTXO-specific parameters (required for chainType: 'utxo')
  networkMagic?: number;
  pubKeyHash?: number;
  scriptHash?: number;
  wif?: number;
  bech32?: string;
  // Required properties for ChainSpecificUtxo compatibility (non-optional for all chains)
  witnessVersion: number;
  supportsScrypt: boolean;
  getExplorerTxUrl: (txId: string) => string;
  getExplorerBlockUrl: (blockHeight: number) => string;
  getExplorerAddressUrl: (address: string) => string;
  getExplorerXpubUrl: (xpub: string) => string;
}

// Helper to create getters with proper closures (avoids 'this' issue)
function createGetters(
  baseUrl: string,
  paths: {
    tx: string;
    block: string;
    address: string;
    xpub: string;
  } = { tx: 'tx/', block: 'block/', address: 'address/', xpub: 'xpub/' }
): Pick<ChainConfig, 'getExplorerTxUrl' | 'getExplorerBlockUrl' | 'getExplorerAddressUrl' | 'getExplorerXpubUrl'> {
  return {
    getExplorerTxUrl: (txId: string) => `${baseUrl}${paths.tx}${txId}`,
    getExplorerBlockUrl: (height: number) => `${baseUrl}${paths.block}${height}`,
    getExplorerAddressUrl: (address: string) => `${baseUrl}${paths.address}${address}`,
    getExplorerXpubUrl: (xpub: string) => `${baseUrl}${paths.xpub}${xpub}`,
  };
}

export const CHAIN_CONFIGS: Record<ChainId, ChainConfig> = {
  [ChainId.BITCOIN]: {
    chainId: ChainId.BITCOIN,
    name: 'Bitcoin',
    rpcUrl: 'https://blockstream.info/api/',
    explorerUrl: 'https://blockstream.info/',
    pollingInterval: 60000,
    blockTime: 600,
    decimals: 8,
    blockheight: 0,
    chainType: 'utxo',
    // UTXO params
    networkMagic: 0xd9b4bef9,
    pubKeyHash: 0x00,
    scriptHash: 0x05,
    wif: 0x80,
    bech32: 'bc',
    witnessVersion: 0,
    supportsScrypt: false,
    ...createGetters('https://blockstream.info/', { tx: 'tx/', block: 'block-height/', address: 'address/', xpub: 'xpub/' }),
  },
  [ChainId.ETHEREUM]: {
    chainId: ChainId.ETHEREUM,
    name: 'Ethereum',
    rpcUrl: 'https://rpc.ankr.com/eth',
    explorerUrl: 'https://etherscan.io/',
    pollingInterval: 12000,
    blockTime: 12,
    decimals: 18,
    blockheight: 0,
    chainType: 'evm',
    websocketUrl: 'wss://rpc.ankr.com/ws/eth',
    witnessVersion: 0,
    supportsScrypt: false,
    ...createGetters('https://etherscan.io/', { tx: 'tx/', block: 'block/', address: 'address/', xpub: 'address/' }),
  },
  [ChainId.SCRYPT]: {
    chainId: ChainId.SCRYPT,
    name: 'Scrypt',
    rpcUrl: 'https://rpc.scryptprotocol.com',
    explorerUrl: 'https://explorer.scryptprotocol.com/',
    pollingInterval: 30000,
    blockTime: 30,
    decimals: 8,
    blockheight: 0,
    chainType: 'utxo',
    // UTXO params (using Bitcoin-like; adjust if specific)
    networkMagic: 0xd9b4bef9,
    pubKeyHash: 0x00,
    scriptHash: 0x05,
    wif: 0x80,
    bech32: 'sc',
    witnessVersion: 0,
    supportsScrypt: true,
    ...createGetters('https://explorer.scryptprotocol.com/', { tx: 'tx/', block: 'block/', address: 'address/', xpub: 'xpub/' }),
  },
  [ChainId.SOLANA]: {
    chainId: ChainId.SOLANA,
    name: 'Solana',
    rpcUrl: 'https://api.mainnet-beta.solana.com',
    explorerUrl: 'https://explorer.solana.com/',
    pollingInterval: 2000,
    blockTime: 0.4,
    decimals: 9,
    blockheight: 0,
    chainType: 'account',
    websocketUrl: 'wss://api.mainnet-beta.solana.com',
    witnessVersion: 0,
    supportsScrypt: false,
    getExplorerTxUrl: (txId: string) => `https://explorer.solana.com/tx/${txId}`,
    getExplorerBlockUrl: (height: number) => `https://explorer.solana.com/block/${height}`,
    getExplorerAddressUrl: (address: string) => `https://explorer.solana.com/address/${address}`,
    getExplorerXpubUrl: (xpub: string) => `https://explorer.solana.com/address/${xpub}`,
  },
  [ChainId.DOGECOIN]: {
    chainId: ChainId.DOGECOIN,
    name: 'Dogecoin',
    rpcUrl: 'https://rpc.ankr.com/dogecoin',
    explorerUrl: 'https://dogechain.info/',
    pollingInterval: 60000,
    blockTime: 60,
    decimals: 8,
    blockheight: 0,
    chainType: 'utxo',
    // UTXO params
    networkMagic: 0xc0c0c0c0,
    pubKeyHash: 0x1e,
    scriptHash: 0x16,
    wif: 0x9e,
    bech32: 'd',
    witnessVersion: 0,
    supportsScrypt: false,
    ...createGetters('https://dogechain.info/', { tx: 'tx/', block: 'block/', address: 'address/', xpub: 'xpub/' }),
  },
  [ChainId.DINGOCOIN]: {
    chainId: ChainId.DINGOCOIN,
    name: 'Dingocoin',
    rpcUrl: 'https://dingocoin-rpc.com',
    explorerUrl: 'https://dingocoin-explorer.com',
    pollingInterval: 30000,
    blockTime: 30,
    decimals: 8,
    blockheight: 0,
    chainType: 'utxo',
    // UTXO params (Dogecoin-like)
    networkMagic: 0xc0c0c0c0,
    pubKeyHash: 0x1e,
    scriptHash: 0x16,
    wif: 0x9e,
    bech32: 'd',
    witnessVersion: 0,
    supportsScrypt: false,
    ...createGetters('https://dingocoin-explorer.com/', { tx: 'tx/', block: 'block/', address: 'address/', xpub: 'xpub/' }),
  },
  [ChainId.LITECOIN]: {
    chainId: ChainId.LITECOIN,
    name: 'Litecoin',
    rpcUrl: 'https://rpc.ankr.com/litecoin',
    explorerUrl: 'https://explorer.litecoin.net/',
    pollingInterval: 150000,
    blockTime: 150,
    decimals: 8,
    blockheight: 0,
    chainType: 'utxo',
    // UTXO params
    networkMagic: 0xfbc0b6db,
    pubKeyHash: 0x30,
    scriptHash: 0x32,
    wif: 0xb0,
    bech32: 'ltc',
    witnessVersion: 0,
    supportsScrypt: false,
    ...createGetters('https://explorer.litecoin.net/', { tx: 'tx/', block: 'block/', address: 'address/', xpub: 'xpub/' }),
  },
  [ChainId.DIGIBYTE]: {
    chainId: ChainId.DIGIBYTE,
    name: 'Digibyte',
    rpcUrl: 'https://rpc.ankr.com/digibyte',
    explorerUrl: 'https://digiexplorer.info/',
    pollingInterval: 15000,
    blockTime: 15,
    decimals: 8,
    blockheight: 0,
    chainType: 'utxo',
    // UTXO params
    networkMagic: 0x0399bd77,
    pubKeyHash: 0x1e,
    scriptHash: 0x3f,
    wif: 0x80,
    bech32: 'dgb',
    witnessVersion: 0,
    supportsScrypt: false,
    ...createGetters('https://digiexplorer.info/', { tx: 'tx/', block: 'block/', address: 'address/', xpub: 'xpub/' }),
  },
  [ChainId.JUNKCOIN]: {
    chainId: ChainId.JUNKCOIN,
    name: 'Junkcoin',
    rpcUrl: 'https://junkcoin-rpc.com',
    explorerUrl: 'https://junkcoin-explorer.com',
    pollingInterval: 60000,
    blockTime: 60,
    decimals: 8,
    blockheight: 0,
    chainType: 'utxo',
    // UTXO params (Bitcoin-like)
    networkMagic: 0xd9b4bef9,
    pubKeyHash: 0x00,
    scriptHash: 0x05,
    wif: 0x80,
    bech32: 'jk',
    witnessVersion: 0,
    supportsScrypt: false,
    ...createGetters('https://junkcoin-explorer.com/', { tx: 'tx/', block: 'block/', address: 'address/', xpub: 'xpub/' }),
  },
  [ChainId.LUCKYCOIN]: {
    chainId: ChainId.LUCKYCOIN,
    name: 'Luckycoin',
    rpcUrl: 'https://chainz.cryptoid.info/lky/api.dws',
    explorerUrl: 'https://chainz.cryptoid.info/lky/',
    pollingInterval: 60000,
    blockTime: 60,
    decimals: 8,
    blockheight: 0,
    chainType: 'utxo',
    // UTXO params (Bitcoin-like)
    networkMagic: 0xd9b4bef9,
    pubKeyHash: 0x00,
    scriptHash: 0x05,
    wif: 0x80,
    bech32: 'lky',
    witnessVersion: 0,
    supportsScrypt: false,
    getExplorerTxUrl: (txId: string) => `https://chainz.cryptoid.info/lky/tx.dws?${txId}.htm`,
    getExplorerBlockUrl: (height: number) => `https://chainz.cryptoid.info/lky/block.dws?${height}.htm`,
    getExplorerAddressUrl: (address: string) => `https://chainz.cryptoid.info/lky/address.dws?${address}.htm`,
    getExplorerXpubUrl: (xpub: string) => `https://chainz.cryptoid.info/lky/address.dws?${xpub}.htm`,
  },
  [ChainId.PEPECOIN]: {
    chainId: ChainId.PEPECOIN,
    name: 'Pepecoin',
    rpcUrl: 'https://pepeblocks.com/api/',
    explorerUrl: 'https://pepeblocks.com/',
    pollingInterval: 30000,
    blockTime: 30,
    decimals: 8,
    blockheight: 0,
    chainType: 'utxo',
    // UTXO params (Litecoin-like)
    networkMagic: 0xfbc0b6db,
    pubKeyHash: 0x30,
    scriptHash: 0x32,
    wif: 0xb0,
    bech32: 'pepe',
    witnessVersion: 0,
    supportsScrypt: false,
    ...createGetters('https://pepeblocks.com/', { tx: 'tx/', block: 'block-height/', address: 'address/', xpub: 'xpub/' }),
  },
  [ChainId.BONKCOIN]: {
    chainId: ChainId.BONKCOIN,
    name: 'Bonkcoin',
    rpcUrl: 'https://api.bonkscoin.io/v1/',
    explorerUrl: 'https://explorer.bonkscoin.io/',
    pollingInterval: 45000,
    blockTime: 45,
    decimals: 8,
    blockheight: 0,
    chainType: 'utxo',
    // UTXO params (Dogecoin-like)
    networkMagic: 0xc0c0c0c0,
    pubKeyHash: 0x1e,
    scriptHash: 0x16,
    wif: 0x9e,
    bech32: 'bonk',
    witnessVersion: 0,
    supportsScrypt: false,
    ...createGetters('https://explorer.bonkscoin.io/', { tx: 'tx/', block: 'block/', address: 'address/', xpub: 'xpub/' }),
  },
  [ChainId.BELLSCOIN]: {
    chainId: ChainId.BELLSCOIN,
    name: 'Bellscoin',
    rpcUrl: 'https://explorer.bellscoin.com/api/v1/',
    explorerUrl: 'https://bells.quark.blue/',
    pollingInterval: 60000,
    blockTime: 60,
    decimals: 8,
    blockheight: 0,
    chainType: 'utxo',
    // UTXO params (Bitcoin-like)
    networkMagic: 0xd9b4bef9,
    pubKeyHash: 0x00,
    scriptHash: 0x05,
    wif: 0x80,
    bech32: 'bells',
    witnessVersion: 0,
    supportsScrypt: false,
    ...createGetters('https://bells.quark.blue/', { tx: 'tx/', block: 'block/', address: 'address/', xpub: 'xpub/' }),
  },
  [ChainId.SHIBACOIN]: {
    chainId: ChainId.SHIBACOIN,
    name: 'Shibacoin',
    rpcUrl: 'https://explorer.shibacoinshic.org/api/v1/',
    explorerUrl: 'https://explorer.shibacoinshic.org/',
    pollingInterval: 90000,
    blockTime: 90,
    decimals: 8,
    blockheight: 0,
    chainType: 'utxo',
    // UTXO params (Dogecoin-like)
    networkMagic: 0xc0c0c0c0,
    pubKeyHash: 0x1e,
    scriptHash: 0x16,
    wif: 0x9e,
    bech32: 'shi',
    witnessVersion: 0,
    supportsScrypt: false,
    ...createGetters('https://explorer.shibacoinshic.org/', { tx: 'tx/', block: 'block/', address: 'address/', xpub: 'xpub/' }),
  },
  [ChainId.CATCOIN]: {
    chainId: ChainId.CATCOIN,
    name: 'Catcoin',
    rpcUrl: 'https://chainz.cryptoid.info/cat/api.dws',
    explorerUrl: 'https://chainz.cryptoid.info/cat/',
    pollingInterval: 60000,
    blockTime: 60,
    decimals: 8,
    blockheight: 0,
    chainType: 'utxo',
    // UTXO params (Bitcoin-like)
    networkMagic: 0xd9b4bef9,
    pubKeyHash: 0x00,
    scriptHash: 0x05,
    wif: 0x80,
    bech32: 'cat',
    witnessVersion: 0,
    supportsScrypt: false,
    getExplorerTxUrl: (txId: string) => `https://chainz.cryptoid.info/cat/tx.dws?${txId}.htm`,
    getExplorerBlockUrl: (height: number) => `https://chainz.cryptoid.info/cat/block.dws?${height}.htm`,
    getExplorerAddressUrl: (address: string) => `https://chainz.cryptoid.info/cat/address.dws?${address}.htm`,
    getExplorerXpubUrl: (xpub: string) => `https://chainz.cryptoid.info/cat/address.dws?${xpub}.htm`,
  },
  [ChainId.BEERSCOIN]: {
    chainId: ChainId.BEERSCOIN,
    name: 'Beerscoin',
    rpcUrl: 'https://explorer.beerscoin.com/api/v1/',
    explorerUrl: 'https://explorer.beerscoin.com/',
    pollingInterval: 60000,
    blockTime: 60,
    decimals: 8,
    blockheight: 0,
    chainType: 'utxo',
    // UTXO params (Bitcoin-like)
    networkMagic: 0xd9b4bef9,
    pubKeyHash: 0x00,
    scriptHash: 0x05,
    wif: 0x80,
    bech32: 'beer',
    witnessVersion: 0,
    supportsScrypt: false,
    ...createGetters('https://explorer.beerscoin.com/', { tx: 'tx/', block: 'block/', address: 'address/', xpub: 'xpub/' }),
  },
  [ChainId.NEWYORKCOIN]: {
    chainId: ChainId.NEWYORKCOIN,
    name: 'New York Coin',
    rpcUrl: 'https://chainz.cryptoid.info/nyc/api.dws',
    explorerUrl: 'https://chainz.cryptoid.info/nyc/',
    pollingInterval: 30000,
    blockTime: 30,
    decimals: 8,
    blockheight: 0,
    chainType: 'utxo',
    // UTXO params (Dogecoin-like)
    networkMagic: 0xc0c0c0c0,
    pubKeyHash: 0x1e,
    scriptHash: 0x16,
    wif: 0x9e,
    bech32: 'nyc',
    witnessVersion: 0,
    supportsScrypt: false,
    getExplorerTxUrl: (txId: string) => `https://chainz.cryptoid.info/nyc/tx.dws?${txId}.htm`,
    getExplorerBlockUrl: (height: number) => `https://chainz.cryptoid.info/nyc/block.dws?${height}.htm`,
    getExplorerAddressUrl: (address: string) => `https://chainz.cryptoid.info/nyc/address.dws?${address}.htm`,
    getExplorerXpubUrl: (xpub: string) => `https://chainz.cryptoid.info/nyc/address.dws?${xpub}.htm`,
  },
};

export function getChainConfig(chainId: ChainId): ChainConfig {
  const config = CHAIN_CONFIGS[chainId];
  if (!config) {
    throw new Error(`Unknown chain ID: ${chainId}`);
  }
  return config;
}