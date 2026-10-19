import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BusinessView } from './BusinessView';

const test = vi.hoisted(() => ({ tracker: null, act: vi.fn(), group: vi.fn(), refresh: vi.fn(),
    snapshot: null as any, pending: false, authenticated: true }));
vi.mock('@volt/renderer', () => ({ AddLinkEventTracker: (tracker: any) =>
{
    test.tracker = tracker;
}, RemoveLinkEventTracker: vi.fn() }));
vi.mock('../../../api', () => ({ GetGroupInformation: test.group }));
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
        open(); expect(screen.getByRole('dialog', { name: 'Businesses' })).toBeInTheDocument();
        expect(screen.getByText('teniser')).toBeInTheDocument();
        expect(screen.queryByRole('tab', { name: 'Management' })).toBeNull();
        fireEvent.click(screen.getByRole('button', { name: 'Group details' })); expect(test.group).toHaveBeenCalledWith(1);
        fireEvent.click(screen.getByRole('button', { name: 'Start shift' })); expect(test.act).toHaveBeenCalledWith(1);
        fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' }); expect(screen.queryByRole('dialog')).toBeNull();
    });
    it('separates native membership management from Owner rank editing', () =>
    {
        test.snapshot.canManageMembers = true; open();
        fireEvent.click(screen.getByRole('tab', { name: 'Management' }));
        expect(screen.getByRole('button', { name: 'Manage group members & requests' })).toBeInTheDocument();
        expect(screen.queryByLabelText('Rank for teniser')).toBeNull();
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
        screen.getByRole('tab', { name: 'Staff' }).focus();
        fireEvent.keyDown(screen.getByRole('tablist'), { key: 'ArrowRight' });
        expect(screen.getByRole('tab', { name: 'My shift' })).toHaveAttribute('aria-selected', 'true');
    });
});
