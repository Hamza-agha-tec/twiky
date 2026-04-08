import { useCallback } from 'react';

export const useSound = (url) => {
    const play = useCallback(() => {
        const audio = new Audio(url);
        audio.volume = 0.5;
        audio.play().catch(e => console.error("Audio play failed", e));
    }, [url]);

    return play;
};
