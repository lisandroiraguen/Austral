import React, { useState, useEffect } from 'react';
import { BrowserWallet } from '@meshsdk/core';
import { useLanguage } from '../context/LanguageContext';
import { AUSTRAL_TOKEN, formatTokenAmount, copyToClipboard, formatAddress } from '../utils/cardano';

const TokenStats: React.FC = () => {
    const { t } = useLanguage();
    const [balance, setBalance] = useState<string>('0');
    const [connected, setConnected] = useState(false);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        checkWalletConnection();

        // Listen for wallet connection events
        const handleWalletConnected = () => {
            checkWalletConnection();
        };

        const handleWalletDisconnected = () => {
            setConnected(false);
            setBalance('0');
        };

        window.addEventListener('wallet-connected', handleWalletConnected);
        window.addEventListener('wallet-disconnected', handleWalletDisconnected);

        return () => {
            window.removeEventListener('wallet-connected', handleWalletConnected);
            window.removeEventListener('wallet-disconnected', handleWalletDisconnected);
        };
    }, []);

    const checkWalletConnection = async () => {
        try {
            const walletName = localStorage.getItem('austral-wallet');
            if (walletName) {
                const wallet = await BrowserWallet.enable(walletName);
                setConnected(true);
                await fetchBalance(wallet);
            }
        } catch (error) {
            console.error('Failed to check wallet connection:', error);
        }
    };

    const fetchBalance = async (wallet: BrowserWallet) => {
        try {
            const assets = await wallet.getAssets();
            const tokenUnit = `${AUSTRAL_TOKEN.policyId}${AUSTRAL_TOKEN.assetName}`;

            // DEBUG: Log all assets and the token unit we're looking for
            console.log('=== DEBUG: Wallet Assets ===');
            console.log('Looking for tokenUnit:', tokenUnit);
            console.log('All wallet assets:', assets);
            assets.forEach(asset => {
                console.log(`Asset: ${asset.unit} | Quantity: ${asset.quantity}`);
            });

            // Find AUSTRAL token in wallet assets
            const australAsset = assets.find(asset => asset.unit === tokenUnit);

            if (australAsset) {
                console.log('Found AUSTRAL asset:', australAsset);
                setBalance(australAsset.quantity);
            } else {
                console.log('AUSTRAL token not found in wallet');
                setBalance('0');
            }
        } catch (error) {
            console.error('Failed to fetch balance:', error);
            setBalance('0');
        }
    };

    const handleCopyAddress = async () => {
        const success = await copyToClipboard(AUSTRAL_TOKEN.poolAddress);
        if (success) {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    return (
        <section className="relative py-20 px-6 bg-retro-dark">
            <div className="max-w-6xl mx-auto">
                {/* Section Title */}
                <h2 className="font-display text-4xl md:text-5xl font-bold text-center mb-12
                       bg-gradient-to-r from-neon-cyan via-neon-magenta to-neon-yellow
                       bg-clip-text text-transparent">
                    Token Stats
                </h2>

                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Your Balance */}
                    <div className="relative group">
                        <div className="absolute inset-0 bg-gradient-to-r from-neon-cyan to-neon-magenta 
                            opacity-20 blur-xl group-hover:opacity-40 transition-opacity duration-300" />
                        <div className="relative bg-retro-purple/40 backdrop-blur-sm border-2 border-neon-cyan
                            rounded-lg p-6 hover:border-neon-magenta transition-all duration-300
                            hover:scale-105 min-h-[200px] flex flex-col">
                            <div className="flex items-center gap-3 mb-3">
                                <span className="text-3xl font-bold text-neon-cyan">₳</span>
                                <h3 className="font-synth text-lg text-neon-cyan uppercase">
                                    {t.yourBalance}
                                </h3>
                            </div>

                            <div className="flex-1 flex items-center">
                                {connected ? (
                                    <p className="font-display text-3xl text-white text-glow-cyan">
                                        {formatTokenAmount(balance)} ₳
                                    </p>
                                ) : (
                                    <p className="font-synth text-sm text-gray-400">
                                        {t.notConnected}
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Total Pool */}
                    <div className="relative group">
                        <div className="absolute inset-0 bg-gradient-to-r from-neon-magenta to-neon-yellow 
                            opacity-20 blur-xl group-hover:opacity-40 transition-opacity duration-300" />
                        <div className="relative bg-retro-purple/40 backdrop-blur-sm border-2 border-neon-magenta
                            rounded-lg p-6 hover:border-neon-yellow transition-all duration-300
                            hover:scale-105 min-h-[200px] flex flex-col">
                            <div className="flex items-center gap-3 mb-3">
                                <span className="text-3xl font-bold text-neon-magenta">◆</span>
                                <h3 className="font-synth text-lg text-neon-magenta uppercase">
                                    {t.totalPool}
                                </h3>
                            </div>

                            <div className="flex-1 flex items-center">
                                <p className="font-display text-3xl text-white text-glow-magenta">
                                    {formatTokenAmount(AUSTRAL_TOKEN.totalSupply)} ₳
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Contract Address */}
                    <div className="relative group">
                        <div className="absolute inset-0 bg-gradient-to-r from-neon-yellow to-neon-green 
                            opacity-20 blur-xl group-hover:opacity-40 transition-opacity duration-300" />
                        <div className="relative bg-retro-purple/40 backdrop-blur-sm border-2 border-neon-yellow
                            rounded-lg p-6 hover:border-neon-green transition-all duration-300
                            hover:scale-105 min-h-[200px] flex flex-col">
                            <div className="flex items-center gap-3 mb-3">
                                <span className="text-3xl font-bold text-neon-yellow">▣</span>
                                <h3 className="font-synth text-lg text-neon-yellow uppercase">
                                    {t.contractAddress}
                                </h3>
                            </div>

                            <div className="flex-1 flex flex-col justify-between">
                                <p className="font-mono text-sm text-white mb-3 break-all">
                                    {formatAddress(AUSTRAL_TOKEN.poolAddress)}
                                </p>

                                <button
                                    onClick={handleCopyAddress}
                                    className="w-full px-4 py-2 font-synth text-xs uppercase
                               bg-neon-yellow/20 border border-neon-yellow text-neon-yellow
                               rounded hover:bg-neon-yellow hover:text-retro-dark
                               transition-all duration-300"
                                >
                                    {copied ? t.copied : t.copyAddress}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default TokenStats;
