import React, { useState, useEffect } from 'react';
import { BrowserWallet, deserializeAddress } from '@meshsdk/core';
import { useLanguage } from '../context/LanguageContext';
import { useToast } from '../context/ToastContext';

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
    const toast = useToast();
    const [connected, setConnected] = useState(false);
    const [adaBalance, setAdaBalance] = useState<string>('0');
    const [stakeAmount, setStakeAmount] = useState<string>('');
    const [selectedTier, setSelectedTier] = useState<number>(-1); // Default to no selection
    const [isStaking, setIsStaking] = useState(false);
    const [statusMessage, setStatusMessage] = useState<string>('');

    const [activeStake, setActiveStake] = useState<{
        principalAda: number;
        startTime: number;
        releaseTime: number;
        isLocked: boolean;
    } | null>(null);

    // Progress state
    const [progress, setProgress] = useState(0);
    const [timeRemaining, setTimeRemaining] = useState('');

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

    // Timer to check if stake has unlocked (every 10 seconds) and update progress
    useEffect(() => {
        if (!activeStake) return;

        const updateStatus = () => {
            const now = Date.now();

            // Check unlock
            if (activeStake.isLocked && now >= activeStake.releaseTime) {
                // Stake is now unlocked!
                setActiveStake(prev => prev ? { ...prev, isLocked: false } : null);
                console.log('🔓 Stake unlocked! Claim button should now be green.');
            }

            // Update Progress Bar & Time Remaining
            if (activeStake.startTime && activeStake.releaseTime) {
                const totalDuration = activeStake.releaseTime - activeStake.startTime;
                const elapsed = now - activeStake.startTime;

                // If totalDuration is 0 or negative (shouldn't happen for fixed term), set 100%
                let pct = 0;
                if (totalDuration > 0) {
                    pct = Math.min(100, Math.max(0, (elapsed / totalDuration) * 100));
                } else {
                    pct = 100; // Legacy or instant
                }
                setProgress(pct);

                // Time Remaining String
                const remaining = activeStake.releaseTime - now;
                if (remaining <= 0) {
                    setTimeRemaining(language === 'es' ? 'Completado' : 'Completed');
                } else {
                    const days = Math.floor(remaining / (1000 * 60 * 60 * 24));
                    const hours = Math.floor((remaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

                    if (days > 0) {
                        const dayStr = language === 'es' ? 'días' : 'days';
                        const hrStr = language === 'es' ? 'hs' : 'hrs';
                        setTimeRemaining(`${days} ${dayStr}, ${hours} ${hrStr}`);
                    } else {
                        const mins = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
                        const hrStr = language === 'es' ? 'hs' : 'hrs';
                        const minStr = language === 'es' ? 'min' : 'mins';
                        setTimeRemaining(`${hours} ${hrStr}, ${mins} ${minStr}`);
                    }
                }
            }
        };

        // Check immediately
        updateStatus();

        // Then check every 10 seconds
        const interval = setInterval(updateStatus, 10000);

        return () => clearInterval(interval);
    }, [activeStake, language]);

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
        if (selectedTier === -1) return "0.0000";

        const tier = STAKING_TIERS[selectedTier];
        const realApy = calculateRealApy(tier);

        // For flexible/test, assume 1 month for calculation display
        const months = tier.months === 0 ? 1 : tier.months;
        const reward = amount * (realApy / 100) * (months / 12);
        return reward.toFixed(4);
    };

    const handleStake = async () => {
        if (!stakeAmount || parseFloat(stakeAmount) <= 0) return;
        if (selectedTier === -1) {
            toast.error("Error", language === 'es' ? "Por favor selecciona un plan." : "Please select a duration.");
            return;
        }

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
            toast.success(
                language === 'es' ? '¡Staking Exitoso!' : 'Staking Successful!',
                `${stakeAmount} ADA - ${tierLabel}`,
                txHash
            );

            setStatusMessage("Success!");
            setStakeAmount(''); // Reset amount

            // Refresh Active Stake after success
            // await checkActiveStake(wallet);

            // Optimistic Update: Show "Staking in Progress" immediately
            setActiveStake({
                principalAda: parseFloat(stakeAmount),
                startTime: Date.now(),
                releaseTime: unlockTime,
                isLocked: true
            });

        } catch (error: any) {
            console.error('Staking failed:', error);
            toast.error(
                language === 'es' ? 'Error de Staking' : 'Staking Error',
                error.message || String(error)
            );
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

            toast.success(
                language === 'es' ? '¡Reclamo Exitoso!' : 'Claim Successful!',
                language === 'es' ? 'Tus ADA y recompensas han sido retirados.' : 'Your ADA and rewards have been withdrawn.',
                txHash
            );
            setStatusMessage("Success!");
            setActiveStake(null);

            await fetchADABalance(wallet);
            await fetchADABalance(wallet);
            // await checkActiveStake(wallet);

        } catch (error: any) {
            console.error("Claim Error:", error);
            toast.error(
                language === 'es' ? 'Error al Reclamar' : 'Claim Failed',
                error.message || String(error)
            );
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

            toast.success(
                language === 'es' ? '¡Retiro Exitoso!' : 'Withdrawal Successful!',
                language === 'es' ? 'Tus ADA han sido devueltos (sin recompensa).' : 'Your ADA has been returned (no reward).',
                txHash
            );
            setStatusMessage("Success!");
            setActiveStake(null); // Clear active stake immediately

            await fetchADABalance(wallet);
            await fetchADABalance(wallet);
            // await checkActiveStake(wallet); // Double check

        } catch (error: any) {
            console.error("Withdraw Error:", error);
            toast.error(
                language === 'es' ? 'Error al Retirar' : 'Withdrawal Failed',
                error.message || String(error)
            );
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

                                        {/* PROGRESS BAR: Only if startTime exists (not legacy) and isLocked */}
                                        {activeStake.startTime > 0 && activeStake.isLocked && (
                                            <div className="mb-4 px-2">
                                                <div className="flex justify-between text-xs mb-1">
                                                    <span className="text-neon-cyan/70 font-synth uppercase">
                                                        {language === 'es' ? 'Tiempo Restante' : 'Time Remaining'}
                                                    </span>
                                                    <span className="text-neon-green/90 font-mono">
                                                        {timeRemaining}
                                                    </span>
                                                </div>
                                                <div className="w-full h-3 bg-retro-dark/80 border border-neon-cyan/30 rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full bg-gradient-to-r from-neon-green to-neon-cyan shadow-[0_0_10px_rgba(57,255,20,0.5)] transition-all duration-1000 ease-out"
                                                        style={{ width: `${progress}%` }}
                                                    />
                                                </div>
                                                <div className="flex justify-between text-[10px] mt-1 text-gray-500 font-mono">
                                                    <span>{new Date(activeStake.startTime).toLocaleDateString()}</span>
                                                    <span>{new Date(activeStake.releaseTime).toLocaleDateString()}</span>
                                                </div>
                                            </div>
                                        )}

                                        {/* Fallback for Legacy/Flexible or just extra info */}
                                        <div className="mt-4">
                                            <p className="text-gray-400 text-sm font-synth uppercase mb-1">
                                                {language === 'es' ? 'Desbloqueo' : 'Unlock Time'}
                                            </p>
                                            <p className="text-lg font-mono text-neon-cyan">
                                                {new Date(activeStake.releaseTime).toLocaleString()}
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

                                        {/* Flexible tier - centered on top */}
                                        <div className="flex justify-center mb-3">
                                            {(() => {
                                                const tier = STAKING_TIERS[0];
                                                const realApy = calculateRealApy(tier);
                                                const tierLabel = language === 'es' ? tier.labelEs : tier.label;
                                                return (
                                                    <button
                                                        onClick={() => setSelectedTier(0)}
                                                        className={`w-full p-3 px-8 rounded-lg border-2 transition-all duration-300
                                                            ${selectedTier === 0
                                                                ? 'border-neon-green bg-neon-green/20 scale-105 shadow-[0_0_15px_rgba(57,255,20,0.3)]'
                                                                : 'border-neon-cyan/30 bg-retro-dark/40 hover:border-neon-cyan/60'
                                                            }`}
                                                    >
                                                        <div className="font-display text-xl text-white mb-1">
                                                            {tierLabel}
                                                        </div>
                                                        <div className={`font-synth text-sm ${selectedTier === 0 ? 'text-neon-green' : 'text-neon-cyan'}`}>
                                                            {realApy.toFixed(1)}% APY
                                                        </div>
                                                    </button>
                                                );
                                            })()}
                                        </div>

                                        {/* Fixed tiers - 2x2 grid */}
                                        <div className="grid grid-cols-2 gap-3">
                                            {STAKING_TIERS.slice(1).map((tier, idx) => {
                                                const index = idx + 1; // Offset since we sliced
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
                                        disabled={isStaking || !stakeAmount || parseFloat(stakeAmount) <= 0 || selectedTier === -1}
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
