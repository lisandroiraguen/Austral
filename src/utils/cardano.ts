import type { TokenInfo } from '../types';

// Placeholder token information - UPDATE THESE VALUES
export const AUSTRAL_TOKEN: TokenInfo = {
    policyId: '9ea5cd066fda8431f52565159c426b1717c8ffc9d7a1fbcda62e3b5c',
    assetName: '4175737472616c2d54657374', // "Austral-Test" in hex
    totalSupply: '100000000', // 1 billion tokens (placeholder)
};

// Dirección del smart contract de staking (se genera al desplegar el contrato)
export const STAKING_CONTRACT_ADDRESS = 'addr_test1wz3xtqqsky23deg4lg828cne9x4nn5s00qpvg2huqvc84qcfvyjf2';

/**
 * Format Cardano address for display (truncated)
 */
export const formatAddress = (address: string): string => {
    if (!address) return '';
    if (address.length <= 20) return address;
    return `${address.slice(0, 10)}...${address.slice(-8)}`;
};

/**
 * Format token amount with proper decimals
 */
export const formatTokenAmount = (amount: string | number, decimals: number = 6): string => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    if (isNaN(num)) return '0';

    // Format with commas and decimals
    return new Intl.NumberFormat('en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: decimals,
    }).format(num);
};

/**
 * Convert lovelace to ADA
 */
export const lovelaceToAda = (lovelace: string | number): number => {
    const amount = typeof lovelace === 'string' ? parseFloat(lovelace) : lovelace;
    return amount / 1_000_000;
};

/**
 * Get token unit (policy ID + asset name)
 */
export const getTokenUnit = (): string => {
    return `${AUSTRAL_TOKEN.policyId}${AUSTRAL_TOKEN.assetName}`;
};

/**
 * Copy text to clipboard
 */
export const copyToClipboard = async (text: string): Promise<boolean> => {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch (error) {
        console.error('Failed to copy to clipboard:', error);
        return false;
    }
};
