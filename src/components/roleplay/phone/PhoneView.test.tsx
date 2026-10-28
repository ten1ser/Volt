import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PhoneView } from './PhoneView';

type Thread = { threadId: number; unreadCount: number; unread: boolean; participant: { name: string } };

type PhoneMock = { status: object | null; call: object | null; offer: object | null };

const test = vi.hoisted(() =>
{
    const emptyPhone: PhoneMock = { status: { hasSim: true, number: '+12-345-6', load: 9 }, call: null, offer: null };
    return {
        tracker: null,
        link: vi.fn(), iconState: 0, requests: [] as unknown[], unseen: 0, threads: [] as Thread[], rerender: null,
        inRoom: false, camera: false, moderator: false, wired: false, build: false, monitor: vi.fn(), toggleBuild: vi.fn(),
        phone: emptyPhone
    };
});
vi.mock('../../../hooks/roleplay/useRpPhone', () => ({
    CallState: { Idle: 0, Dialing: 1, Incoming: 2, Active: 3 },
    useRpPhone: () => ({ ...test.phone, lines: [], answer: vi.fn(), hangUp: vi.fn(), respondOffer: vi.fn() })
}));
vi.mock('./PhoneDialerApp', () => ({ PhoneDialerApp: () => <div>Dialer app</div> }));
vi.mock('./PhoneCallScreen', () => ({
    PhoneCallScreen: ({ call }: { call: { peerName: string } }) => <div>Call with {call.peerName}</div>,
    PhoneOfferSheet: ({ offer }: { offer: { seller: string } }) => <div>Offer from {offer.seller}</div>
}));
vi.mock('@volt/renderer', () => ({
    AddLinkEventTracker: (tracker: { linkReceived: (url: string) => void }) =>
    {
        test.tracker = tracker;
    },
    RemoveLinkEventTracker: vi.fn(),
    CreateLinkEvent: test.link,
    GetSessionDataManager: () => ({ userId: 1 }),
    PerkEnum: { CAMERA: 'camera', USE_GUIDE_TOOL: 'guide' }
}));
vi.mock('../../../api/permissions', () => ({ Permission: { ModerationTool: 'moderator' } }));
vi.mock('../../../events', () => ({ GuideToolEvent: class
{} }));
vi.mock('./PhoneCameraApp', () => ({ PhoneCameraApp: () => <div>Camera app</div> }));
vi.mock('../../../hooks/rooms/useRoom', () => ({ useRoom: () => ({ roomSession: test.inRoom ? {} : null }) }));
vi.mock('../../../state/perkAllowancesStore', () => ({ usePerkAllowed: (perk: string) => perk === 'camera' && test.camera }));
vi.mock('../../../api', () => ({
    MessengerIconState: { HIDDEN: 0, SHOW: 1, UNREAD: 2 },
    DispatchUiEvent: vi.fn(),
    GetConfigurationValue: (_key: string, fallback = false) => fallback
}));
vi.mock('../../../hooks', () => ({
    useFriends: () => ({ requests: test.requests }),
    useMessenger: () => ({ iconState: test.iconState, visibleThreads: test.threads, getMessageThread: vi.fn() }),
    useInventoryUnseenTracker: () => ({ getFullCount: test.unseen }),
    useHasPermission: () => test.moderator,
    useOpenIssueCount: () => 2,
    useWiredTools: () => ({ showToolbarButton: test.wired, openMonitor: test.monitor }),
    useBuildHeight: () => ({ available: test.build, toggle: test.toggleBuild })
}));
vi.mock('../../../hooks/roleplay/useCityStatus', () => ({ useCityStatus: () => ({ city: { time: '13:46', isDay: true, phaseRemainingMs: 360000, backdropColor: 0xabd5e9 } }) }));
vi.mock('./PhoneMessagesApp', () => ({
    PhoneMessagesApp: ({ threadId }: { threadId: number }) => <div>Messages app {threadId}</div>,
    threadPreview: () => 'See you at the bank'
}));
vi.mock('./PhoneFriendsApp', () => ({ PhoneFriendsApp: () => <div>Friends app</div> }));
vi.mock('./PhoneSettingsApp', () => ({
    PhoneSettingsApp: ({ onDoNotDisturb }: { onDoNotDisturb: (value: boolean) => void }) => <button type="button" onClick={() => onDoNotDisturb(true)}>Turn on DND</button>
}));

const phone = () => document.querySelector('.district-phone');
const open = () => act(() => test.tracker?.linkReceived('phone/toggle'));
const thread = (threadId: number, unreadCount: number): Thread => ({ threadId, unreadCount, unread: unreadCount > 0, participant: { name: 'Marco' } });

