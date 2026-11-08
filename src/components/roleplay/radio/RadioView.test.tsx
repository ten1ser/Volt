import { AddLinkEventTracker } from '@volt/renderer';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { hospitalCallAge, RadioView } from './RadioView';

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

interface TestCall
{
    number: number;
    patientId: number;
    patientName: string;
    location: string;
    openedAt: number;
}

interface RadioMock
{
    status: TestStatus | null;
    notice: { text: string; refused: boolean } | null;
    messages: TestMessage[];
    calls: TestCall[];
    pending: boolean;
    callPending: boolean;
    refresh: ReturnType<typeof vi.fn>;
    power: ReturnType<typeof vi.fn>;
    tune: ReturnType<typeof vi.fn>;
    respond: ReturnType<typeof vi.fn>;
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
vi.mock('../../../common', () => ({ VoltCardView: ({ children }: { children: unknown }) => <div>{children as never}</div>, DraggableWindowPosition: { BOTTOM_LANE: 'DWP_BOTTOM_LANE' } }));

const makeRadio = (): RadioMock => ({
    status: { powered: true, channel: 0, frequency: 1234, channelLabel: 'Public', hospitalAccess: false, gangAccess: true, listeners: 3 },
    notice: null,
    messages: [],
    calls: [],
    pending: false,
    callPending: false,
    refresh: vi.fn(),
    power: vi.fn(),
    tune: vi.fn(),
    respond: vi.fn(),
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

describe('RadioView', () =>
{
    beforeEach(() =>
    {
        vi.clearAllMocks();
        window.localStorage.clear();
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
        expect(document.querySelector('.district-radio__tx-hint')).toHaveTextContent(':r <message> to transmit');

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

    it('steps the frequency draft one tenth from the tuned frequency, clamped to the band, then commits integer tenths', () =>
    {
        render(<RadioView />);
        open();
        const frequency = screen.getByLabelText('Public frequency');

        expect(frequency).toHaveValue('');
        expect(screen.getByText('123.4')).toBeInTheDocument();
        expect(screen.queryByRole('group', { name: 'Frequency keypad' })).toBeNull();

        fireEvent.click(screen.getByRole('button', { name: 'Raise frequency' }));
        expect(frequency).toHaveValue('123.5');
        fireEvent.click(screen.getByRole('button', { name: 'Lower frequency' }));
        fireEvent.click(screen.getByRole('button', { name: 'Lower frequency' }));
        expect(frequency).toHaveValue('123.3');
        fireEvent.click(screen.getByRole('button', { name: 'Tune' }));
        expect(test.radio.tune).toHaveBeenLastCalledWith(0, 1233);

        fireEvent.change(frequency, { target: { value: '999.9' } });
        fireEvent.click(screen.getByRole('button', { name: 'Raise frequency' }));
        expect(frequency).toHaveValue('999.9');
        fireEvent.change(frequency, { target: { value: '100.1' } });
        fireEvent.click(screen.getByRole('button', { name: 'Lower frequency' }));
        expect(frequency).toHaveValue('100.1');

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

    it('keeps the last confirmed public frequencies as chips, without the current one, and tunes from them', () =>
    {
        window.localStorage.setItem('district.radio.recent', JSON.stringify([1500, 'bad', 1000, 2222, 3333]));
        const { rerender } = render(<RadioView />);

        open();
        const chips = () => Array.from(screen.getByRole('group', { name: 'Recent frequencies' }).querySelectorAll('button')).map(chip => chip.textContent);

        expect(chips()).toEqual(['150.0', '222.2', '333.3']);
        expect(JSON.parse(window.localStorage.getItem('district.radio.recent'))).toEqual([1234, 1500, 2222, 3333]);

        fireEvent.click(screen.getByRole('button', { name: '222.2' }));
        expect(test.radio.tune).toHaveBeenLastCalledWith(0, 2222);

        test.radio.status = { ...test.radio.status, frequency: 2222 };
        rerender(<RadioView />);
        expect(chips()).toEqual(['123.4', '150.0', '333.3']);
    });

    it('puts power off and minimize in the title bar, and leaves only Close for Esc to find', () =>
    {
        render(<RadioView />);
        open();
        const header = document.querySelector('.district-rp-titlebar') as HTMLElement;

        expect(header).toHaveClass('drag-handler');
        expect(header).toContainElement(screen.getByRole('button', { name: 'Power off' }));
        expect(screen.getByRole('button', { name: 'Power off' })).toHaveFocus();
        expect(Array.from(document.querySelectorAll('.district-rp-close')).map(button => button.getAttribute('aria-label'))).toEqual(['Close radio']);
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
        expect(screen.getByRole('button', { name: 'Raise frequency' })).toBeDisabled();
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
        expect(screen.queryByRole('button', { name: 'Power off' })).toBeNull();
        expect(screen.queryByRole('group', { name: 'Channel' })).toBeNull();
        expect(screen.queryByLabelText('Public frequency')).toBeNull();
        expect(screen.queryByRole('button', { name: 'Raise frequency' })).toBeNull();
        expect(document.querySelector('.district-radio__tx-hint')).toBeNull();

        fireEvent.click(power);
        expect(test.radio.power).toHaveBeenCalledWith(true);
    });

    it('lists hospital calls and responds with the call number', () =>
    {
        const openedAt = Math.floor(Date.now() / 1000) - 180;

        test.radio.status = { powered: true, channel: 1, frequency: 0, channelLabel: 'Hospital', hospitalAccess: true, gangAccess: true, listeners: 2 };
        test.radio.calls = [
            { number: 12, patientId: 4, patientName: 'Ann Patient', location: 'Ward 3', openedAt },
            { number: 13, patientId: 5, patientName: 'Ben Patient', location: '', openedAt }
        ];
        render(<RadioView />);
        open();

        expect(screen.getByRole('region', { name: 'Hospital calls' })).toBeInTheDocument();
        expect(screen.getByText('Ann Patient')).toBeInTheDocument();
        expect(screen.getByText('Ward 3 · 3m ago')).toBeInTheDocument();
        expect(screen.getByText('Unknown location · 3m ago')).toBeInTheDocument();
        expect(screen.getAllByRole('button', { name: 'Respond' })).toHaveLength(2);

        fireEvent.click(screen.getAllByRole('button', { name: 'Respond' })[1]);
        expect(test.radio.respond).toHaveBeenCalledWith(13);
    });

    it('shows an empty calls list on hospital and hides the section on public', () =>
    {
        test.radio.status = { powered: true, channel: 1, frequency: 0, channelLabel: 'Hospital', hospitalAccess: true, gangAccess: true, listeners: 1 };
        const { rerender } = render(<RadioView />);

        open();
        expect(screen.getByText('No open calls')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Respond' })).toBeNull();

        test.radio.status = { ...test.radio.status, channel: 0, channelLabel: 'Public' };
        rerender(<RadioView />);
        expect(screen.queryByRole('region', { name: 'Hospital calls' })).toBeNull();
    });

    it('ages call timestamps', () =>
    {
        expect(hospitalCallAge(1000, 1059)).toBe('just now');
        expect(hospitalCallAge(1000, 1180)).toBe('3m ago');
    });
});
