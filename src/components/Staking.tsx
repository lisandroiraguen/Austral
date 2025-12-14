import React, { useState, useEffect } from 'react';
import { BrowserWallet, deserializeAddress } from '@meshsdk/core';
import { useLanguage } from '../context/LanguageContext';

// Staking tiers with base APY and cumulative bonus per month
const STAKING_TIERS = [
    { months: 0, baseApy: 3.5, bonusPerMonth: 0, label: 'Flexible', labelEs: 'Flexible' },

    { months: 1, baseApy: 4.5, bonusPerMonth: 0.2, label: '1 Month', labelEs: '1 Mes' },
    { months: 3, baseApy: 5.5, bonusPerMonth: 0.3, label: '3 Months', labelEs: '3 Meses' },
    { months: 6, baseApy: 6.5, bonusPerMonth: 0.4, label: '6 Months', labelEs: '6 Meses' },
    { months: 12, baseApy: 7.5, bonusPerMonth: 0.5, label: '12 Months', labelEs: '12 Meses' },
];

// Calculate real APY including cumulative bonus
const calculateRealApy = (tier: typeof STAKING_TIERS[0]) => {
    if (tier.months === 0) return tier.baseApy;
    // Test tier or flexible
    // Cumulative bonus: sum of bonus for each month (0.2 + 0.4 + 0.6... for first tier)
    const cumulativeBonus = tier.bonusPerMonth * tier.months;
    return tier.baseApy + cumulativeBonus;
};

