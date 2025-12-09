// Focus Mode (Zen) Component
export function FocusMode({ isOpen, onClose, children }) {
    if (!isOpen) return null;

    const handleBackdropClick = (e) => {
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
