import React, { createContext, useContext, useState, useCallback } from 'react';
import Toast from '../components/Toast';

interface ToastData {
    id: string;
    type: 'success' | 'error' | 'info';
    title: string;
    message: string;
    txHash?: string;
    duration?: number;
}

interface ToastContextType {
    showToast: (toast: Omit<ToastData, 'id'>) => void;
    success: (title: string, message: string, txHash?: string) => void;
    error: (title: string, message: string) => void;
    info: (title: string, message: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [toasts, setToasts] = useState<ToastData[]>([]);

    const removeToast = useCallback((id: string) => {
        setToasts(prev => prev.filter(toast => toast.id !== id));
    }, []);

    const showToast = useCallback((toast: Omit<ToastData, 'id'>) => {
        const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        setToasts(prev => [...prev, { ...toast, id }]);
    }, []);

    const success = useCallback((title: string, message: string, txHash?: string) => {
        showToast({ type: 'success', title, message, txHash, duration: 10000 });
    }, [showToast]);

    const error = useCallback((title: string, message: string) => {
        showToast({ type: 'error', title, message, duration: 8000 });
    }, [showToast]);

    const info = useCallback((title: string, message: string) => {
        showToast({ type: 'info', title, message, duration: 6000 });
    }, [showToast]);

    return (
        <ToastContext.Provider value={{ showToast, success, error, info }}>
            {children}

            {/* Toast Container */}
            <div className="fixed top-4 right-4 z-50 flex flex-col gap-3">
                {toasts.map(toast => (
                    <Toast
                        key={toast.id}
                        {...toast}
                        onClose={removeToast}
                    />
                ))}
            </div>
        </ToastContext.Provider>
    );
};
