import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HealOfferView } from './HealOfferView';

const state = vi.hoisted(() => ({ authenticated: true, room: { roomId: 3 },
    receive: null, send: vi.fn() }));
vi.mock('@volt/renderer', () => ({ RpHealOfferEvent: class
{}, RpHealResponseComposer: class
{
    constructor(public offerId: string, public accepted: number)
    {}
} }));
vi.mock('../../../api', () => ({ SendMessageComposer: state.send }));
vi.mock('../../../hooks', () => ({ useMessageEvent: (_type: unknown, callback: typeof state.receive) =>
{
    state.receive = callback;
} }));
vi.mock('../../../hooks/events/useConnectionState', () => ({ useConnectionState: () => ({ authenticated: state.authenticated }) }));
vi.mock('../../../hooks/session/useSessionSnapshots', () => ({ useActiveRoomSessionSnapshot: () => state.room }));
vi.mock('../../../common', () => ({
    VoltCardView: ({ children, role, onKeyDown, ...props }: any) => <div role={role} onKeyDown={onKeyDown} aria-labelledby={props['aria-labelledby']} aria-describedby={props['aria-describedby']}>{children}</div>,
    VoltCardHeaderView: ({ onCloseClick }: any) => <button onClick={onCloseClick}>Close window</button>
}));
const token = '0123456789abcdef0123456789abcdef';
const receive = (overrides: Record<string, unknown> = {}) => act(() => state.receive?.({ getParser: () => ({ state: 1, offerId: token, healerName: 'Nurse', price: 5, expiresInMs: 30000, ...overrides }) }));
describe('Hospital heal consent', () =>
{
    beforeEach(() =>
    {
        vi.useFakeTimers(); state.authenticated = true; state.room = { roomId: 3 }; state.send.mockReset();
    });
    afterEach(() =>
    {
        cleanup(); vi.useRealTimers();
    });
    it('shows the price and sends only an explicit Yes response once', () =>
    {
        render(<HealOfferView />); receive();
        expect(screen.getByRole('alertdialog', { name: 'Get healed?' })).toBeInTheDocument();
        expect(screen.getByText('5 RP Coins')).toBeInTheDocument();
        expect(state.send).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole('button', { name: 'Yes — 5c' }));
        expect(state.send).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ offerId: token, accepted: 1 }));
        expect(screen.queryByRole('alertdialog')).toBeNull();
    });
    it.each(['No', 'Close window'])('treats %s as a decline', name =>
    {
        render(<HealOfferView />); receive();
        fireEvent.click(screen.getByRole('button', { name }));
        expect(state.send).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ accepted: 0 }));
        expect(screen.queryByRole('alertdialog')).toBeNull();
    });
    it('expires safely and focuses No rather than assuming consent', () =>
    {
        render(<HealOfferView />); receive();
        act(() => vi.advanceTimersByTime(1));
        expect(screen.getByRole('button', { name: 'No' })).toHaveFocus();
        act(() => vi.advanceTimersByTime(30000));
        expect(state.send).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ accepted: 0 }));
        expect(screen.queryByRole('alertdialog')).toBeNull();
    });
    it('ignores a late close for another offer and escapes healer text', () =>
    {
        render(<HealOfferView />); receive({ healerName: '<b>Nurse</b>' });
        expect(screen.getByText('<b>Nurse</b>')).toBeInTheDocument();
        receive({ state: 0, offerId: 'abcdef0123456789abcdef0123456789' });
        expect(screen.getByRole('alertdialog')).toBeInTheDocument();
        fireEvent.keyDown(screen.getByRole('alertdialog'), { key: 'Escape' });
        expect(state.send).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ accepted: 0 }));
    });
    it('clears an offer on a room or connection change without accepting', () =>
    {
        const { rerender } = render(<HealOfferView />); receive();
        state.room = { roomId: 4 }; rerender(<HealOfferView />);
        expect(screen.queryByRole('alertdialog')).toBeNull();
        expect(state.send).not.toHaveBeenCalled();
        receive(); state.authenticated = false; rerender(<HealOfferView />);
        expect(screen.queryByRole('alertdialog')).toBeNull();
    });
    it('does not retry an uncertain response or accept after a send failure', () =>
    {
        state.send.mockImplementation(() =>
        {
            throw new Error('closed');
        });
        render(<HealOfferView />); receive();
        fireEvent.click(screen.getByRole('button', { name: 'Yes — 5c' }));
        expect(screen.getByRole('alert')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Yes — 5c' })).toBeDisabled();
        fireEvent.click(screen.getByRole('button', { name: 'Close window' }));
        expect(state.send).toHaveBeenCalledOnce();
        expect(screen.queryByRole('alertdialog')).toBeNull();
    });
});
