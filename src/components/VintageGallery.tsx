import React from 'react';
import { useLanguage } from '../context/LanguageContext';

// Import images from artifacts directory
const coinImage = '/images/austral-coin.png';
const banknoteImage = '/images/austral-banknote.png';

const VintageGallery: React.FC = () => {
    const { t } = useLanguage();

    return (
        <section id="about" className="relative py-20 px-6 bg-gradient-to-b from-retro-dark via-retro-purple to-retro-dark">
            <div className="max-w-6xl mx-auto">
                {/* About Section */}
                <div className="mb-16 text-center">
                    <h2 className="font-display text-4xl md:text-5xl font-bold mb-6
                         bg-gradient-to-r from-neon-magenta via-neon-yellow to-neon-cyan
                         bg-clip-text text-transparent">
                        {t.aboutTitle}
                    </h2>

                    <p className="font-synth text-lg text-gray-300 max-w-3xl mx-auto leading-relaxed mb-12">
                        {t.aboutDescription}
                    </p>

                    {/* History Section */}
                    <div className="mt-16 mb-20">
                        <h3 className="font-synth text-2xl md:text-3xl text-neon-yellow text-center mb-8
                             text-glow-yellow uppercase">
                            {t.historyTitle}
                        </h3>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-left">
                            <div className="bg-retro-purple/20 p-6 rounded-lg border border-neon-magenta/30 hover:border-neon-magenta transition-colors">
                                <p className="font-synth text-gray-300 leading-relaxed">
                                    {t.historyContent1}
                                </p>
                            </div>
                            <div className="bg-retro-purple/20 p-6 rounded-lg border border-neon-cyan/30 hover:border-neon-cyan transition-colors">
                                <p className="font-synth text-gray-300 leading-relaxed">
                                    {t.historyContent2}
                                </p>
                            </div>
                            <div className="bg-retro-purple/20 p-6 rounded-lg border border-neon-yellow/30 hover:border-neon-yellow transition-colors">
                                <p className="font-synth text-gray-300 leading-relaxed">
                                    {t.historyContent3}
                                </p>
                            </div>
                        </div>

                        {/* YouTube Video */}
                        <div className="mt-12 max-w-3xl mx-auto">
                            <div className="relative group">
                                <div className="absolute inset-0 bg-gradient-to-r from-neon-magenta to-neon-cyan 
                                    opacity-20 blur-xl group-hover:opacity-40 transition-opacity duration-300" />
                                <div className="relative bg-retro-purple/30 backdrop-blur-sm border-2 border-neon-magenta
                                    rounded-xl p-2 hover:border-neon-cyan transition-all duration-300">
                                    <div className="aspect-video rounded-lg overflow-hidden">
                                        <iframe
                                            src="https://www.youtube.com/embed/bhJx8s5TqMk"
                                            title="Historia del Austral"
                                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                            allowFullScreen
                                            className="w-full h-full"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Full Set Image */}
                <div className="mb-20">
                    <div className="relative group max-w-4xl mx-auto">
                        <div className="absolute inset-0 bg-gradient-to-r from-neon-magenta via-neon-purple to-neon-cyan
                            opacity-20 blur-2xl group-hover:opacity-40 transition-opacity duration-500" />

                        <div className="relative bg-retro-purple/30 backdrop-blur-sm border-2 border-neon-purple
                            rounded-xl p-2 hover:border-neon-magenta transition-all duration-300">
                            <div className="aspect-video bg-gray-900 rounded-lg overflow-hidden relative">
                                <img
                                    src="/images/austral-full-set.png"
                                    alt={t.fullSetTitle}
                                    className="w-full h-full object-cover hover:scale-105 transition-transform duration-700"
                                />
                                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-6">
                                    <h4 className="font-display text-xl text-neon-yellow mb-2">{t.fullSetTitle}</h4>
                                    <p className="font-synth text-sm text-gray-300">{t.fullSetDescription}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Vintage Gallery */}
                <div className="mt-16">
                    <h3 className="font-synth text-2xl md:text-3xl text-neon-cyan text-center mb-8
                         text-glow-cyan uppercase">
                        {t.vintageTitle}
                    </h3>

                    <p className="font-synth text-center text-gray-400 mb-12">
                        {t.vintageDescription}
                    </p>

                    {/* Image Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Coin Image */}
                        <div className="relative group">
                            <div className="absolute inset-0 bg-gradient-to-br from-neon-yellow to-neon-orange
                              opacity-30 blur-2xl group-hover:opacity-50 transition-opacity duration-500" />

                            <div className="relative bg-retro-purple/30 backdrop-blur-sm border-4 border-neon-yellow
                              rounded-lg p-6 hover:border-neon-orange transition-all duration-300
                              hover:scale-105 transform">
                                <div className="aspect-square bg-gradient-to-br from-gray-900 to-gray-800 rounded-lg
                                overflow-hidden shadow-2xl">
                                    <img
                                        src={coinImage}
                                        alt="Vintage Austral Coin"
                                        className="w-full h-full object-cover hover:scale-110 transition-transform duration-500"
                                        onError={(e) => {
                                            // Fallback if image doesn't load
                                            e.currentTarget.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="400"%3E%3Crect fill="%23222" width="400" height="400"/%3E%3Ctext fill="%2300FFFF" font-family="monospace" font-size="20" x="50%25" y="50%25" text-anchor="middle" dominant-baseline="middle"%3EAustral Coin%3C/text%3E%3C/svg%3E';
                                        }}
                                    />
                                </div>

                                <div className="mt-4 text-center">
                                    <p className="font-retro text-xs text-neon-yellow uppercase tracking-wider">
                                        Moneda Austral • 1985-1991
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Banknote Image */}
                        <div className="relative group">
                            <div className="absolute inset-0 bg-gradient-to-br from-neon-cyan to-neon-magenta
                              opacity-30 blur-2xl group-hover:opacity-50 transition-opacity duration-500" />

                            <div className="relative bg-retro-purple/30 backdrop-blur-sm border-4 border-neon-cyan
                              rounded-lg p-6 hover:border-neon-magenta transition-all duration-300
                              hover:scale-105 transform">
                                <div className="aspect-square bg-gradient-to-br from-gray-900 to-gray-800 rounded-lg
                                overflow-hidden shadow-2xl">
                                    <img
                                        src={banknoteImage}
                                        alt="Vintage Austral Banknote"
                                        className="w-full h-full object-cover hover:scale-110 transition-transform duration-500"
                                        onError={(e) => {
                                            // Fallback if image doesn't load
                                            e.currentTarget.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="400"%3E%3Crect fill="%23222" width="400" height="400"/%3E%3Ctext fill="%23FF00FF" font-family="monospace" font-size="20" x="50%25" y="50%25" text-anchor="middle" dominant-baseline="middle"%3EAustral Banknote%3C/text%3E%3C/svg%3E%3C/svg%3E';
                                        }}
                                    />
                                </div>

                                <div className="mt-4 text-center">
                                    <p className="font-retro text-xs text-neon-cyan uppercase tracking-wider">
                                        Billete Austral • 1985-1991
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default VintageGallery;