const Staking: React.FC = () => {
    const { t, language } = useLanguage();
    const [connected, setConnected] = useState(false);
    const [adaBalance, setAdaBalance] = useState<string>('0');
    const [stakeAmount, setStakeAmount] = useState<string>('');
    const [selectedTier, setSelectedTier] = useState<number>(2); // Default to 1 month (index 2 now)
    const [isStaking, setIsStaking] = useState(false);
    const [statusMessage, setStatusMessage] = useState<string>('');

    const [activeStake, setActiveStake] = useState<{
        principalAda: number;
        releaseTime: number;
        isLocked: boolean;
    } | null>(null);

    useEffect(() => {
        checkWalletConnection();

        // Listen for wallet connection events
        const handleWalletConnected = () => {
            checkWalletConnection();
        };

        const handleWalletDisconnected = () => {
            setConnected(false);
            setAdaBalance('0');
            setActiveStake(null);
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
                await fetchADABalance(wallet);
                await checkActiveStake(wallet);
            }
        } catch (error) {
            console.error('Failed to check wallet connection:', error);
        }
    };

    const fetchADABalance = async (wallet: BrowserWallet) => {
        try {
            const lovelace = await wallet.getLovelace();
            // Convert lovelace to ADA (1 ADA = 1,000,000 lovelace)
            const ada = (parseInt(lovelace) / 1_000_000).toFixed(2);
            setAdaBalance(ada);
        } catch (error) {
            console.error('Failed to fetch ADA balance:', error);
            setAdaBalance('0');
        }
    };

    const checkActiveStake = async (wallet: BrowserWallet) => {
        try {
            const changeAddress = await wallet.getChangeAddress();
            let walletAddress = changeAddress;
            if (!walletAddress.startsWith("addr")) {
                try {
                    const addrObj = deserializeAddress(changeAddress);
                    if ((addrObj as any).to_bech32) {
                        walletAddress = (addrObj as any).to_bech32();
                    } else if ((addrObj as any).toBech32) {
                        walletAddress = (addrObj as any).toBech32();
                    }
                } catch (e) {
                    console.error("Error converting address for check:", e);
                }
            }

            const response = await fetch('/api/CheckStake', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ walletAddress })
            });

            if (response.ok) {
                const { activeStake } = await response.json();
                if (activeStake) {
                    setActiveStake(activeStake);
                }
            }
        } catch (error) {
            console.error("Failed to check active stake:", error);
        }
    };

    const calculateReward = () => {
        const amount = parseFloat(stakeAmount) || 0;
        const tier = STAKING_TIERS[selectedTier];
        const realApy = calculateRealApy(tier);

        // For flexible/test, assume 1 month for calculation display
        const months = tier.months === 0 ? 1 : tier.months;
        const reward = amount * (realApy / 100) * (months / 12);
        return reward.toFixed(4);
    };

    const handleStake = async () => {
        if (!stakeAmount || parseFloat(stakeAmount) <= 0) return;

        setIsStaking(true);
        setStatusMessage(t.staking || "Processing..."); // Fallback if t.staking undefined

        try {
            const walletName = localStorage.getItem('austral-wallet');
            if (!walletName) throw new Error("Wallet not connected");

            const wallet = await BrowserWallet.enable(walletName);
            const changeAddress = await wallet.getChangeAddress();

            let walletAddress = changeAddress;
            if (!walletAddress.startsWith("addr")) {
                try {
                    // Attempt to convert Hex to Bech32 using Mesh (casting to any to bypass TS check if method exists)
                    // Mesh's DeserializedAddress object might differ, but let's try standard CSL method name
                    const addrObj = deserializeAddress(changeAddress);
                    if ((addrObj as any).to_bech32) {
                        walletAddress = (addrObj as any).to_bech32();
                    } else if ((addrObj as any).toBech32) {
                        walletAddress = (addrObj as any).toBech32();
                    } else {
                        console.warn("Could not find to_bech32 method on address object", addrObj);
                    }
                } catch (e) {
                    console.error("Error converting address:", e);
                }
            }

            const tier = STAKING_TIERS[selectedTier];

            setStatusMessage("Building transaction...");

            // 1. Call API to create transaction
            const responseCreate = await fetch('/api/CreateStakeTx', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    amount: stakeAmount,
                    lockMonths: tier.months,
                    walletAddress: walletAddress
                })
            });

            if (!responseCreate.ok) {
                const errMsg = await responseCreate.text();
                throw new Error(`API Error: ${errMsg}`);
            }

            const { txCbor, unlockTime } = await responseCreate.json();

            setStatusMessage("Please sign transaction...");

            // 2. Sign with connected wallet
            const signedTxCbor = await wallet.signTx(txCbor, true);

            setStatusMessage("Submitting...");

            // 3. Submit via API
            const responseSubmit = await fetch('/api/SubmitTx', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ signedTxCbor })
            });

            if (!responseSubmit.ok) {
                const errMsg = await responseSubmit.text();
                throw new Error(`Submit Error: ${errMsg}`);
            }

            const { txHash } = await responseSubmit.json();

            console.log(`Staking Successful! TxHash: ${txHash}`);
            console.log(`Unlock Time: ${new Date(unlockTime).toLocaleString()}`);

            const tierLabel = language === 'es' ? tier.labelEs : tier.label;
            alert(`✅ Staking Successful!\nAmount: ${stakeAmount} ADA\nTier: ${tierLabel}\nTxHash: ${txHash}`);

            setStatusMessage("Success!");
            setStakeAmount(''); // Reset amount

            // Refresh Active Stake after success
            // await checkActiveStake(wallet);

            // Optimistic Update: Show "Staking in Progress" immediately
            setActiveStake({
                principalAda: parseFloat(stakeAmount),
                releaseTime: unlockTime,
                isLocked: true
            });

        } catch (error: any) {
            console.error('Staking failed:', error);
            alert(`❌ Error: ${error.message || error}`);
            setStatusMessage("Failed");
        } finally {
            setIsStaking(false);
            // Clear message after a delay
            setTimeout(() => setStatusMessage(''), 5000);
        }
    };

    const handleClaim = async () => {
        setIsStaking(true);
        setStatusMessage(language === 'es' ? "Reclamando recompensa..." : "Claiming reward...");

        try {
            const walletName = localStorage.getItem('austral-wallet');
            if (!walletName) throw new Error("Wallet not connected");

            const wallet = await BrowserWallet.enable(walletName);
            const changeAddress = await wallet.getChangeAddress();

            let walletAddress = changeAddress;
            if (!walletAddress.startsWith("addr")) {
                try {
                    const addrObj = deserializeAddress(changeAddress);
                    if ((addrObj as any).to_bech32) {
                        walletAddress = (addrObj as any).to_bech32();
                    } else if ((addrObj as any).toBech32) {
                        walletAddress = (addrObj as any).toBech32();
                    }
                } catch (e) { console.error(e); }
            }

            const response = await fetch('/api/ClaimStakeTx', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ walletAddress })
            });

            if (!response.ok) {
                const errMsg = await response.text();
                throw new Error(errMsg);
            }

            const { partialTx } = await response.json();

            setStatusMessage("Sign Claim...");
            const signedTx = await wallet.signTx(partialTx, true);

            setStatusMessage("Submitting...");
            const responseSubmit = await fetch('/api/SubmitTx', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ signedTxCbor: signedTx })
            });

            if (!responseSubmit.ok) {
                const errMsg = await responseSubmit.text();
                throw new Error(errMsg);
            }
            const { txHash } = await responseSubmit.json();

            alert(`✅ Claim Successful!\nTxHash: ${txHash}`);
            setStatusMessage("Success!");
            setActiveStake(null);

            await fetchADABalance(wallet);
            await fetchADABalance(wallet);
            // await checkActiveStake(wallet);

        } catch (error: any) {
            console.error("Claim Error:", error);
            alert(`❌ Claim Failed: ${error.message}`);
            setStatusMessage("Failed");
        } finally {
            setIsStaking(false);
            setTimeout(() => setStatusMessage(''), 5000);
        }
    };

    const handleWithdraw = async () => {
        if (!confirm(language === 'es'
            ? "¿Estás seguro? Retirar antes de tiempo significa PERDER todas las recompensas."
            : "Are you sure? Withdrawing early means forfeiting ALL rewards.")) {
            return;
        }

        setIsStaking(true);
        setStatusMessage(language === 'es' ? "Iniciando retiro..." : "Starting withdrawal...");

        try {
            const walletName = localStorage.getItem('austral-wallet');
            if (!walletName) throw new Error("Wallet not connected");

            const wallet = await BrowserWallet.enable(walletName);
            const changeAddress = await wallet.getChangeAddress();

            let walletAddress = changeAddress;
            if (!walletAddress.startsWith("addr")) {
                try {
                    const addrObj = deserializeAddress(changeAddress);
                    if ((addrObj as any).to_bech32) {
                        walletAddress = (addrObj as any).to_bech32();
                    } else if ((addrObj as any).toBech32) {
                        walletAddress = (addrObj as any).toBech32();
                    }
                } catch (e) {
                    console.error("Error converting address:", e);
                }
            }

            const response = await fetch('/api/CancelStakeTx', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ walletAddress })
            });

            if (!response.ok) {
                const errMsg = await response.text();
                throw new Error(errMsg);
            }

            const { partialTx } = await response.json();

            setStatusMessage("Sign withdrawal...");

            const signedTx = await wallet.signTx(partialTx, true);

            setStatusMessage("Submitting...");

            const responseSubmit = await fetch('/api/SubmitTx', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ signedTxCbor: signedTx })
            });

            if (!responseSubmit.ok) {
                const errMsg = await responseSubmit.text();
                throw new Error(errMsg);
            }
            const { txHash } = await responseSubmit.json();

            alert(`✅ Withdrawal Successful!\nTxHash: ${txHash}`);
            setStatusMessage("Success!");
            setActiveStake(null); // Clear active stake immediately

            await fetchADABalance(wallet);
            await fetchADABalance(wallet);
            // await checkActiveStake(wallet); // Double check

        } catch (error: any) {
            console.error("Withdraw Error:", error);
            alert(`❌ Withdraw Failed: ${error.message}`);
            setStatusMessage("Failed");
        } finally {
            setIsStaking(false);
            setTimeout(() => setStatusMessage(''), 5000);
        }
    };

    const handleMaxAmount = () => {
        // Leave some ADA for transaction fees
        const maxStakeable = Math.max(0, parseFloat(adaBalance) - 5);
        setStakeAmount(maxStakeable.toFixed(2));
    };

    return (
        <section id="staking" className="relative py-20 px-6 retro-grid-bg">
            <div className="max-w-6xl mx-auto">
                {/* Section Title */}
                <h2 className="font-display text-4xl md:text-5xl font-bold text-center mb-4
                       bg-gradient-to-r from-neon-green via-neon-cyan to-neon-magenta
                       bg-clip-text text-transparent">
                    {t.stakingTitle}
                </h2>
                <p className="text-center text-gray-400 mb-12 max-w-2xl mx-auto font-synth">
                    {t.stakingDescription}
                </p>

                <div className="max-w-xl mx-auto">
                    {/* Staking Form */}
                    <div className="relative group">
                        <div className="absolute inset-0 bg-gradient-to-r from-neon-green to-neon-cyan 
                            opacity-20 blur-xl group-hover:opacity-30 transition-opacity duration-300" />
                        <div className="relative bg-retro-purple/40 backdrop-blur-sm border-2 border-neon-green
                            rounded-lg p-8 hover:border-neon-cyan transition-all duration-300">

                            <h3 className="font-display text-2xl text-neon-green mb-6 flex items-center gap-3">
                                {t.stakeADA}
                            </h3>

                            {!connected ? (
                                <div className="text-center py-8">
                                    <p className="text-gray-400 font-synth mb-4">{t.connectToStake}</p>
                                    <div className="inline-block px-6 py-3 border-2 border-neon-cyan/50 
                                                    rounded-lg text-neon-cyan/50">
                                        {t.connectWallet}
                                    </div>
                                </div>
                            ) : activeStake ? (
                                <div className="text-center py-8">
                                    <div className="mb-6 p-4 bg-retro-dark/80 rounded-lg border border-neon-magenta/50 animate-pulse-slow">
                                        <h4 className="text-neon-magenta font-display text-xl mb-4 uppercase">
                                            {language === 'es' ? 'Staking en Progreso' : 'Staking in Progress'}
                                        </h4>
                                        <div className="mb-4">
                                            <p className="text-gray-400 text-sm font-synth uppercase mb-1">
                                                {language === 'es' ? 'Monto Bloqueado' : 'Locked Amount'}
                                            </p>
                                            <p className="text-2xl font-display text-white text-glow-magenta">
                                                {activeStake.principalAda} ADA
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-gray-400 text-sm font-synth uppercase mb-1">
                                                {language === 'es' ? 'Desbloqueo' : 'Unlock Time'}
                                            </p>
                                            <p className="text-lg font-mono text-neon-cyan">
                                                {new Date(activeStake.releaseTime).toLocaleString()}
                                            </p>
                                            <p className="text-xs text-neon-yellow mt-2">
                                                {language === 'es' ? 'Podrás retirar después de esta fecha.' : 'You can withdraw after this date.'}
                                            </p>
                                        </div>

                                        <div className="mt-6 border-t border-gray-700 pt-4 space-y-3">
                                            {/* CLAIM BUTTON (Only if Unlocked) */}
                                            {!activeStake.isLocked && (
                                                <button
                                                    onClick={handleClaim}
                                                    disabled={isStaking}
                                                    className="w-full py-3 px-4 bg-neon-green/20 border border-neon-green 
                                                               text-neon-green rounded
                                                               hover:bg-neon-green hover:text-retro-dark
                                                               transition-all duration-300 font-display text-sm uppercase
                                                               disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    {language === 'es' ? 'Reclamar y Retirar' : 'Claim & Withdraw'}
                                                </button>
                                            )}

                                            {/* EARLY WITHDRAW BUTTON (Only if Locked) */}
                                            {activeStake.isLocked && (
                                                <button
                                                    onClick={handleWithdraw}
                                                    disabled={isStaking}
                                                    className="w-full py-2 px-4 border border-red-500/50 text-red-400 
                                                               rounded hover:bg-red-500/10 hover:text-red-300 hover:border-red-400
                                                               transition-all duration-300 font-synth text-sm uppercase
                                                               disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    {language === 'es' ? 'Retirar sin Recompensa' : 'Withdraw (No Reward)'}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    {/* Available Balance */}
                                    <div className="mb-6">
                                        <label className="block text-sm text-gray-400 mb-2 font-synth uppercase">
                                            {t.availableBalance}
                                        </label>
                                        <div className="text-2xl font-display text-white text-glow-cyan">
                                            {adaBalance} ADA
                                        </div>
                                    </div>

                                    {/* Amount Input */}
                                    <div className="mb-6">
                                        <label className="block text-sm text-gray-400 mb-2 font-synth uppercase">
                                            {t.stakeAmount}
                                        </label>
                                        <div className="relative">
                                            <input
                                                type="number"
                                                value={stakeAmount}
                                                onChange={(e) => setStakeAmount(e.target.value)}
                                                placeholder="0.00"
                                                className="w-full bg-retro-dark/60 border-2 border-neon-green/50
                                                           rounded-lg px-4 py-3 text-neon-cyan font-synth text-lg
                                                           text-glow-cyan
                                                           focus:border-neon-green focus:outline-none
                                                           transition-colors duration-300"
                                            />
                                            <button
                                                onClick={handleMaxAmount}
                                                className="absolute right-3 top-1/2 -translate-y-1/2
                                                           px-3 py-1 text-xs font-synth uppercase
                                                           bg-neon-green/20 text-neon-green rounded
                                                           hover:bg-neon-green hover:text-retro-dark
                                                           transition-all duration-300"
                                            >
                                                MAX
                                            </button>
                                        </div>
                                    </div>

                                    {/* Duration Selection */}
                                    <div className="mb-6">
                                        <label className="block text-sm text-gray-400 mb-3 font-synth uppercase">
                                            {t.stakeDuration}
                                        </label>
                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                            {STAKING_TIERS.map((tier, index) => {
                                                const realApy = calculateRealApy(tier);
                                                const tierLabel = language === 'es' ? tier.labelEs : tier.label;
                                                return (
                                                    <button
                                                        key={index}
                                                        onClick={() => setSelectedTier(index)}
                                                        className={`p-3 rounded-lg border-2 transition-all duration-300
                                                            ${selectedTier === index
                                                                ? 'border-neon-green bg-neon-green/20 scale-105'
                                                                : 'border-neon-cyan/30 bg-retro-dark/40 hover:border-neon-cyan/60'
                                                            }`}
                                                    >
                                                        <div className="font-display text-sm text-white">
                                                            {tierLabel}
                                                        </div>
                                                        <div className={`font-synth text-xs ${selectedTier === index ? 'text-neon-green' : 'text-neon-cyan'}`}>
                                                            {realApy.toFixed(1)}% APY
                                                        </div>
                                                        {tier.bonusPerMonth > 0 && (
                                                            <div className="text-xs text-neon-yellow mt-1">
                                                                +{tier.bonusPerMonth}%/{language === 'es' ? 'mes' : 'mo'}
                                                            </div>
                                                        )}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* Estimated Reward */}
                                    <div className="mb-6 p-4 bg-retro-dark/60 rounded-lg border border-neon-yellow/30">
                                        <div className="flex justify-between items-center">
                                            <span className="text-neon-yellow font-synth text-sm uppercase">
                                                {t.estimatedReward}
                                            </span>
                                            <span className="font-display text-xl text-neon-yellow text-glow-yellow">
                                                +{calculateReward()} ₳
                                            </span>
                                        </div>
                                    </div>

                                    {/* Status Message */}
                                    {statusMessage && (
                                        <div className="mb-4 text-center text-neon-cyan font-mono text-sm animate-pulse">
                                            {statusMessage}
                                        </div>
                                    )}

                                    {/* Stake Button */}
                                    <button
                                        onClick={handleStake}
                                        disabled={isStaking || !stakeAmount || parseFloat(stakeAmount) <= 0}
                                        className="w-full py-4 font-display text-lg uppercase
                                                   bg-gradient-to-r from-neon-green to-neon-cyan
                                                   text-retro-dark rounded-lg
                                                   hover:shadow-neon-cyan hover:scale-105
                                                   disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100
                                                   transition-all duration-300"
                                    >
                                        {isStaking ? (statusMessage || t.staking) : t.stakeNow}
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default Staking;
