import { cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useGameContextMenu } from './useGameContextMenu';

afterEach(cleanup);

describe('game browser context menus', () =>
{
    it('suppresses the browser menu on the page and portalled images without swallowing game handlers', () =>
    {
        renderHook(useGameContextMenu);
        const image = document.createElement('img');
        document.body.append(image);
        const gameHandler = vi.fn();
        image.addEventListener('contextmenu', gameHandler);
        const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
        image.dispatchEvent(event);
        expect(event.defaultPrevented).toBe(true);
        expect(gameHandler).toHaveBeenCalledOnce();
        const pageEvent = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
        document.body.dispatchEvent(pageEvent);
        expect(pageEvent.defaultPrevented).toBe(true);
        image.remove();
    });

    it('restores normal browser behavior when the game unmounts', () =>
    {
        const view = renderHook(useGameContextMenu);
        view.unmount();
        const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
        document.body.dispatchEvent(event);
        expect(event.defaultPrevented).toBe(false);
    });
});
