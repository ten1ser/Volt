import { AddLinkEventTracker } from '@volt/renderer';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RadioView } from './RadioView';

interface TestStatus
{
    powered: boolean;
    channel: number;
    frequency: number;
    channelLabel: string;
    hospitalAccess: boolean;
    gangAccess: boolean;
    listeners: number;
}

interface TestMessage
{
    id: number;
    channel: number;
    frequency: number;
    channelLabel: string;
    senderId: number;
    senderName: string;
    senderRank: string;
    text: string;
    sentAt: number;
}

interface RadioMock
{
    status: TestStatus | null;
    notice: { text: string; refused: boolean } | null;
    messages: TestMessage[];
    pending: boolean;
    refresh: ReturnType<typeof vi.fn>;
    power: ReturnType<typeof vi.fn>;
    tune: ReturnType<typeof vi.fn>;
    clearNotice: ReturnType<typeof vi.fn>;
}

interface LinkTracker
{
    eventUrlPrefix: string;
    linkReceived: (url: string) => void;
}

const test = vi.hoisted(() => ({ authenticated: true, radio: null as unknown as RadioMock }));
vi.mock('../../../hooks/roleplay/useRpRadio', () => ({
    useRpRadio: () => test.radio,
    RadioChannel: { Public: 0, Hospital: 1, Gang: 2 },
    PUBLIC_MIN: 1001,
    PUBLIC_MAX: 9999
}));
vi.mock('../../../hooks/events/useConnectionState', () => ({ useConnectionState: () => ({ authenticated: test.authenticated }) }));

const makeRadio = (): RadioMock => ({
    status: { powered: true, channel: 0, frequency: 1234, channelLabel: 'Public', hospitalAccess: false, gangAccess: true, listeners: 3 },
    notice: null,
    messages: [],
    pending: false,
    refresh: vi.fn(),
    power: vi.fn(),
    tune: vi.fn(),
    clearNotice: vi.fn()
});
const tracker = () => vi.mocked(AddLinkEventTracker).mock.calls.at(-1)?.[0] as unknown as LinkTracker;
const open = () => act(() => tracker().linkReceived('radio/show'));

const message = (id: number, overrides: Partial<TestMessage> = {}): TestMessage => ({
    id,
    channel: 0,
    frequency: 1234,
    channelLabel: 'Public',
    senderId: 2,
    senderName: 'bob',
    senderRank: '',
    text: `line ${id}`,
    sentAt: 1700000000,
    ...overrides
});
const feed = (firstId: number) => Array.from({ length: 100 }, (_, index) => message(firstId + index));

const panelRect = (left: number, top: number, width: number, height: number): DOMRect => ({
    x: left,
    y: top,
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    toJSON: () => ({})
});
const setRect = (element: HTMLElement, rect: DOMRect) =>
{
    element.getBoundingClientRect = () => rect;
};

