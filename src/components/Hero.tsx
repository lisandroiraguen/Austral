import React from 'react';
import { useLanguage } from '../context/LanguageContext';

const Hero: React.FC = () => {
    const { t } = useLanguage();

    return (
        <section className="relative min-h-screen flex items-center justify-center overflow-hidden
                        retro-grid-bg scanlines">
            {/* Animated gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-retro-purple/20 to-retro-dark/80" />

            {/* Floating 80s Argentine Icons */}
            <div className="absolute top-20 left-10 text-6xl animate-float opacity-70
                           drop-shadow-[0_0_15px_#00FFFF] hover:scale-110 transition-transform cursor-default"
                title="Pumper Nic">
                🍔
            </div>
            <div className="absolute bottom-32 right-10 text-5xl animate-float opacity-70
                           drop-shadow-[0_0_15px_#FF00FF]"
                style={{ animationDelay: '0.5s' }}
                title="Tele Retro">
                📺
            </div>
            <div className="absolute top-1/3 left-[15%] text-5xl animate-float opacity-70
                           drop-shadow-[0_0_15px_#FFFF00]"
                style={{ animationDelay: '1s' }}
                title="Cassette 80s">
                📼
            </div>
            <div className="absolute top-40 right-[20%] text-5xl animate-float opacity-70
                           drop-shadow-[0_0_15px_#39FF14]"
                style={{ animationDelay: '1.5s' }}
                title="Arcade">
                🕹️
            </div>
            <div className="absolute bottom-40 left-[25%] text-4xl animate-float opacity-70
                           drop-shadow-[0_0_15px_#FF1493]"
                style={{ animationDelay: '2s' }}
                title="Boombox">
                📻
            </div>
            <div className="absolute top-[60%] right-[10%] text-4xl animate-float opacity-70
                           drop-shadow-[0_0_15px_#00FFFF]"
                style={{ animationDelay: '2.5s' }}
                title="Disco">
                🪩
            </div>

            {/* Content */}
            <div className="relative z-10 max-w-6xl mx-auto px-6 py-20 text-center">
                {/* Main Title */}
                <h1 className="font-display text-7xl md:text-9xl font-bold mb-6
                       bg-gradient-to-r from-neon-cyan via-neon-magenta to-neon-yellow
                       bg-clip-text text-transparent
                       animate-glow animate-slide-up">
                    {t.heroTitle}
                </h1>

                {/* Subtitle */}
                <p className="font-synth text-2xl md:text-4xl text-neon-cyan mb-4
                      text-glow-cyan animate-slide-up"
                    style={{ animationDelay: '0.2s' }}>
                    {t.heroSubtitle}
                </p>

                {/* Description */}
                <p className="font-synth text-lg md:text-xl text-gray-300 max-w-3xl mx-auto mb-12
                      leading-relaxed animate-slide-up"
                    style={{ animationDelay: '0.4s' }}>
                    {t.heroDescription}
                </p>

                {/* CTA Button */}
                <div className="flex justify-center gap-4 animate-slide-up"
                    style={{ animationDelay: '0.6s' }}>
                    <a
                        href="#about"
                        className="relative px-8 py-4 font-synth text-lg font-bold uppercase tracking-wider
                       bg-gradient-to-r from-neon-magenta via-neon-purple to-neon-cyan
                       text-white rounded-lg overflow-hidden
                       transition-all duration-300 hover:scale-105
                       shadow-neon-magenta hover:shadow-neon-cyan
                       group"
                    >
                        <span className="relative z-10">{t.learnMore}</span>
                        <div className="absolute inset-0 bg-gradient-to-r from-neon-cyan via-neon-yellow to-neon-magenta
                            opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    </a>
                </div>

                {/* Decorative line */}
                <div className="mt-16 flex justify-center">
                    <div className="w-64 h-1 bg-gradient-to-r from-transparent via-neon-cyan to-transparent
                          animate-pulse-slow" />
                </div>
            </div>

            {/* Bottom fade */}
            <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-retro-dark to-transparent" />
        </section>
    );
};

export default Hero;
