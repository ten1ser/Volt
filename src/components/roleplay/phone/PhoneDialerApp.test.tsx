import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CallState } from '../../../hooks/roleplay/useRpPhone';
import { PhoneCallScreen, PhoneOfferSheet } from './PhoneCallScreen';
import { PhoneDialerApp } from './PhoneDialerApp';

type Status = { hasSim: boolean; number: string; load: number; hospitalNumber: string; policeNumber: string; messageCost: number; callCost: number; callPeriodSeconds: number };
const test = vi.hoisted(() =>
{
    const status: Status | null = null;
    return { status, dial: vi.fn(), notice: '', loadHistory: vi.fn(), history: null as unknown[] | null };
});
vi.mock('../../../hooks/roleplay/useRpPhone', () => ({
    CallState: { Idle: 0, Dialing: 1, Incoming: 2, Active: 3 },
    useRpPhone: () => ({ status: test.status, dial: test.dial, callNotice: test.notice, clearCallNotice: vi.fn(), history: test.history, loadHistory: test.loadHistory })
}));

const CALL = 'a'.repeat(32);

describe('Phone dialer and call screen', () =>
{
    beforeEach(() =>
    {
        test.status = { hasSim: true, number: '+12-345-6', load: 8, hospitalNumber: '112', policeNumber: '911', messageCost: 1, callCost: 1, callPeriodSeconds: 30 };
        test.notice = '';
        test.dial.mockClear();
        test.loadHistory.mockClear();
        test.history = null;
    });
    afterEach(cleanup);

    it('dials a typed number from the keypad and the emergency lines', () =>
    {
        render(<PhoneDialerApp onHome={vi.fn()} />);
        for (const key of ['+', '2', '2', '-', '3', '3', '3', '-', '4']) fireEvent.click(screen.getByRole('button', { name: key }));
        expect(screen.getByRole('textbox', { name: 'Number to call' })).toHaveValue('+22-333-4');
        fireEvent.click(screen.getByRole('button', { name: 'Call' }));
        expect(test.dial).toHaveBeenCalledWith('+22-333-4');
        fireEvent.click(screen.getByRole('button', { name: 'Hospital 112' }));
        expect(test.dial).toHaveBeenLastCalledWith('112');
        expect(screen.getByText(/1 Load every 30 seconds. You have 8 Load/)).toBeInTheDocument();
    });

    it('warns without a SIM card and shows why a call failed', () =>
    {
        test.status = { hasSim: false, number: '', load: 8, hospitalNumber: '112', policeNumber: '911', messageCost: 1, callCost: 1, callPeriodSeconds: 30 };
        test.notice = 'bob is busy.';
        render(<PhoneDialerApp onHome={vi.fn()} />);
        expect(screen.getByText(/Only emergency calls work/)).toBeInTheDocument();
        expect(screen.getByRole('status')).toHaveTextContent('bob is busy.');
        expect(screen.getByRole('button', { name: 'Call' })).toBeDisabled();
    });

    it('lists recent calls and calls back', () =>
    {
        const view = render(<PhoneDialerApp onHome={vi.fn()} />);
        fireEvent.click(screen.getByRole('tab', { name: 'Recents' }));
        expect(test.loadHistory).toHaveBeenCalledTimes(1);
        test.history = [
            { outgoing: true, answered: true, peerName: 'Marco', peerNumber: '+22-333-4', agoSeconds: 125, durationSeconds: 75 },
            { outgoing: false, answered: false, peerName: 'Jules', peerNumber: '+33-444-5', agoSeconds: 7300, durationSeconds: 0 }
        ];
        view.rerender(<PhoneDialerApp onHome={vi.fn()} />);
        expect(screen.getByText('+22-333-4 · Outgoing · 1:15')).toBeInTheDocument();
        expect(screen.getByText('+33-444-5 · Missed')).toBeInTheDocument();
        expect(screen.getByText('2m')).toBeInTheDocument();
        expect(screen.getByText('2h')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Call Jules' }));
        expect(test.dial).toHaveBeenCalledWith('+33-444-5');
    });

    it('keeps recent calls behind the SIM card', () =>
    {
        test.status = { ...test.status, hasSim: false, number: '' };
        render(<PhoneDialerApp onHome={vi.fn()} />);
        fireEvent.click(screen.getByRole('tab', { name: 'Recents' }));
        expect(test.loadHistory).not.toHaveBeenCalled();
        expect(screen.getByText('Recent calls need a SIM card.')).toBeInTheDocument();
    });

    it('answers or declines an incoming call and hangs up a connected one', () =>
    {
        const onAnswer = vi.fn();
        const onHangUp = vi.fn();
        const incoming = { state: CallState.Incoming, callId: CALL, peerName: 'Marco', peerNumber: '+22-333-4', connectedAt: 0 };
        const view = render(<PhoneCallScreen call={incoming} lines={[]} onAnswer={onAnswer} onHangUp={onHangUp} />);
        expect(screen.getByText('Incoming call')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Answer' }));
        fireEvent.click(screen.getByRole('button', { name: 'Decline' }));
        expect([onAnswer.mock.calls.length, onHangUp.mock.calls.length]).toEqual([1, 1]);

        view.rerender(<PhoneCallScreen call={{ ...incoming, state: CallState.Active, connectedAt: performance.now() }}
            lines={[{ fromSelf: true, speaker: 'me', text: 'on my way' }]} onAnswer={onAnswer} onHangUp={onHangUp} />);
        expect(screen.queryByRole('button', { name: 'Answer' })).toBeNull();
        expect(screen.getByText('on my way')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Hang up' }));
        expect(onHangUp).toHaveBeenCalledTimes(2);
    });

    it('buys or declines a sale offer', () =>
    {
        const onRespond = vi.fn();
        render(<PhoneOfferSheet offer={{ offerId: CALL, item: 'sim', amount: 20, price: 50, seller: 'staff', expiresAt: performance.now() + 60000 }} onRespond={onRespond} />);
        expect(screen.getByText('staff is selling you a SIM card with 20 Load')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Buy for 50c' }));
        fireEvent.click(screen.getByRole('button', { name: 'No thanks' }));
        expect(onRespond.mock.calls).toEqual([[true], [false]]);
    });
});
