export interface WalletState {
    connected: boolean;
    address: string | null;
    balance: string | null;
    loading: boolean;
}

export interface TokenInfo {
    policyId: string;
    assetName: string;
    poolAddress: string;
    totalSupply: string;
}

export type Language = 'en' | 'es';

export interface Translations {
    en: TranslationKeys;
    es: TranslationKeys;
}

export interface TranslationKeys {
    // Navigation
    connectWallet: string;
    disconnect: string;

    // Hero Section
    heroTitle: string;
    heroSubtitle: string;
    heroDescription: string;
    learnMore: string;

    // Token Stats
    yourBalance: string;
    totalPool: string;
    contractAddress: string;
    copyAddress: string;
    copied: string;
    notConnected: string;

    // About Section
    aboutTitle: string;
    aboutDescription: string;
    vintageTitle: string;
    vintageDescription: string;

    // Footer
    footerText: string;

    // Wallet
    walletConnecting: string;
    walletConnected: string;
    walletError: string;
    selectWallet: string;
}
