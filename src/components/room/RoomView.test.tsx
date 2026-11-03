import { cleanup, render } from '@testing-library/react';
import { FC, ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DispatchMouseEvent, DispatchWheelEvent } from '../../api';
import { RoomView } from './RoomView';

const renderer = vi.hoisted(() => ({ canvas: null as HTMLCanvasElement }));

vi.mock('@volt/renderer', () => ({
    GetEventDispatcher: () => ({ addEventListener: vi.fn(), removeEventListener: vi.fn() }),
    GetRenderer: () => renderer,
    RoomObjectMouseEvent: { CLICK: 'ROE_MOUSE_CLICK' },
    RoomObjectTileMouseEvent: class {},
    RoomSession: class {}
}));

vi.mock('../../api', () => ({
    DispatchMouseEvent: vi.fn(),
    DispatchTouchEvent: vi.fn(),
    DispatchWheelEvent: vi.fn()
}));

vi.mock('../../hooks', () => ({
    useRoom: () => ({ roomSession: { roomId: 5 } }),
    useRoomKeyboardMovement: vi.fn()
}));

vi.mock('../../layout', () => ({ classNames: (...names: string[]) => names.filter(Boolean).join(' ') }));

vi.mock('framer-motion', () => ({
    AnimatePresence: ({ children }: { children: ReactNode }) => children,
    motion: { div: (({ children, className }: { children: ReactNode; className?: string }) => <div className={className}>{children}</div>) as FC }
}));

vi.mock('../roleplay/hud/CityBackdrop', () => ({ CityBackdrop: () => null }));
vi.mock('./spectator/RoomSpectatorView', () => ({ RoomSpectatorView: () => null }));
vi.mock('./widgets/RoomWidgetsView', () => ({ RoomWidgetsView: () => null }));
vi.mock('./widgets/wired-fx/WiredVariableFxOverlayView', () => ({ WiredVariableFxOverlayView: () => null }));

const dispatched = () => vi.mocked(DispatchMouseEvent).mock.calls.map(([event]) => event.type);

beforeEach(() => {
    renderer.canvas = document.createElement('canvas');
    vi.mocked(DispatchMouseEvent).mockClear();
    vi.mocked(DispatchWheelEvent).mockClear();
});

afterEach(() => cleanup());

describe('RoomView canvas input', () => {
    it('ends a press on the room that is released over the UI (AIR WME_UP_OUTSIDE)', () => {
        const { getByTestId } = render(
            <>
                <RoomView />
                <button data-testid="toolbar" />
            </>
        );
        const canvas = renderer.canvas;

        canvas.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 10, clientY: 10, buttons: 1 }));
        getByTestId('toolbar').dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX: 400, clientY: 300 }));

        expect(dispatched()).toEqual(['mousedown', 'mouseup']);
        expect(vi.mocked(DispatchMouseEvent).mock.calls[1][0]).toMatchObject({ clientX: 400, clientY: 300 });
    });

    it('forwards a release on the canvas only once', () => {
        render(<RoomView />);

        const canvas = renderer.canvas;

        canvas.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
        canvas.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
        canvas.dispatchEvent(new MouseEvent('click', { bubbles: true }));

        expect(dispatched()).toEqual(['mousedown', 'mouseup', 'click']);
    });

    it('ignores releases elsewhere when the room was not pressed', () => {
        render(<RoomView />);

        document.body.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));

        expect(DispatchMouseEvent).not.toHaveBeenCalled();
    });

    it('releases the press at the last pointer position when the window loses focus', () => {
        render(<RoomView />);

        const canvas = renderer.canvas;

        canvas.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 50, clientY: 60 }));
        canvas.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 50, clientY: 60 }));
        window.dispatchEvent(new Event('blur'));
        window.dispatchEvent(new Event('blur'));

        expect(dispatched()).toEqual(['mousemove', 'mousedown', 'mouseup']);
        expect(vi.mocked(DispatchMouseEvent).mock.calls[2][0]).toMatchObject({ clientX: 50, clientY: 60 });
    });

    it('forwards double-clicks and wheel events from the canvas', () => {
        render(<RoomView />);

        const canvas = renderer.canvas;
        const wheel = new WheelEvent('wheel', { deltaY: -100, ctrlKey: true, cancelable: true });

        canvas.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
        canvas.dispatchEvent(wheel);

        expect(dispatched()).toEqual(['dblclick']);
        expect(DispatchWheelEvent).toHaveBeenCalledWith(wheel, 5);
    });

    it('stops listening to the window and the wheel once the room view is gone', () => {
        const { unmount } = render(<RoomView />);

        const canvas = renderer.canvas;

        canvas.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
        vi.mocked(DispatchMouseEvent).mockClear();

        unmount();

        document.body.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
        window.dispatchEvent(new Event('blur'));
        canvas.dispatchEvent(new WheelEvent('wheel', { deltaY: 100 }));

        expect(DispatchMouseEvent).not.toHaveBeenCalled();
        expect(DispatchWheelEvent).not.toHaveBeenCalled();
    });
});
