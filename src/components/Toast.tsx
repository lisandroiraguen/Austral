import React, { useEffect, useState } from 'react';

interface ToastProps {
    id: string;
    type: 'success' | 'error' | 'info';
    title: string;
    message: string;
    txHash?: string;
    onClose: (id: string) => void;
    duration?: number;
}

const Toast: React.FC<ToastProps> = ({
    id,
    type,
    title,
    message,
    txHash,
    onClose,
    duration = 8000
}) => {
    const [isExiting, setIsExiting] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => {
            setIsExiting(true);
            setTimeout(() => onClose(id), 300);
        }, duration);

        return () => clearTimeout(timer);
    }, [id, duration, onClose]);

    const handleClose = () => {
        setIsExiting(true);
        setTimeout(() => onClose(id), 300);
    };

    const getStyles = () => {
        switch (type) {
            case 'success':
                return {
                    border: 'border-neon-green',
                    bg: 'bg-neon-green/10',
                    glow: 'shadow-[0_0_20px_rgba(0,255,136,0.3)]',
                    icon: '✓',
                    iconColor: 'text-neon-green',
                    titleColor: 'text-neon-green'
                };
            case 'error':
                return {
                    border: 'border-red-500',
                    bg: 'bg-red-500/10',
                    glow: 'shadow-[0_0_20px_rgba(239,68,68,0.3)]',
                    icon: '✕',
                    iconColor: 'text-red-500',
                    titleColor: 'text-red-400'
                };
            case 'info':
            default:
                return {
                    border: 'border-neon-cyan',
                    bg: 'bg-neon-cyan/10',
                    glow: 'shadow-[0_0_20px_rgba(0,255,255,0.3)]',
                    icon: 'ℹ',
                    iconColor: 'text-neon-cyan',
                    titleColor: 'text-neon-cyan'
                };
        }
    };

    const styles = getStyles();

    return (
        <div
            className={`
                relative w-96 max-w-[calc(100vw-2rem)]
                ${styles.bg} ${styles.border} ${styles.glow}
                border-2 rounded-lg p-4
                backdrop-blur-md
                transform transition-all duration-300 ease-out
                ${isExiting ? 'opacity-0 translate-x-full' : 'opacity-100 translate-x-0'}
                animate-slide-in
            `}
        >
            {/* Scanline effect */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-lg">
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/5 to-transparent 
                                animate-scanline" />
            </div>

            {/* Close button */}
            <button
                onClick={handleClose}
                className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center
                           text-gray-400 hover:text-white transition-colors duration-200
                           font-display text-sm"
            >
                ×
            </button>

            {/* Content */}
            <div className="flex items-start gap-3">
                {/* Icon */}
                <div className={`
                    flex-shrink-0 w-10 h-10 flex items-center justify-center
                    border-2 ${styles.border} rounded-lg
                    ${styles.iconColor} font-display text-xl
                    animate-pulse-slow
                `}>
                    {styles.icon}
                </div>

                {/* Text */}
                <div className="flex-1 min-w-0 pr-4">
                    <h4 className={`font-display text-lg uppercase ${styles.titleColor} mb-1`}>
                        {title}
                    </h4>
                    <p className="font-synth text-sm text-gray-300 break-words">
                        {message}
                    </p>
                    {txHash && (
                        <a
                            href={`https://preview.cardanoscan.io/transaction/${txHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 mt-2 
                                       font-mono text-xs text-neon-yellow 
                                       hover:text-neon-magenta transition-colors duration-200"
                        >
                            <span>TxHash: {txHash.slice(0, 8)}...{txHash.slice(-8)}</span>
                            <span>↗</span>
                        </a>
                    )}
                </div>
            </div>

            {/* Progress bar */}
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-retro-dark/50 rounded-b-lg overflow-hidden">
                <div
                    className={`h-full ${type === 'success' ? 'bg-neon-green' : type === 'error' ? 'bg-red-500' : 'bg-neon-cyan'}
                               animate-progress`}
                    style={{ animationDuration: `${duration}ms` }}
                />
            </div>
        </div>
    );
};

export default Toast;
