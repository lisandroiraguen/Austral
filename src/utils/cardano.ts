import type { TokenInfo } from '../types';

// Placeholder token information - UPDATE THESE VALUES
export const AUSTRAL_TOKEN: TokenInfo = {
    policyId: '0000000000000000000000000000000000000000000000000000000000000000',
    assetName: '4155535452414c', // "AUSTRAL" in hex
    poolAddress: 'addr1_placeholder_pool_address_here',
    totalSupply: '1000000000', // 1 billion tokens (placeholder)
};

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
