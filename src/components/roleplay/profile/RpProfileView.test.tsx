import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePlayerCardStore } from '../../../state/playerCardStore';
import { RpProfileView } from './RpProfileView';

const test = vi.hoisted(() => ({
    handlers: new Map<unknown, (event: unknown) => void>(),
    authenticated: true,
    userId: 5,
    roomSession: null as any
}));

vi.mock('@volt/renderer', () =>
{
    class UserProfileEvent
    {}

    return {
        UserProfileEvent,
        RoomObjectType: { USER: 1 },
        GetSessionDataManager: () => ({ userId: test.userId })
    };
});
vi.mock('../../../hooks/events/useMessageEvent', () => ({
    useMessageEvent: (type: unknown, handler: (event: unknown) => void) => test.handlers.set(type, handler)
}));
vi.mock('../../../hooks/events/useConnectionState', () => ({ useConnectionState: () => ({ authenticated: test.authenticated }) }));
vi.mock('../../../api/volt/session/GetRoomSession', () => ({ GetRoomSession: () => test.roomSession }));
vi.mock('../../room/widgets/avatar-info/infostand/InfoStandWidgetUserView', () => ({
    InfoStandWidgetUserView: ({ avatarInfo, initialTab, setAvatarInfo, onClose }: any) =>
    {
        const [tab, setTab] = useState(initialTab);

        return (
            <div
                data-testid="user-card"
                role="dialog"
                aria-label="Player card"
                data-webid={avatarInfo.webID}
                data-name={avatarInfo.name}
                data-motto={avatarInfo.motto}
                data-tab={tab}
                data-type={avatarInfo.type}
                data-roomindex={avatarInfo.roomIndex}
            >
                <button type="button" onClick={onClose}>close-card</button>
                <button type="button" onClick={() => setTab('overview')}>switch-overview</button>
                <button
                    type="button"
                    onClick={() => setAvatarInfo((previous: any) => ({ ...previous, motto: 'edited' }))}
                >
                    update-card
                </button>
                <input aria-label="card-input" />
            </div>
        );
    }
}));

const renderer = await import('@volt/renderer');

const profile = (overrides: Record<string, unknown> = {}) => ({
    id: 5,
    username: 'teniser',
    figure: 'hd-180-1',
    motto: 'hello',
    openProfileWindow: true,
    ...overrides
});

const deliver = (parser: Record<string, unknown>) => act(() => test.handlers.get(renderer.UserProfileEvent)({ getParser: () => parser }));

let host: HTMLElement;
let targetHost: HTMLElement;

