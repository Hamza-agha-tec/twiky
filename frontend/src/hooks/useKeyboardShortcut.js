import { useEffect } from 'react';

/**
 * Custom hook to handle global keyboard shortcuts.
 * @param {string} key - The key to listen for (e.g., 'Delete', 'Escape').
 * @param {Function} callback - The function to call when the key is pressed.
 * @param {boolean} disabled - Whether the shortcut is currently disabled.
 */
export function useKeyboardShortcut(key, callback, disabled = false) {
    useEffect(() => {
        if (disabled) return;

        const handleKeyDown = (event) => {
            // Ignore if focus is in an input, textarea, or contenteditable element
            const activeElement = document.activeElement;
            const isInput = activeElement.tagName === 'INPUT' ||
                activeElement.tagName === 'TEXTAREA' ||
                activeElement.isContentEditable;

            if (isInput) return;

            if (event.key === key) {
                callback(event);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [key, callback, disabled]);
}