describe('RadioView', () =>
{
    beforeEach(() =>
    {
        vi.clearAllMocks();
        test.authenticated = true;
        test.radio = makeRadio();
    });
    afterEach(cleanup);

    it('opens from the link tracker, refreshes and restores focus on Escape', () =>
    {
        const opener = document.createElement('button');

        opener.textContent = 'Dock';
        document.body.append(opener);
        opener.focus();
        render(<RadioView />);
        expect(screen.queryByRole('region', { name: 'Radio' })).toBeNull();
        open();
        expect(screen.getByRole('region', { name: 'Radio' })).toBeInTheDocument();
        expect(test.radio.refresh).toHaveBeenCalledOnce();
        fireEvent.keyDown(screen.getByRole('region', { name: 'Radio' }), { key: 'Escape' });
        expect(screen.queryByRole('region', { name: 'Radio' })).toBeNull();
        expect(opener).toHaveFocus();
        opener.remove();
    });

    it('handles show, hide and toggle links', () =>
    {
        render(<RadioView />);
        act(() => tracker().linkReceived('radio/toggle'));
        expect(screen.getByRole('region', { name: 'Radio' })).toBeInTheDocument();
        act(() => tracker().linkReceived('radio/toggle'));
        expect(screen.queryByRole('region', { name: 'Radio' })).toBeNull();
        act(() => tracker().linkReceived('radio/show'));
        act(() => tracker().linkReceived('radio/hide'));
        expect(screen.queryByRole('region', { name: 'Radio' })).toBeNull();
    });

    it('has no message composer or transmit button and keeps the command hint', () =>
    {
        render(<RadioView />);
        open();
        expect(screen.queryByLabelText('Message')).toBeNull();
        expect(screen.queryByRole('textbox', { name: 'Message' })).toBeNull();
        expect(screen.queryByRole('button', { name: 'Transmit' })).toBeNull();
        expect(screen.getByText(':r <message> to transmit')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Sound off' }));
        expect(screen.getByRole('button', { name: 'Sound on' })).toHaveAttribute('aria-pressed', 'true');
    });

    it('shows a muted radio at zero volume and turns the sound on when the slider moves', () =>
    {
        render(<RadioView />);
        open();
        const slider = screen.getByRole('slider', { name: 'Volume' });

        expect(screen.getByRole('button', { name: 'Sound off' })).toBeInTheDocument();
        expect(slider).toHaveValue('0');
        fireEvent.change(slider, { target: { value: '0.5' } });
        expect(screen.getByRole('button', { name: 'Sound on' })).toHaveAttribute('aria-pressed', 'true');
        expect(slider).toHaveValue('0.5');
    });

    it('builds the frequency draft with the keypad and keyboard, then commits integer tenths', () =>
    {
        render(<RadioView />);
        open();
        const frequency = screen.getByLabelText('Public frequency');

        expect(frequency).toHaveValue('');
        expect(screen.getByText('123.4')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: '1' }));
        fireEvent.click(screen.getByRole('button', { name: '2' }));
        fireEvent.click(screen.getByRole('button', { name: '3' }));
        fireEvent.click(screen.getByRole('button', { name: 'Decimal point' }));
        fireEvent.click(screen.getByRole('button', { name: '4' }));
        expect(frequency).toHaveValue('123.4');
        fireEvent.click(screen.getByRole('button', { name: 'Tune' }));
        expect(test.radio.tune).toHaveBeenLastCalledWith(0, 1234);

        fireEvent.click(screen.getByRole('button', { name: 'Backspace' }));
        expect(frequency).toHaveValue('123.');
        fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
        expect(frequency).toHaveValue('');

        fireEvent.change(frequency, { target: { value: '150.5' } });
        fireEvent.keyDown(frequency, { key: 'Enter' });
        expect(test.radio.tune).toHaveBeenLastCalledWith(0, 1505);

        fireEvent.change(frequency, { target: { value: '777.77' } });
        expect(frequency).toHaveValue('777.7');
        fireEvent.keyDown(frequency, { key: 'Enter' });
        expect(test.radio.tune).toHaveBeenLastCalledWith(0, 7777);

        fireEvent.change(frequency, { target: { value: '999.9' } });
        fireEvent.keyDown(frequency, { key: 'Enter' });
        expect(test.radio.tune).toHaveBeenLastCalledWith(0, 9999);

        fireEvent.change(frequency, { target: { value: '100.1' } });
        fireEvent.keyDown(frequency, { key: 'Enter' });
        expect(test.radio.tune).toHaveBeenLastCalledWith(0, 1001);

        fireEvent.change(frequency, { target: { value: '100.0' } });
        fireEvent.keyDown(frequency, { key: 'Enter' });
        expect(screen.getByRole('alert')).toHaveTextContent('Enter a public frequency from 100.1 to 999.9.');
    });

    it('drives power, private channels and the public frequency from authoritative status', () =>
    {
        render(<RadioView />);
        open();
        const publicChannel = screen.getByRole('button', { name: 'Public' });
        const hospital = screen.getByRole('button', { name: 'Hospital' });
        const gang = screen.getByRole('button', { name: 'Gang' });

        expect(publicChannel).toHaveAttribute('aria-pressed', 'true');
        expect(hospital).toBeDisabled();
        expect(hospital).toHaveAttribute('aria-description', 'Requires on-duty hospital access');
        expect(screen.getByText('Hospital needs on-duty access')).toBeInTheDocument();

        fireEvent.click(gang);
        expect(test.radio.tune).toHaveBeenLastCalledWith(2, 0);

        fireEvent.click(screen.getByRole('button', { name: 'Power off' }));
        expect(test.radio.power).toHaveBeenCalledWith(false);
    });

    it('has no log window or Log button; new traffic only flashes RX on the open handset', () =>
    {
        test.radio.messages = feed(1);
        const { rerender } = render(<RadioView />);

        open();
        expect(screen.queryByRole('log')).toBeNull();
        expect(screen.queryByRole('button', { name: 'Log' })).toBeNull();
        expect(screen.queryByText('line 100')).toBeNull();
        expect(screen.getByText('ON')).toBeInTheDocument();

        test.radio.messages = feed(2);
        rerender(<RadioView />);
        expect(screen.getByText('RX')).toBeInTheDocument();
        expect(screen.queryByText('line 101')).toBeNull();
    });

    it('minimizes the handset and restores focus', () =>
    {
        render(<RadioView />);
        open();

        fireEvent.click(screen.getByRole('button', { name: 'Minimize radio' }));
        expect(screen.queryByRole('button', { name: 'Power off' })).toBeNull();
        expect(screen.getByRole('button', { name: 'Restore radio' })).toHaveFocus();
        expect(screen.queryByRole('button', { name: 'Log' })).toBeNull();
        expect(test.radio.power).not.toHaveBeenCalled();

        act(() => tracker().linkReceived('radio/show'));
        expect(screen.getByRole('button', { name: 'Power off' })).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Minimize radio' }));
        expect(screen.getByRole('button', { name: 'Restore radio' })).toHaveFocus();
        fireEvent.click(screen.getByRole('button', { name: 'Restore radio' }));
        expect(screen.getByRole('button', { name: 'Power off' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Minimize radio' })).toHaveFocus();

        fireEvent.click(screen.getByRole('button', { name: 'Minimize radio' }));
        fireEvent.click(screen.getByRole('button', { name: 'Close radio' }));
        expect(screen.queryByRole('region', { name: 'Radio' })).toBeNull();
    });

    it('drags the handset, ignores controls, retains its position and clamps on resize', () =>
    {
        render(<RadioView />);
        open();
        let handset = screen.getByRole('region', { name: 'Radio' });
        const handsetHeader = handset.querySelector('.district-radio__header') as HTMLElement;

        setRect(handset, panelRect(500, 300, 240, 400));
        act(() => { window.dispatchEvent(new Event('resize')); });

        expect(handset.style.left).toBe('500px');
        expect(handset.style.top).toBe('300px');

        fireEvent.pointerDown(handsetHeader, { pointerId: 1, pointerType: 'mouse', button: 0, clientX: 10, clientY: 10 });
        fireEvent.pointerMove(handsetHeader, { pointerId: 1, pointerType: 'mouse', button: 0, clientX: 60, clientY: 40 });
        fireEvent.pointerUp(handsetHeader, { pointerId: 1, pointerType: 'mouse', button: 0, clientX: 60, clientY: 40 });

        expect(handset.style.left).toBe('550px');
        expect(handset.style.top).toBe('330px');

        const minimize = screen.getByRole('button', { name: 'Minimize radio' });

        fireEvent.pointerDown(minimize, { pointerId: 2, pointerType: 'mouse', button: 0, clientX: 20, clientY: 20 });
        fireEvent.pointerMove(handsetHeader, { pointerId: 2, pointerType: 'mouse', button: 0, clientX: 120, clientY: 120 });
        expect(handset.style.left).toBe('550px');

        fireEvent.click(screen.getByRole('button', { name: 'Close radio' }));
        act(() => tracker().linkReceived('radio/show'));
        handset = screen.getByRole('region', { name: 'Radio' });
        expect(handset.style.left).toBe('550px');

        setRect(handset, panelRect(500, 300, 240, 400));
        const width = Object.getOwnPropertyDescriptor(window, 'innerWidth');
        const height = Object.getOwnPropertyDescriptor(window, 'innerHeight');

        Object.defineProperty(window, 'innerWidth', { configurable: true, value: 320 });
        Object.defineProperty(window, 'innerHeight', { configurable: true, value: 500 });
        try
        {
            act(() => { window.dispatchEvent(new Event('resize')); });
            expect(handset.style.left).toBe('72px');
            expect(handset.style.top).toBe('92px');
        }
        finally
        {
            if(width) Object.defineProperty(window, 'innerWidth', width);
            else delete (window as unknown as Record<string, unknown>).innerWidth;
            if(height) Object.defineProperty(window, 'innerHeight', height);
            else delete (window as unknown as Record<string, unknown>).innerHeight;
        }
    });

    it('shows server denials and disables controls while a request is pending', () =>
    {
        test.radio.notice = { text: 'No response from the server.', refused: true };
        test.radio.pending = true;
        render(<RadioView />);
        open();
        expect(screen.getByRole('alert')).toHaveTextContent('No response from the server.');
        expect(screen.getByRole('button', { name: 'Power off' })).toBeDisabled();
        expect(screen.getByRole('button', { name: 'Tune' })).toBeDisabled();
        expect(screen.getByRole('button', { name: '1' })).toBeDisabled();
        expect(screen.getByLabelText('Public frequency')).toBeDisabled();
        fireEvent.click(screen.getByRole('button', { name: 'Dismiss message' }));
        expect(test.radio.clearNotice).toHaveBeenCalledOnce();
    });

    it('shows no channel or access while the status is loading', () =>
    {
        test.radio.status = null;
        render(<RadioView />);
        open();
        expect(screen.getByText('Connecting')).toBeInTheDocument();
        expect(screen.getByText('— — —')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Power on' })).toBeDisabled();
        expect(screen.getByRole('button', { name: 'Public' })).toBeDisabled();
        expect(screen.getByRole('button', { name: 'Tune' })).toBeDisabled();
    });

    it('shows the frequency once with one status light', () =>
    {
        render(<RadioView />);

        open();
        // The frequency is shown once: no repeat in the corner, the draft field or a separate standby chip.
        expect(screen.getAllByText('123.4')).toHaveLength(1);
        expect(screen.queryByText('Standby')).toBeNull();
        expect(screen.getByText('ON')).toBeInTheDocument();
    });

    it('shows how many powered radios share the channel', () =>
    {
        const { rerender } = render(<RadioView />);

        open();
        expect(screen.getByText('3 connected')).toBeInTheDocument();

        test.radio.status = { ...test.radio.status!, listeners: 1 };
        rerender(<RadioView />);
        expect(screen.getByText('Only you connected')).toBeInTheDocument();
    });

    it('closes when the session disconnects', () =>
    {
        const { rerender } = render(<RadioView />);

        open();
        test.authenticated = false;
        rerender(<RadioView />);
        expect(screen.queryByRole('region', { name: 'Radio' })).toBeNull();
    });

    it('collapses to power, frequency and sound while switched off and powers on', () =>
    {
        test.radio.status = { powered: false, channel: 0, frequency: 1234, channelLabel: 'Public', hospitalAccess: false, gangAccess: true, listeners: 0 };
        render(<RadioView />);
        open();

        const power = screen.getByRole('button', { name: 'Power on' });

        expect(power).toBeEnabled();
        expect(screen.getByText('OFF')).toBeInTheDocument();
        expect(screen.getByText('123.4')).toBeInTheDocument();
        expect(screen.queryByRole('group', { name: 'Frequency keypad' })).toBeNull();
        expect(screen.queryByRole('group', { name: 'Channel' })).toBeNull();
        expect(screen.queryByLabelText('Public frequency')).toBeNull();
        expect(screen.queryByText(':r <message> to transmit')).toBeNull();

        fireEvent.click(power);
        expect(test.radio.power).toHaveBeenCalledWith(true);
    });
});
