import { MeshProvider } from '@meshsdk/react';
import { LanguageProvider } from './context/LanguageContext';
import LanguageSwitcher from './components/LanguageSwitcher';
import WalletConnect from './components/WalletConnect';
import Hero from './components/Hero';
import TokenStats from './components/TokenStats';
import Staking from './components/Staking';
import VintageGallery from './components/VintageGallery';
import Footer from './components/Footer';

function App() {
  return (
    <MeshProvider>
      <LanguageProvider>
        <div className="min-h-screen bg-retro-dark">
          {/* Navigation Bar */}
          <nav className="fixed top-0 left-0 right-0 z-50 bg-retro-dark/80 backdrop-blur-md
                          border-b-2 border-neon-cyan/30">
            <div className="max-w-7xl mx-auto px-6 py-4">
              <div className="flex items-center justify-between">
                {/* Logo */}
                <div className="flex items-center gap-3">
                  <span className="text-3xl">₳</span>
                  <h1 className="font-display text-2xl font-bold
                                 bg-gradient-to-r from-neon-cyan to-neon-magenta
                                 bg-clip-text text-transparent">
                    AUSTRAL
                  </h1>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-4">
                  <LanguageSwitcher />
                  <WalletConnect />
                </div>
              </div>
            </div>
          </nav>

          {/* Main Content */}
          <main className="pt-20">
            <Hero />
            <TokenStats />
            <Staking />
            <VintageGallery />
          </main>

          {/* Footer */}
          <Footer />
        </div>
      </LanguageProvider>
    </MeshProvider>
  );
}

export default App;
