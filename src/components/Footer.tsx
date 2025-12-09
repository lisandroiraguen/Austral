import React from 'react';
import { useLanguage } from '../context/LanguageContext';

const Footer: React.FC = () => {
    const { t } = useLanguage();

    return (
        <footer className="relative py-12 px-6 bg-retro-darker border-t-2 border-neon-cyan/30">
            <div className="max-w-6xl mx-auto">
                {/* Decorative top line */}
                <div className="mb-8 flex justify-center">
                    <div className="w-full max-w-2xl h-1 bg-gradient-to-r from-transparent via-neon-magenta to-transparent
                          animate-pulse-slow" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
                    {/* Logo/Brand */}
                    <div className="text-center md:text-left">
                        <p className="font-synth text-sm text-gray-400 mb-4">
                            Reviving the 80s
                        </p>
                        <h3 className="font-display text-3xl font-bold mb-2
                           bg-gradient-to-r from-neon-cyan to-neon-magenta
                           bg-clip-text text-transparent">
                            AUSTRAL
                        </h3>

                    </div>

                    {/* Links */}
                    <div className="text-center">
                        <h4 className="font-synth text-neon-yellow uppercase text-sm mb-4">
                            Community
                        </h4>
                        <div className="flex justify-center gap-6">
                            <a
                                href="https://github.com/lisandroiraguen"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-bold text-2xl hover:text-neon-cyan transition-colors duration-300
                           hover:scale-110 transform"
                                aria-label="GitHub"
                            >
                                ⌘
                            </a>
                            <a
                                href="https://www.linkedin.com/in/lisandroiraguen/"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-bold text-2xl hover:text-neon-magenta transition-colors duration-300
                           hover:scale-110 transform"
                                aria-label="LinkedIn"
                            >
                                ◈
                            </a>
                        </div>
                    </div>

                    {/* Cardano */}
                    <div className="text-center md:text-right">
                        <h4 className="font-synth text-neon-cyan uppercase text-sm mb-4">
                            Built on
                        </h4>
                        <p className="font-display text-2xl text-white">
                            Cardano
                        </p>
                    </div>
                </div>

                {/* Tokenomics Info */}
                <div className="mb-8 text-center p-6 bg-retro-purple/20 rounded-lg border border-neon-yellow/30">
                    <h4 className="font-synth text-neon-yellow uppercase text-sm mb-3">
                        📊 Distribución de Tokens
                    </h4>
                    <p className="font-synth text-sm text-gray-300 mb-4">
                        El <span className="text-neon-green font-bold">10%</span> de las ganancias del staking
                        se destina a marketing, mantenimiento de la plataforma y servidores.
                    </p>
                    <a
                        href="/whitepaper.html"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-6 py-2 
                                   font-synth text-sm uppercase
                                   bg-neon-yellow/20 border border-neon-yellow text-neon-yellow
                                   rounded-lg hover:bg-neon-yellow hover:text-retro-dark
                                   transition-all duration-300"
                    >
                        📄 Ver Whitepaper
                    </a>
                </div>

                {/* Copyright */}
                <div className="text-center pt-8 border-t border-neon-cyan/20">
                    <p className="font-synth text-sm text-gray-500">
                        {t.footerText}
                    </p>
                    <p className="font-retro text-xs text-neon-magenta/50 mt-2">
                        ◢◤◢◤◢◤ RETRO VIBES ◢◤◢◤◢◤
                    </p>
                </div>
            </div>

            {/* Decorative corner elements */}
            <div className="absolute bottom-4 left-4 w-16 h-16 border-l-4 border-b-4 border-neon-cyan/30" />
            <div className="absolute bottom-4 right-4 w-16 h-16 border-r-4 border-b-4 border-neon-magenta/30" />
        </footer>
    );
};

export default Footer;
