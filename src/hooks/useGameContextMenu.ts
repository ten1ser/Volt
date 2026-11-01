import { useEffect } from 'react';

/** Covers body portals and images while leaving game right-click handlers intact. */
export const useGameContextMenu = () =>
{
    useEffect(() =>
    {
        const suppressBrowserMenu = (event: MouseEvent) => event.preventDefault();
        document.addEventListener('contextmenu', suppressBrowserMenu, true);
        return () => document.removeEventListener('contextmenu', suppressBrowserMenu, true);
    }, []);
};
