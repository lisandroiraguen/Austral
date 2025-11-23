import React from 'react';
import { useLanguage } from '../context/LanguageContext';

const LanguageSwitcher: React.FC = () => {
    const { language, setLanguage } = useLanguage();

    const toggleLanguage = () => {
        setLanguage(language === 'en' ? 'es' : 'en');
    };

    return (
        <button
            onClick={toggleLanguage}
            className="relative px-6 py-2 font-synth text-sm font-bold uppercase tracking-wider
                 bg-gradient-to-r from-neon-cyan via-neon-magenta to-neon-yellow
                 text-retro-dark rounded-lg overflow-hidden
                 transition-all duration-300 hover:scale-105 hover:shadow-neon-cyan
                 group"
        >
            <span className="relative z-10 flex items-center gap-2">
                <span className="text-lg">{language === 'en' ? '🇬🇧' : '🇦🇷'}</span>
                <span>{language === 'en' ? 'EN' : 'ES'}</span>
            </span>

            {/* Animated background */}
            <div className="absolute inset-0 bg-gradient-to-r from-neon-magenta via-neon-yellow to-neon-cyan
                      opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        </button>
    );
};

export default LanguageSwitcher;
