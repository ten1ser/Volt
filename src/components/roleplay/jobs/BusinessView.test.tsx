import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BusinessView } from './BusinessView';

const test = vi.hoisted(() => ({ tracker: null, act: vi.fn(), group: vi.fn(), refresh: vi.fn(),
    snapshot: null as any, pending: false, authenticated: true }));
vi.mock('@volt/renderer', () => ({ AddLinkEventTracker: (tracker: any) =>
{
    test.tracker = tracker;
}, RemoveLinkEventTracker: vi.fn() }));
vi.mock('../../../api', () => ({ GetGroupMembers: test.group, TryJoinGroup: vi.fn(), GroupMembershipType: { REQUEST_PENDING: 2 }, GroupType: { PRIVATE: 2 } }));
vi.mock('../../../common', () => ({ VoltCardView: ({ children }: any) => <div>{children}</div>, LayoutAvatarImageView: () => <span>Avatar</span>, LayoutBadgeImageView: () => <span>Badge</span> }));
vi.mock('../../../hooks/roleplay/useRpBusiness', () => ({ useRpBusiness: () => ({ snapshot: test.snapshot, pending: test.pending, mutating: false, error: '', remainingMs: 342000,
    act: test.act, refresh: test.refresh, authenticated: test.authenticated }) }));
const data = () => ({ available: true, message: '', groupId: 1, name: 'Hospital', badge: 'badge', totalEmployees: 1, onDutyCount: 0,
    canManageMembers: false, canManageRanks: false, pageSize: 25, totalMatches: 1,
    ranks: [{ level: 1, name: 'Trainee', pay: 7 }, { level: 11, name: 'General Manager', pay: 17 }],
    employees: [{ userId: 5, username: 'teniser', figure: 'figure', gender: 'M', level: 1, onDuty: false }], self: { member: true, level: 1, onDuty: false } });
const open = () =>
{
    render(<BusinessView />); act(() => test.tracker?.linkReceived('businesses/show'));
};

describe('Hospital business directory', () =>
{
    beforeEach(() =>
    {
        test.snapshot = data(); test.pending = false; test.authenticated = true; test.act.mockClear(); test.group.mockClear();
    });
    afterEach(cleanup);
    it('opens from the dock link and shows real staff without management for ordinary members', () =>
    {
        open(); expect(screen.getByRole('dialog', { name: 'Business/Corporation' })).toBeInTheDocument();
        expect(screen.getByText('teniser')).toBeInTheDocument();
        expect(screen.queryByRole('tab', { name: 'Management' })).toBeNull();
        expect(screen.queryByRole('button', { name: 'Group details' })).toBeNull();
        fireEvent.click(screen.getByRole('button', { name: 'Start shift' })); expect(test.act).toHaveBeenCalledWith(1);
        act(() => test.tracker.linkReceived('businesses/hide')); expect(screen.queryByRole('dialog')).toBeNull();
        act(() => test.tracker.linkReceived('businesses/show'));
        fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' }); expect(screen.queryByRole('dialog')).toBeNull();
    });
    it('separates native membership management from Owner rank editing', () =>
    {
        test.snapshot.canManageMembers = true; open();
        fireEvent.click(screen.getByRole('tab', { name: 'Management' }));
        fireEvent.click(screen.getByRole('button', { name: 'Manage employees & applications' }));
        expect(test.group).toHaveBeenCalledWith(1, 0);
        expect(screen.queryByLabelText('Rank for teniser')).toBeNull();
    });
    it('groups the current staff page by descending pay rank using real salaries', () =>
    {
        test.snapshot.employees.push({ userId: 6, username: 'manager', figure: 'figure', gender: 'F', level: 11, onDuty: true });
        test.snapshot.totalMatches = 26;
        open();
        const sections = screen.getAllByRole('region');
        expect(sections.map(section => within(section).getByRole('heading').textContent)).toEqual(['General Manager', 'Trainee']);
        expect(within(sections[0]).getByText('manager')).toBeInTheDocument();
        expect(within(sections[0]).queryByText('teniser')).toBeNull();
        expect(within(sections[0]).getByText('17c')).toBeInTheDocument();
        expect(screen.getByText('2 of 26 matching employees')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled();
    });
    it('changes ranks only through an explicit Save action', () =>
    {
        test.snapshot.canManageRanks = true; open(); fireEvent.click(screen.getByRole('tab', { name: 'Management' }));
        fireEvent.change(screen.getByLabelText('Rank for teniser'), { target: { value: '11' } }); expect(test.act).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole('button', { name: 'Save' })); expect(test.act).toHaveBeenCalledWith(3, 5, 11);
    });
    it('shows own authoritative shift countdown and ends work', () =>
    {
        test.snapshot.self.onDuty = true; open(); fireEvent.click(screen.getByRole('tab', { name: 'My shift' }));
        expect(screen.getAllByText('05:42')).toHaveLength(2);
        expect(screen.getByRole('progressbar', { name: 'Salary period progress' })).toHaveAttribute('value', '258000');
        fireEvent.click(screen.getAllByRole('button', { name: 'End shift' })[0]); expect(test.act).toHaveBeenCalledWith(2);
    });
    it('keeps filters mounted while a search response is pending and disables salary actions', () =>
    {
        test.pending = true; open();
        fireEvent.change(screen.getByLabelText('Search employees'), { target: { value: 'teni' } });
        expect(screen.getByLabelText('Search employees')).toHaveValue('teni');
        expect(screen.getByRole('button', { name: 'Start shift' })).toBeDisabled();
    });
    it('provides actionable empty results and keyboard tab navigation', () =>
    {
        test.snapshot.employees = []; test.snapshot.totalMatches = 0; open();
        expect(screen.getByText('Try another name or choose All ranks.')).toBeInTheDocument();
        screen.getByRole('tab', { name: 'Employees' }).focus();
        fireEvent.keyDown(screen.getByRole('tablist'), { key: 'ArrowRight' });
        expect(screen.getByRole('tab', { name: 'My shift' })).toHaveAttribute('aria-selected', 'true');
    });
    it('opens directly from job information with no group links or owner message', () =>
    {
        const close = vi.fn();
        render(<BusinessView groupInformation={{ id: 1, title: 'Hospital', badge: 'badge' } as never} onClose={close} />);
        expect(screen.getByRole('dialog', { name: 'Business/Corporation' })).toBeInTheDocument();
        expect(screen.getByLabelText('Job badge')).toBeInTheDocument();
        expect(screen.getByText('teniser')).toBeInTheDocument();
        expect(screen.queryByText(/Buy group furni|Go to group homeroom|most popular groups|owner of this group/i)).toBeNull();
        fireEvent.click(screen.getByRole('button', { name: 'Close Business/Corporation' }));
        expect(close).toHaveBeenCalledOnce();
    });
    it('never shows hospital employees or salary actions for another corporation', () =>
    {
        render(<BusinessView groupInformation={{ id: 99, title: 'Other corporation', badge: 'other' } as never} onClose={vi.fn()} />);
        expect(screen.getByRole('heading', { name: 'Other corporation' })).toBeInTheDocument();
        expect(screen.queryByText('teniser')).toBeNull();
        expect(screen.queryByRole('button', { name: 'Start shift' })).toBeNull();
        expect(screen.getByText('This corporation has no linked job or salary directory yet.')).toBeInTheDocument();
    });
});
