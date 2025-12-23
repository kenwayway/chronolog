import { useEffect, useCallback, MouseEvent } from 'react';
import { X, ZoomIn, ZoomOut } from 'lucide-react';
import { useState } from 'react';

interface ImageLightboxProps {
    src: string;
    onClose: () => void;
}

/**
 * Full-screen image lightbox with zoom controls
 */
export function ImageLightbox({ src, onClose }: ImageLightboxProps) {
    const [scale, setScale] = useState(1);

    // Close on Escape key, zoom with +/-
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
            if (e.key === '+' || e.key === '=') setScale(s => Math.min(s + 0.25, 3));
            if (e.key === '-') setScale(s => Math.max(s - 0.25, 0.5));
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    // Prevent body scroll when lightbox is open
    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = '';
        };
    }, []);

    const handleBackdropClick = useCallback((e: MouseEvent) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    }, [onClose]);

    const handleZoomIn = () => setScale(s => Math.min(s + 0.25, 3));
    const handleZoomOut = () => setScale(s => Math.max(s - 0.25, 0.5));

    return (
        <div
            onClick={handleBackdropClick}
            style={{
                position: 'fixed',
                inset: 0,
                zIndex: 9999,
                backgroundColor: 'rgba(0, 0, 0, 0.9)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'zoom-out',
            }}
        >
            {/* Close button */}
            <button
                onClick={onClose}
                style={{
                    position: 'absolute',
                    top: 16,
                    right: 16,
                    padding: 8,
                    backgroundColor: 'rgba(255, 255, 255, 0.1)',
                    border: 'none',
                    borderRadius: 4,
                    color: 'white',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'background-color 150ms',
                }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.2)'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)'}
            >
                <X size={24} />
            </button>

            {/* Controls */}
            <div
                style={{
                    position: 'absolute',
                    bottom: 16,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    display: 'flex',
                    gap: 8,
                    backgroundColor: 'rgba(0, 0, 0, 0.6)',
                    padding: '8px 16px',
                    borderRadius: 8,
                }}
            >
                <button
                    onClick={handleZoomOut}
                    disabled={scale <= 0.5}
                    style={{
                        padding: 8,
                        backgroundColor: 'transparent',
                        border: 'none',
                        color: scale <= 0.5 ? 'rgba(255,255,255,0.3)' : 'white',
                        cursor: scale <= 0.5 ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                    }}
                    title="Zoom out (-)"
                >
                    <ZoomOut size={20} />
                </button>
                <span style={{ color: 'white', fontSize: 14, display: 'flex', alignItems: 'center', minWidth: 50, justifyContent: 'center' }}>
                    {Math.round(scale * 100)}%
                </span>
                <button
                    onClick={handleZoomIn}
                    disabled={scale >= 3}
                    style={{
                        padding: 8,
                        backgroundColor: 'transparent',
                        border: 'none',
                        color: scale >= 3 ? 'rgba(255,255,255,0.3)' : 'white',
                        cursor: scale >= 3 ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                    }}
                    title="Zoom in (+)"
                >
                    <ZoomIn size={20} />
                </button>
            </div>

            {/* Image */}
            <img
                src={src}
                alt="Full size"
                onClick={e => e.stopPropagation()}
                style={{
                    maxWidth: '90vw',
                    maxHeight: '85vh',
                    objectFit: 'contain',
                    cursor: 'default',
                    transform: `scale(${scale})`,
                    transition: 'transform 200ms ease',
                }}
            />
        </div>
    );
}
