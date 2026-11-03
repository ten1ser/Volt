import { CreateLinkEvent } from '@volt/renderer';
import { useEffect } from 'react';

// Alt, because the chat bar takes focus on any printable key, so a bare letter would land in chat.
export const DISTRICT_SHORTCUTS: Record<string, string> = { KeyB: 'backpack/toggle', KeyR: 'radio/toggle', KeyP: 'phone/toggle' };

const topWindow = (): HTMLElement | null =>
{
    let top: HTMLElement | null = null;

    for(const element of document.querySelectorAll<HTMLElement>('#draggable-windows-container > .draggable-window'))
    {
        if(!top || Number(element.style.zIndex || 0) > Number(top.style.zIndex || 0)) top = element;
    }
    return top;
};

/** Esc closes the DistrictRP window in front; Alt+B, Alt+R and Alt+P toggle the backpack, radio and phone. */
export const useDistrictWindowKeys = () =>
{
    useEffect(() =>
    {
        const onKeyDown = (event: KeyboardEvent) =>
        {
            if(event.defaultPrevented || event.repeat) return;

            if(event.key === 'Escape')
            {
                // Only an RP window in front is closed; a hotel window in front keeps its own Escape handling.
                const close = topWindow()?.querySelector<HTMLButtonElement>('.district-rp-close');

                if(!close) return;
                event.preventDefault();
                close.click();
                return;
            }

            const link = DISTRICT_SHORTCUTS[event.code];

            if(!link || !event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
            event.preventDefault();
            CreateLinkEvent(link);
        };

        document.addEventListener('keydown', onKeyDown);
        return () => document.removeEventListener('keydown', onKeyDown);
    }, []);
};
