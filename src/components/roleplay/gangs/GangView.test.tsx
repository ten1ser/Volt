import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { badgeCode, badgeParts, GangView, killDeath, outranks } from './GangView';

const test = vi.hoisted(() => ({ tracker: null as any, act: vi.fn(), refresh: vi.fn(), snapshot: null as any, query: null as any }));
vi.mock('@volt/renderer', () => ({ AddLinkEventTracker: (tracker: any) =>
{
    test.tracker = tracker;
}, RemoveLinkEventTracker: vi.fn() }));
vi.mock('../../../common', () => ({ VoltCardView: ({ children }: any) => <div>{children}</div>, LayoutAvatarImageView: () => <span>Avatar</span>, LayoutBadgeImageView: () => <span>Badge</span> }));
vi.mock('../../../hooks/groups/useGroup', () => ({ useGroup: () => ({ groupCustomize: { badgeBases: [{ id: 1 }], badgeSymbols: [{ id: 2 }], badgePartColors: [{ id: 1, color: 'ff0000' }] } }) }));
vi.mock('../../../hooks/roleplay/useRpGang', async () => ({ GangAction: (await vi.importActual<any>('../../../hooks/roleplay/useRpGang')).GangAction,
    useRpGang: (_open: boolean, query: any) =>
    {
        test.query = query;
        return { snapshot: test.snapshot, pending: false, error: '', authenticated: true, refresh: test.refresh, act: test.act };
    } }));

const leader = { id: 1, name: 'Leader', position: 0, canManage: true, isLeader: true, members: 1 };
const officer = { id: 2, name: 'Officer', position: 1, canManage: true, isLeader: false, members: 1 };
const member = { id: 3, name: 'Member', position: 2, canManage: false, isLeader: false, members: 1 };
const gang = (myRankId: number) => ({ id: 4, name: 'Kings', description: 'Run the city', badge: 'b0101', leaderId: 5, leaderName: 'teniser', memberCount: 3,
    kills: 9, deaths: 4, ranks: [leader, officer, member], myRankId, canManage: myRankId === 1 || myRankId === 2, isLeader: myRankId === 1, requested: false,
    members: [{ userId: 5, username: 'teniser', figure: 'f', gender: 'M', rankId: 1, online: true }, { userId: 6, username: 'bob', figure: 'f', gender: 'M', rankId: 2, online: false },
        { userId: 7, username: 'amy', figure: 'f', gender: 'F', rankId: 3, online: true }],
    requests: [{ userId: 8, username: 'zed', figure: 'f', gender: 'M' }] });
const snapshot = (myRankId = 1) => ({ available: true, message: '', cost: 300, maxMembers: 50, myGangId: 4, myRequests: [], gang: gang(myRankId), search: [] });
const open = (url = 'gangs/show') =>
{
    render(<GangView />);
    act(() => test.tracker.linkReceived(url));
};

describe('Gang window', () =>
{
    beforeEach(() =>
    {
        test.snapshot = snapshot();
        test.act.mockClear();
    });
    afterEach(cleanup);

    it('shows the banner with leader, member count and K/D, and members grouped by rank', () =>
    {
        open();
        expect(screen.getByRole('heading', { name: 'Kings' })).toBeInTheDocument();
        expect(screen.getByText('Leader: teniser · 3 / 50 members')).toBeInTheDocument();
        expect(screen.getByText('2.25')).toBeInTheDocument();
        const sections = screen.getAllByRole('region');
        expect(sections.map(section => within(section).getByRole('heading').textContent)).toEqual(['Leader', 'Officer', 'Member']);
        expect(screen.getByRole('tab', { name: 'Requests (1)' })).toBeInTheDocument();
    });

    it('lets a manager act only below its own rank and accept requests', () =>
    {
        test.snapshot = snapshot(2);
        open();
        expect(screen.queryByRole('button', { name: 'Manage teniser' })).toBeNull();
        expect(screen.queryByRole('button', { name: 'Manage bob' })).toBeNull();
        fireEvent.click(screen.getByRole('button', { name: 'Manage amy' }));
        fireEvent.click(screen.getByRole('button', { name: 'Kick' }));
        expect(test.act).toHaveBeenCalledWith(7, { target: 7 });
        fireEvent.click(screen.getByRole('tab', { name: 'Requests (1)' }));
        fireEvent.click(screen.getByRole('button', { name: 'Accept' }));
        expect(test.act).toHaveBeenCalledWith(5, { target: 8 });
    });

    it('asks the leader to confirm a hand-over and to type the name to disband', () =>
    {
        open();
        fireEvent.click(screen.getByRole('button', { name: 'Manage bob' }));
        fireEvent.click(screen.getByRole('button', { name: 'Make Leader' }));
        fireEvent.click(screen.getByRole('button', { name: 'Confirm: make Leader' }));
        expect(test.act).toHaveBeenCalledWith(14, { target: 6 });
        fireEvent.click(screen.getByRole('tab', { name: 'Settings' }));
        expect(screen.queryByText('Leave gang')).toBeNull();
        fireEvent.click(screen.getByRole('button', { name: 'Disband gang…' }));
        expect(screen.getByRole('button', { name: 'Disband' })).toBeDisabled();
        fireEvent.change(screen.getByPlaceholderText('Type Kings'), { target: { value: 'kings' } });
        fireEvent.click(screen.getByRole('button', { name: 'Disband' }));
        expect(test.act).toHaveBeenCalledWith(16, { value: 'kings' });
    });

    it('offers founding and searching without a gang', () =>
    {
        test.snapshot = { ...snapshot(), myGangId: 0, gang: null, search: [{ id: 4, name: 'Kings', badge: 'b0101', memberCount: 3, leaderName: 'teniser', requested: false }] };
        open();
        expect(screen.getByText(/Costs 300 RP Coins/)).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Ask to join' }));
        expect(test.act).toHaveBeenCalledWith(3, { gangId: 4 });
        fireEvent.click(screen.getByRole('button', { name: 'Found a gang' }));
        fireEvent.change(screen.getByPlaceholderText('3–24 letters or numbers'), { target: { value: 'Night Owls' } });
        fireEvent.click(screen.getByRole('button', { name: 'Found gang for 300c' }));
        expect(test.act).toHaveBeenCalledWith(2, { value: JSON.stringify({ name: 'Night Owls', description: '', badge: [[1, 1, 4]] }) });
    });

    it('opens another gang from a link and lets an outsider ask to join', () =>
    {
        test.snapshot = { ...snapshot(0), myGangId: 0 };
        open('gangs/view/4');
        expect(test.query.viewId).toBe(4);
        expect(screen.queryByRole('tab', { name: 'Settings' })).toBeNull();
        fireEvent.click(screen.getByRole('button', { name: 'Ask to join' }));
        expect(test.act).toHaveBeenCalledWith(3, { gangId: 4 });
    });

    it('builds native badge codes and permission checks', () =>
    {
        expect(badgeCode({ base: 1, baseColor: 3, symbol: 12, symbolColor: 4, position: 2 })).toBe('b01034s12042');
        expect(badgeParts({ base: 1, baseColor: 3, symbol: 0, symbolColor: 4, position: 2 })).toEqual([[1, 3, 4]]);
        expect(killDeath(5, 0)).toBe('5.00');
        expect(outranks(officer, member)).toBe(true);
        expect(outranks(officer, officer)).toBe(false);
        expect(outranks(leader, officer)).toBe(true);
        expect(outranks(member, member)).toBe(false);
    });
});