describe('DistrictRP phone', () =>
{
    beforeEach(() =>
    {
        test.iconState = 0; test.requests = []; test.unseen = 0; test.threads = []; test.inRoom = false; test.camera = false;
        test.moderator = false; test.wired = false; test.build = false; test.monitor.mockClear(); test.toggleBuild.mockClear();
        test.link.mockClear();
        test.phone = { status: { hasSim: true, number: '+12-345-6', load: 9 }, call: null, offer: null };
        window.localStorage.clear();
    });
    afterEach(cleanup);

    it('stays put away until toggled, then shows the city time and phase', () =>
    {
        render(<PhoneView />);
        expect(phone()).toHaveAttribute('aria-hidden', 'true');
        open();
        expect(phone()).toHaveClass('is-open');
        expect(screen.getByText('Day · 6 min left')).toBeInTheDocument();
    });

    it('shows unread counts on the apps', () =>
    {
        test.requests = [{}, {}]; test.unseen = 3; test.threads = [thread(1, 2), thread(2, 1)];
        render(<PhoneView />); open();
        expect(screen.getByRole('button', { name: 'Messages, 2' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Friends, 2' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Inventory, 3' })).toBeInTheDocument();
    });

    it('opens Messages, Friends and Settings inside the phone and goes home with the home bar', () =>
    {
        render(<PhoneView />); open();
        fireEvent.click(screen.getByRole('button', { name: 'Messages' }));
        expect(screen.getByText('Messages app 0')).toBeInTheDocument();
        expect(test.link).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole('button', { name: 'Home' }));
        fireEvent.click(screen.getByRole('button', { name: 'Friends' }));
        expect(screen.getByText('Friends app')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Home' }));
        fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
        expect(screen.getByRole('button', { name: 'Turn on DND' })).toBeInTheDocument();
    });

    it('launches the inventory and shop windows and puts the phone away', () =>
    {
        render(<PhoneView />); open();
        fireEvent.click(screen.getByRole('button', { name: 'Shop' }));
        expect(test.link).toHaveBeenCalledWith('catalog/toggle/normal');
        expect(phone()).not.toHaveClass('is-open');
    });

    it('offers the Camera only inside a room with the camera perk, and runs it inside the phone', () =>
    {
        test.camera = true;
        const view = render(<PhoneView />); open();
        expect(screen.queryByRole('button', { name: 'Camera' })).toBeNull();
        test.inRoom = true;
        view.rerender(<PhoneView />);
        fireEvent.click(screen.getByRole('button', { name: 'Camera' }));
        expect(screen.getByText('Camera app')).toBeInTheDocument();
        expect(test.link).not.toHaveBeenCalledWith('camera/toggle');
        expect(phone()).toHaveClass('is-open');
    });

    it('carries the former More tools with their gates and puts the phone away when one opens', () =>
    {
        const view = render(<PhoneView />); open();
        for (const name of [/^Moderation/, 'Wired', 'Build height']) expect(screen.queryByRole('button', { name })).toBeNull();
        test.moderator = true; test.inRoom = true; test.wired = true; test.build = true;
        view.rerender(<PhoneView />);
        expect(screen.getByRole('button', { name: 'Moderation, 2' })).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Wired' }));
        expect(test.monitor).toHaveBeenCalledOnce();
        expect(phone()).not.toHaveClass('is-open');
        open();
        fireEvent.click(screen.getByRole('button', { name: 'Moderation, 2' }));
        expect(test.link).toHaveBeenCalledWith('mod-tools/show');
        open();
        fireEvent.click(screen.getByRole('button', { name: 'Build height' }));
        expect(test.toggleBuild).toHaveBeenCalledOnce();
    });

    it('puts the Phone app in the dock and shows the number and Load', () =>
    {
        render(<PhoneView />); open();
        fireEvent.click(screen.getByRole('button', { name: 'Phone' }));
        expect(screen.getByText('Dialer app')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Home' }));
        expect(screen.getByText('+12-345-6 · 9 Load')).toBeInTheDocument();
        expect(screen.getByLabelText('Signal')).toBeInTheDocument();
    });

    it('says No SIM when there is no SIM card', () =>
    {
        test.phone = { ...test.phone, status: { hasSim: false, number: '', load: 5 } };
        render(<PhoneView />); open();
        expect(screen.getByText('No SIM')).toBeInTheDocument();
        expect(screen.getByText('No SIM card · 5 Load')).toBeInTheDocument();
    });

    it('keeps Messages and Friends behind the SIM card', () =>
    {
        test.phone = { ...test.phone, status: { hasSim: false, number: '', load: 5 } };
        render(<PhoneView />); open();
        fireEvent.click(screen.getByRole('button', { name: 'Friends' }));
        expect(screen.queryByText('Friends app')).toBeNull();
        expect(screen.getByText('Friends needs a SIM card. Buy one from a store to get your own number.')).toBeInTheDocument();
        fireEvent.click(screen.getAllByRole('button', { name: 'Home' })[0]);
        fireEvent.click(screen.getByRole('button', { name: 'Messages' }));
        expect(screen.queryByText(/Messages app/)).toBeNull();
    });

    it('moves by dragging the status bar, remembers where and goes back on double-click', () =>
    {
        render(<PhoneView />); open();
        const bar = document.querySelector('.district-phone__status');
        // jsdom has no layout: put the resting phone at the bottom right of a 1024x768 window.
        vi.spyOn(phone() as HTMLElement, 'getBoundingClientRect').mockReturnValue({ left: 700, top: 130, right: 1000, bottom: 750, width: 300, height: 620, x: 700, y: 130, toJSON: () => ({}) });
        fireEvent.pointerDown(bar, { button: 0, pointerId: 1, clientX: 500, clientY: 500 });
        fireEvent.pointerMove(bar, { pointerId: 1, clientX: 380, clientY: 460 });
        fireEvent.pointerUp(bar, { pointerId: 1, clientX: 380, clientY: 460 });
        expect((phone() as HTMLElement).style.getPropertyValue('--phone-x')).toBe('-120px');
        expect((phone() as HTMLElement).style.getPropertyValue('--phone-y')).toBe('-40px');
        expect(JSON.parse(window.localStorage.getItem('districtrp.phone.position') ?? 'null')).toEqual({ x: -120, y: -40 });
        fireEvent.doubleClick(bar);
        expect((phone() as HTMLElement).style.getPropertyValue('--phone-x')).toBe('0px');
    });

    it('takes the phone out for a ringing call and a sale offer', () =>
    {
        const view = render(<PhoneView />);
        expect(phone()).not.toHaveClass('is-open');
        test.phone = { ...test.phone, call: { state: 2, callId: 'a'.repeat(32), peerName: 'Marco', peerNumber: '+22-333-4', connectedAt: 0 } };
        view.rerender(<PhoneView />);
        expect(phone()).toHaveClass('is-open');
        expect(screen.getByText('Call with Marco')).toBeInTheDocument();

        act(() => test.tracker?.linkReceived('phone/hide'));
        test.phone = { ...test.phone, call: null, offer: { offerId: 'b'.repeat(32), item: 'sim', amount: 20, price: 50, seller: 'staff', expiresAt: 1 } };
        view.rerender(<PhoneView />);
        expect(phone()).toHaveClass('is-open');
        expect(screen.getByText('Offer from staff')).toBeInTheDocument();
    });

    it('closes with Escape and the home bar', () =>
    {
        render(<PhoneView />); open();
        fireEvent.keyDown(screen.getByRole('button', { name: 'Shop' }), { key: 'Escape' });
        expect(phone()).not.toHaveClass('is-open');
        open();
        fireEvent.click(screen.getByRole('button', { name: 'Close phone' }));
        expect(phone()).not.toHaveClass('is-open');
    });

    it('shows a banner for a new message while the phone is away and opens that thread from it', () =>
    {
        test.threads = [thread(7, 0)];
        const view = render(<PhoneView />);
        test.threads = [thread(7, 1)];
        view.rerender(<PhoneView />);
        const banner = screen.getByRole('button', { name: 'Message from Marco: See you at the bank' });
        fireEvent.click(banner);
        expect(phone()).toHaveClass('is-open');
        expect(screen.getByText('Messages app 7')).toBeInTheDocument();
    });

    it('does not show banners with do not disturb on', () =>
    {
        test.threads = [thread(7, 0)];
        const view = render(<PhoneView />);
        open();
        fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
        fireEvent.click(screen.getByRole('button', { name: 'Turn on DND' }));
        expect(window.localStorage.getItem('districtrp.phone.dnd')).toBe('1');
        act(() => test.tracker?.linkReceived('phone/hide'));
        test.threads = [thread(7, 1)];
        view.rerender(<PhoneView />);
        expect(screen.queryByRole('button', { name: /Message from/ })).toBeNull();
    });
});