describe('DistrictRP player card owner', () =>
{
    beforeEach(() =>
    {
        test.handlers.clear();
        test.authenticated = true;
        test.userId = 5;
        test.roomSession = null;
        usePlayerCardStore.getState().close();

        document.getElementById('district-player-card')?.remove();
        host = document.createElement('div');
        host.id = 'district-player-card';
        document.body.appendChild(host);

        document.getElementById('district-target-card')?.remove();
        targetHost = document.createElement('div');
        targetHost.id = 'district-target-card';
        document.body.appendChild(targetHost);
    });

    afterEach(() =>
    {
        cleanup();
        host.remove();
        targetHost.remove();
    });

    it('stays closed until a profile reply arrives', () =>
    {
        render(<RpProfileView />);

        expect(screen.queryByTestId('user-card')).toBeNull();
    });

    it('opens your own card under your HUD and anyone else in the second slot, both at once', () =>
    {
        render(<RpProfileView />);

        deliver(profile());

        const own = screen.getByTestId('user-card');

        expect(host).toContainElement(own);
        expect(own).toHaveAttribute('data-webid', '5');
        expect(own).toHaveAttribute('data-type', 'IUI_OWN_USER');
        expect(own).toHaveAttribute('data-name', 'teniser');
        expect(own).toHaveAttribute('data-motto', 'hello');
        expect(own).toHaveAttribute('data-tab', 'stats');

        deliver(profile({ id: 6, username: 'Mara', figure: 'hd-200-1', motto: 'hey' }));

        expect(screen.getAllByTestId('user-card')).toHaveLength(2);
        expect(host.querySelector('[data-testid="user-card"]')).toHaveAttribute('data-webid', '5');

        const peer = targetHost.querySelector('[data-testid="user-card"]');

        expect(peer).toHaveAttribute('data-webid', '6');
        expect(peer).toHaveAttribute('data-type', 'IUI_PEER');
        expect(peer).toHaveAttribute('data-name', 'Mara');
        expect(peer).toHaveAttribute('data-tab', 'stats');

        // A second other player replaces the first in the same slot.
        deliver(profile({ id: 7, username: 'Iris', figure: 'hd-200-1' }));

        expect(screen.getAllByTestId('user-card')).toHaveLength(2);
        expect(targetHost.querySelector('[data-testid="user-card"]')).toHaveAttribute('data-webid', '7');
    });

    it('reopens Stats for the same user when a profile link fires again', () =>
    {
        render(<RpProfileView />);

        deliver(profile());
        expect(screen.getByTestId('user-card')).toHaveAttribute('data-tab', 'stats');

        fireEvent.click(screen.getByRole('button', { name: 'switch-overview' }));
        expect(screen.getByTestId('user-card')).toHaveAttribute('data-tab', 'overview');

        deliver(profile({ id: 0 }));
        deliver(profile({ openProfileWindow: false }));
        expect(screen.getByTestId('user-card')).toHaveAttribute('data-tab', 'overview');

        deliver(profile());

        expect(screen.getAllByTestId('user-card')).toHaveLength(1);
        expect(screen.getByTestId('user-card')).toHaveAttribute('data-tab', 'stats');
    });

    it('uses the current room index only when the profile user is really in it', () =>
    {
        render(<RpProfileView />);

        deliver(profile({ id: 6, username: 'Mara' }));
        expect(screen.getByTestId('user-card')).toHaveAttribute('data-roomindex', '-1');

        test.roomSession = { userDataManager: { getUserData: (id: number) => ({ webID: id, type: 1, roomIndex: 9 }) } };
        deliver(profile({ id: 6, username: 'Mara' }));
        expect(screen.getByTestId('user-card')).toHaveAttribute('data-roomindex', '9');

        test.roomSession = { userDataManager: { getUserData: () => ({ webID: 7, type: 1, roomIndex: 9 }) } };
        deliver(profile({ id: 6, username: 'Mara' }));
        expect(screen.getByTestId('user-card')).toHaveAttribute('data-roomindex', '-1');
    });

    it('ignores an explicitly closed profile but keeps legacy replies compatible', () =>
    {
        render(<RpProfileView />);

        deliver(profile({ openProfileWindow: false }));
        expect(screen.queryByTestId('user-card')).toBeNull();

        deliver(profile({ openProfileWindow: undefined }));
        expect(screen.getByTestId('user-card')).toBeInTheDocument();
    });

    it('ignores invalid identities and clears on logout without stale data reappearing', () =>
    {
        const view = render(<RpProfileView />);

        for (const invalid of [{ id: 0 }, { id: -1 }, { id: 1.5 }, { username: '' }, { username: '   ' }, { figure: '' }])
        {
            deliver(profile(invalid));
            expect(screen.queryByTestId('user-card')).toBeNull();
        }

        deliver(profile());
        expect(screen.getByTestId('user-card')).toBeInTheDocument();

        test.authenticated = false;
        view.rerender(<RpProfileView />);

        expect(screen.queryByTestId('user-card')).toBeNull();
        expect(usePlayerCardStore.getState().own).toBeNull();
        expect(usePlayerCardStore.getState().other).toBeNull();

        test.authenticated = true;
        view.rerender(<RpProfileView />);

        expect(screen.queryByTestId('user-card')).toBeNull();

        deliver(profile());
        expect(screen.getByTestId('user-card')).toBeInTheDocument();
    });

    it('closes from the card control and from Escape while focus is inside', () =>
    {
        render(<RpProfileView />);
        deliver(profile());

        fireEvent.click(screen.getByRole('button', { name: 'close-card' }));
        expect(screen.queryByTestId('user-card')).toBeNull();

        deliver(profile());

        const input = screen.getByLabelText('card-input');

        input.focus();
        fireEvent.keyDown(document.body, { key: 'Escape' });
        expect(screen.getByTestId('user-card')).toBeInTheDocument();

        fireEvent.keyDown(input, { key: 'Escape' });
        expect(screen.queryByTestId('user-card')).toBeNull();
    });

    it('applies native InfoStand updates through the store without changing identity', () =>
    {
        render(<RpProfileView />);
        deliver(profile());

        fireEvent.click(screen.getByRole('button', { name: 'update-card' }));

        const card = screen.getByTestId('user-card');

        expect(card).toHaveAttribute('data-motto', 'edited');
        expect(card).toHaveAttribute('data-webid', '5');
        expect(card).toHaveAttribute('data-tab', 'stats');
    });
});
