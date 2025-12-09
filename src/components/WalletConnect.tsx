import React, { useState, useEffect } from 'react';
import { BrowserWallet } from '@meshsdk/core';
import { useLanguage } from '../context/LanguageContext';
import { formatAddress } from '../utils/cardano';

const WalletConnect: React.FC = () => {
    const { t } = useLanguage();
    const [connected, setConnected] = useState(false);
    const [address, setAddress] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        // Check if wallet was previously connected
        checkConnection();
    }, []);

    const checkConnection = async () => {
        try {
            const walletName = localStorage.getItem('austral-wallet');
            if (walletName) {
                // Check if wallet is still installed
                const installedWallets = BrowserWallet.getInstalledWallets();
                const walletStillInstalled = installedWallets.some(
                    w => w.name.toLowerCase() === walletName.toLowerCase()
                );

                if (!walletStillInstalled) {
                    localStorage.removeItem('austral-wallet');
                    return;
                }

                // Try to silently reconnect (don't show loading for auto-reconnect)
                try {
                    const browserWallet = await BrowserWallet.enable(walletName);
                    const walletAddress = await browserWallet.getChangeAddress();
                    setAddress(walletAddress);
                    setConnected(true);
                    window.dispatchEvent(new CustomEvent('wallet-connected', { detail: { walletName } }));
                } catch {
                    // If auto-reconnect fails, clear stale data
                    localStorage.removeItem('austral-wallet');
                }
            }
        } catch (error) {
            console.error('Failed to restore wallet connection:', error);
            localStorage.removeItem('austral-wallet');
        }
    };

    const connectWallet = async (walletName: string = 'eternl') => {
        setLoading(true);
        try {
            // Add timeout to prevent infinite loading
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Connection timeout')), 30000);
            });

            const enablePromise = BrowserWallet.enable(walletName);
            const browserWallet = await Promise.race([enablePromise, timeoutPromise]) as Awaited<ReturnType<typeof BrowserWallet.enable>>;

            const walletAddress = await browserWallet.getChangeAddress();
            setAddress(walletAddress);
            setConnected(true);

            // Save wallet preference
            localStorage.setItem('austral-wallet', walletName);

            // Dispatch event to notify other components
            window.dispatchEvent(new CustomEvent('wallet-connected', { detail: { walletName } }));
        } catch (error) {
            console.error('Failed to connect wallet:', error);
            // Clear any stale wallet data
            localStorage.removeItem('austral-wallet');
            setConnected(false);
            setAddress(null);

            if (error instanceof Error && error.message === 'Connection timeout') {
                alert('Conexión timeout. Asegurate de que la wallet esté desbloqueada.');
            } else {
                alert(t.walletError);
            }
        } finally {
            setLoading(false);
        }
    };

    const disconnectWallet = () => {
        setAddress(null);
        setConnected(false);
        localStorage.removeItem('austral-wallet');

        // Dispatch event to notify other components
        window.dispatchEvent(new CustomEvent('wallet-disconnected'));
    };

    const handleConnect = async () => {
        // Try to connect to Eternl first, fallback to other wallets
        const availableWallets = BrowserWallet.getInstalledWallets();

        if (availableWallets.length === 0) {
            alert('No Cardano wallet detected. Please install Eternl or another CIP-30 compatible wallet.');
            return;
        }

        // Prefer Eternl, otherwise use first available
        const walletToUse = availableWallets.find(w => w.name.toLowerCase().includes('eternl'))
            || availableWallets[0];

        await connectWallet(walletToUse.name);
    };

    if (connected && address) {
        return (
            <div className="flex items-center gap-3">
                <div className="px-4 py-2 bg-retro-purple/30 border-2 border-neon-cyan rounded-lg
                        backdrop-blur-sm">
                    <p className="text-xs text-neon-cyan font-synth">
                        {t.walletConnected}
                    </p>
                    <p className="text-sm text-white font-mono">
                        {formatAddress(address)}
                    </p>
                </div>

                <button
                    onClick={disconnectWallet}
                    className="px-4 py-2 font-synth text-sm font-bold uppercase
                     bg-gradient-to-r from-neon-magenta to-neon-pink
                     text-white rounded-lg
                     transition-all duration-300 hover:scale-105 hover:shadow-neon-magenta"
                >
                    {t.disconnect}
                </button>
            </div>
        );
    }

    return (
        <button
            onClick={handleConnect}
            disabled={loading}
            className="relative px-6 py-3 font-synth text-sm font-bold uppercase tracking-wider
                 bg-gradient-to-r from-neon-cyan to-neon-magenta
                 text-retro-dark rounded-lg overflow-hidden
                 transition-all duration-300 hover:scale-105 hover:shadow-neon-cyan
                 disabled:opacity-50 disabled:cursor-not-allowed
                 group"
        >
            <span className="relative z-10 flex items-center gap-2">
                {loading ? (
                    <>
                        <span className="animate-spin">⚡</span>
                        <span>{t.walletConnecting}</span>
                    </>
                ) : (
                    <>
                        <span>🔗</span>
                        <span>{t.connectWallet}</span>
                    </>
                )}
            </span>

            {/* Animated background */}
            <div className="absolute inset-0 bg-gradient-to-r from-neon-magenta to-neon-yellow
                      opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        </button>
    );
};

export default WalletConnect;
