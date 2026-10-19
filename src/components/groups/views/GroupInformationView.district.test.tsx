import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GroupInformationView } from './GroupInformationView';

const state = vi.hoisted(() => ({ theme: 'district', members: vi.fn(), visit: vi.fn(), manage: vi.fn(), join: vi.fn(), send: vi.fn(), confirm: vi.fn() }));
vi.mock('@volt/renderer', () => ({ GetSessionDataManager: () => ({ userId: 5 }), CreateLinkEvent: vi.fn(), GroupDeleteComposer: class
{}, GroupRemoveMemberComposer: class
{}, GroupConfirmMemberRemoveEvent: class
{} }));
vi.mock('../../../api', () => ({
    GroupType: { REGULAR: 0, EXCLUSIVE: 1, PRIVATE: 2 }, GroupMembershipType: { NOT_MEMBER: 0, MEMBER: 1, REQUEST_PENDING: 2 }, CatalogPageName: {},
    LocalizeText: (key: string) => key, GetGroupMembers: state.members, TryVisitRoom: state.visit,
    GetGroupManager: state.manage, TryJoinGroup: state.join, SendMessageComposer: state.send
}));
vi.mock('../../../common', () => ({ LayoutBadgeImageView: () => <span>Badge</span> }));
vi.mock('../../../common/card/VoltCardContext', () => ({ useVoltCardContext: () => ({ theme: state.theme }) }));
vi.mock('../../../hooks', () => ({ useMessageEvent: vi.fn(), useNotification: () => ({ showConfirm: state.confirm }), useGroupMemberRemoval: () => ({ request: vi.fn(), claimReply: vi.fn(), isCurrentSession: vi.fn() }) }));
vi.mock('./GroupNativeLayout', () => ({ flatText: vi.fn(), GroupBox: () => <span>Legacy frame</span>, GroupText: ({ text }: { text: string }) => <span>{text}</span>, GroupButton: ({ label }: { label: string }) => <span>{label}</span> }));
const group = () => ({ id: 1, title: 'Hospital', description: 'Hospital staff', badge: 'badge', type: 0, roomId: 3, membersCount: 4, pendingRequestsCount: 2, createdAt: '2026-10-19', ownerName: 'teniser', isOwner: false, isAdmin: false, membershipType: 0, canMembersDecorate: false, hasForum: false });

describe('District group details', () =>
{
    beforeEach(() =>
    {
        state.theme = 'district'; vi.clearAllMocks();
    });
    afterEach(cleanup);
    it('uses real group identity and retains membership and homeroom actions', () =>
    {
        render(<GroupInformationView groupInformation={group() as never} />);
        expect(screen.getByRole('heading', { name: 'Hospital' })).toBeInTheDocument();
        expect(screen.queryByText('Legacy frame')).toBeNull();
        fireEvent.click(screen.getByRole('button', { name: 'group.linktobase' }));
        expect(state.visit).toHaveBeenCalledWith(3);
        fireEvent.click(screen.getByRole('button', { name: 'group.join' }));
        expect(state.join).toHaveBeenCalledWith(1);
        expect(screen.queryByRole('button', { name: 'group.delete' })).toBeNull();
        expect(screen.queryByRole('button', { name: 'group.pendingmembercount' })).toBeNull();
    });
    it('keeps owner actions gated and deletion behind confirmation', () =>
    {
        render(<GroupInformationView groupInformation={{ ...group(), isOwner: true, membershipType: 1 } as never} />);
        fireEvent.click(screen.getByRole('button', { name: 'group.manage' }));
        expect(state.manage).toHaveBeenCalledWith(1);
        fireEvent.click(screen.getByRole('button', { name: 'group.pendingmembercount' }));
        expect(state.members).toHaveBeenCalledWith(1, 2);
        fireEvent.click(screen.getByRole('button', { name: 'group.delete' }));
        expect(state.confirm).toHaveBeenCalled();
        expect(state.send).not.toHaveBeenCalled();
        expect(screen.queryByRole('button', { name: 'group.leave' })).toBeNull();
    });
    it('does not offer membership actions for private or pending groups', () =>
    {
        const { rerender } = render(<GroupInformationView groupInformation={{ ...group(), type: 2 } as never} />);
        expect(screen.queryByRole('button', { name: 'group.join' })).toBeNull();
        rerender(<GroupInformationView groupInformation={{ ...group(), type: 1, membershipType: 2 } as never} />);
        expect(screen.getByText('group.membershippending')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'group.requestmembership' })).toBeNull();
    });
    it('retains the native layout for other contexts', () =>
    {
        state.theme = 'primary';
        render(<GroupInformationView groupInformation={group() as never} />);
        expect(screen.getByText('Legacy frame')).toBeInTheDocument();
        expect(screen.queryByRole('heading')).toBeNull();
    });
});
