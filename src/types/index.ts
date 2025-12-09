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

    // History Section
    historyTitle: string;
    historyContent1: string;
    historyContent2: string;
    historyContent3: string;

    vintageTitle: string;
    vintageDescription: string;
    fullSetTitle: string;
    fullSetDescription: string;

    // Footer
    footerText: string;

    // Wallet
    walletConnecting: string;
    walletConnected: string;
    walletError: string;
    selectWallet: string;

    // Staking
    stakingTitle: string;
    stakingDescription: string;
    stakeADA: string;
    connectToStake: string;
    availableBalance: string;
    stakeAmount: string;
    stakeDuration: string;
    month: string;
    months: string;
    estimatedReward: string;
    staking: string;
    stakeNow: string;
    stakingRewards: string;
    lockPeriod: string;
    stakingNote: string;
    stakingNoteDescription: string;
}
