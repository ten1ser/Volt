import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PhoneView } from './PhoneView';

type Thread = { threadId: number; unreadCount: number; unread: boolean; participant: { name: string } };

const test = vi.hoisted(() => ({
    tracker: null,
    link: vi.fn(), iconState: 0, requests: [] as unknown[], unseen: 0, threads: [] as Thread[], rerender: null
}));
vi.mock('@volt/renderer', () => ({
    AddLinkEventTracker: (tracker: { linkReceived: (url: string) => void }) =>
    {
        test.tracker = tracker;
    },
    RemoveLinkEventTracker: vi.fn(),
    CreateLinkEvent: test.link,
    GetSessionDataManager: () => ({ userId: 1 })
}));
vi.mock('../../../api', () => ({ MessengerIconState: { HIDDEN: 0, SHOW: 1, UNREAD: 2 } }));
vi.mock('../../../hooks', () => ({
    useFriends: () => ({ requests: test.requests }),
    useMessenger: () => ({ iconState: test.iconState, visibleThreads: test.threads, getMessageThread: vi.fn() }),
    useInventoryUnseenTracker: () => ({ getFullCount: test.unseen })
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
        test.iconState = 0; test.requests = []; test.unseen = 0; test.threads = [];
        test.link.mockClear();
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
