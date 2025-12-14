import { ReactNode, MouseEvent } from "react";

interface FocusModeProps {
    isOpen: boolean;
    onClose: () => void;
    children: ReactNode;
}

// Focus Mode (Zen) Component
export function FocusMode({ isOpen, onClose, children }: FocusModeProps) {
    if (!isOpen) return null;

    const handleBackdropClick = (e: MouseEvent<HTMLDivElement>) => {
        if (e.target === e.currentTarget) {
            e.preventDefault();
            onClose();
        }
    };

    return (
        <div className="focus-mode-overlay" onMouseDown={handleBackdropClick}>
            <div className="focus-mode-content">
                <div className="focus-mode-inner" onMouseDown={(e) => e.stopPropagation()}>
                    {children}
                </div>
            </div>
        </div>
    );
}
