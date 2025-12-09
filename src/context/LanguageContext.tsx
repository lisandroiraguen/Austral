import React, { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { Language, Translations } from '../types';

const translations: Translations = {
    en: {
        // Navigation
        connectWallet: 'Connect Wallet',
        disconnect: 'Disconnect',

        // Hero Section
        heroTitle: 'AUSTRAL',
        heroSubtitle: 'Reviving the 80s Argentine Currency',
        heroDescription: 'Experience the nostalgia of the 1980s Austral, now reimagined as a Cardano native token. Join us in celebrating Argentina\'s economic history with cutting-edge blockchain technology.',
        learnMore: 'Learn More',

        // Token Stats
        yourBalance: 'Your Balance',
        totalPool: 'Total Pool',
        contractAddress: 'Contract Address',
        copyAddress: 'Copy Address',
        copied: 'Copied!',
        notConnected: 'Connect wallet to view',

        // About Section
        aboutTitle: 'About Austral',
        aboutDescription: 'The Austral was the currency of Argentina between 1985 and 1991. It replaced the peso argentino at a rate of 1 austral = 1000 pesos. Now, we bring this iconic currency back to life as a Cardano token, preserving its legacy in the blockchain era.',

        // History Section
        historyTitle: 'The Rise and Fall',
        historyContent1: 'Launched in June 1985 by President Raúl Alfonsín, the Plan Austral was a bold attempt to stabilize the Argentine economy. It introduced a new currency, the Austral, replacing the peso argentino with three zeros removed. Initially, the plan succeeded in curbing inflation and bringing hope to the nation.',
        historyContent2: 'However, by the late 1980s, the initial success faded. Fiscal deficits and external pressures led to a resurgence of inflation, culminating in the hyperinflation of 1989 and 1990. The Austral lost its value rapidly, with banknotes reaching denominations of 500,000 australs.',
        historyContent3: 'In 1991, the Austral was replaced by the Peso Convertible at a rate of 10,000 australs to 1 peso, marking the end of a turbulent but unforgettable chapter in Argentine economic history.',

        vintageTitle: 'Vintage Collection',
        vintageDescription: 'Explore authentic Austral banknotes and coins from the 1980s',
        fullSetTitle: 'Complete Collection',
        fullSetDescription: 'A rare glimpse into the full spectrum of Austral currency, from the 1 centavo coin to the 500,000 austral banknote.',

        // Footer
        footerText: '© 2025 Austral Token. Built on Cardano.',

        // Wallet
        walletConnecting: 'Connecting...',
        walletConnected: 'Connected',
        walletError: 'Failed to connect wallet',
        selectWallet: 'Select a wallet to connect',

        // Staking
        stakingTitle: 'ADA Staking',
        stakingDescription: 'Stake your ADA and earn rewards. The longer you stake, the higher your APY.',
        stakeADA: 'Stake ADA',
        connectToStake: 'Connect your wallet to start staking',
        availableBalance: 'Available Balance',
        stakeAmount: 'Amount to Stake',
        stakeDuration: 'Select Duration',
        month: 'Month',
        months: 'Months',
        estimatedReward: 'Estimated Reward',
        staking: 'Staking...',
        stakeNow: 'Stake Now',
        stakingRewards: 'Staking Rewards',
        lockPeriod: 'Lock Period',
        stakingNote: 'Important',
        stakingNoteDescription: 'Your ADA will be locked for the selected duration. Rewards will be distributed at the end of the staking period.',
    },
    es: {
        // Navigation
        connectWallet: 'Conectar Billetera',
        disconnect: 'Desconectar',

        // Hero Section
        heroTitle: 'AUSTRAL',
        heroSubtitle: 'Reviviendo la Moneda Argentina de los 80',
        heroDescription: 'Experimenta la nostalgia del Austral de los años 1980, ahora reimaginado como un token nativo de Cardano. Únete a nosotros para celebrar la historia económica de Argentina con tecnología blockchain de vanguardia.',
        learnMore: 'Saber Más',

        // Token Stats
        yourBalance: 'Tu Balance',
        totalPool: 'Pool Total',
        contractAddress: 'Dirección del Contrato',
        copyAddress: 'Copiar Dirección',
        copied: '¡Copiado!',
        notConnected: 'Conecta tu billetera para ver',

        // About Section
        aboutTitle: 'Sobre Austral',
        aboutDescription: 'El Austral fue la moneda de Argentina entre 1985 y 1991. Reemplazó al peso argentino a una tasa de 1 austral = 1000 pesos. Ahora, traemos de vuelta esta icónica moneda como un token de Cardano, preservando su legado en la era blockchain.',

        // History Section
        historyTitle: 'El Auge y la Caída',
        historyContent1: 'Lanzado en junio de 1985 por el presidente Raúl Alfonsín, el Plan Austral fue un intento audaz de estabilizar la economía argentina. Introdujo una nueva moneda, el Austral, reemplazando al peso argentino con la quita de tres ceros. Inicialmente, el plan logró frenar la inflación y traer esperanza a la nación.',
        historyContent2: 'Sin embargo, a fines de la década de 1980, el éxito inicial se desvaneció. Los déficits fiscales y las presiones externas llevaron a un resurgimiento de la inflación, culminando en la hiperinflación de 1989 y 1990. El Austral perdió su valor rápidamente, con billetes que alcanzaron denominaciones de 500.000 australes.',
        historyContent3: 'En 1991, el Austral fue reemplazado por el Peso Convertible a una tasa de 10.000 australes por 1 peso, marcando el fin de un capítulo turbulento pero inolvidable en la historia económica argentina.',

        vintageTitle: 'Colección Vintage',
        vintageDescription: 'Explora billetes y monedas auténticas del Austral de los años 80',
        fullSetTitle: 'Colección Completa',
        fullSetDescription: 'Un vistazo único a la gama completa de la moneda Austral, desde la moneda de 1 centavo hasta el billete de 500.000 australes.',

        // Footer
        footerText: '© 2025 Austral Token. Construido en Cardano.',

        // Wallet
        walletConnecting: 'Conectando...',
        walletConnected: 'Conectado',
        walletError: 'Error al conectar billetera',
        selectWallet: 'Selecciona una billetera para conectar',

        // Staking
        stakingTitle: 'Staking de ADA',
        stakingDescription: 'Stakea tu ADA y gana recompensas. Cuanto más tiempo stakees, mayor será tu APY.',
        stakeADA: 'Stakear ADA',
        connectToStake: 'Conecta tu billetera para comenzar a stakear',
        availableBalance: 'Balance Disponible',
        stakeAmount: 'Cantidad a Stakear',
        stakeDuration: 'Seleccionar Duración',
        month: 'Mes',
        months: 'Meses',
        estimatedReward: 'Recompensa Estimada',
        staking: 'Stakeando...',
        stakeNow: 'Stakear Ahora',
        stakingRewards: 'Recompensas de Staking',
        lockPeriod: 'Período de Bloqueo',
        stakingNote: 'Importante',
        stakingNoteDescription: 'Tu ADA estará bloqueado durante el período seleccionado. Las recompensas se distribuirán al final del período de staking.',
    },
};

interface LanguageContextType {
    language: Language;
    setLanguage: (lang: Language) => void;
    t: Translations[Language];
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [language, setLanguageState] = useState<Language>(() => {
        // Load from localStorage or default to Spanish
        const saved = localStorage.getItem('austral-language');
        return (saved as Language) || 'es';
    });

    useEffect(() => {
        // Save to localStorage whenever language changes
        localStorage.setItem('austral-language', language);
    }, [language]);

    const setLanguage = (lang: Language) => {
        setLanguageState(lang);
    };

    const value: LanguageContextType = {
        language,
        setLanguage,
        t: translations[language],
    };

    return (
        <LanguageContext.Provider value={value}>
            {children}
        </LanguageContext.Provider>
    );
};

export const useLanguage = (): LanguageContextType => {
    const context = useContext(LanguageContext);
    if (!context) {
        throw new Error('useLanguage must be used within a LanguageProvider');
    }
    return context;
};
