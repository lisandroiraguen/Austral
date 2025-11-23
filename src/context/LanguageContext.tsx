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
        vintageTitle: 'Vintage Collection',
        vintageDescription: 'Explore authentic Austral banknotes and coins from the 1980s',

        // Footer
        footerText: '© 2025 Austral Token. Built on Cardano.',

        // Wallet
        walletConnecting: 'Connecting...',
        walletConnected: 'Connected',
        walletError: 'Failed to connect wallet',
        selectWallet: 'Select a wallet to connect',
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
        vintageTitle: 'Colección Vintage',
        vintageDescription: 'Explora billetes y monedas auténticas del Austral de los años 80',

        // Footer
        footerText: '© 2025 Austral Token. Construido en Cardano.',

        // Wallet
        walletConnecting: 'Conectando...',
        walletConnected: 'Conectado',
        walletError: 'Error al conectar billetera',
        selectWallet: 'Selecciona una billetera para conectar',
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
