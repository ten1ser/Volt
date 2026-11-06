import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InfoStandWidgetUserView } from './InfoStandWidgetUserView';

const state = vi.hoisted(() => ({
    profile: vi.fn(),
    send: vi.fn(),
    roomSession: { sendMottoMessage: vi.fn() },
    affiliationsUserId: 0,
    affiliations: {
        loading: false,
        unavailable: false,
        job: '',
        jobBadge: '',
        gang: '',
        gangBadge: '',
        gangRank: '',
        onDuty: false,
        rank: '',
        kills: 0,
        deaths: 0,
        punchesThrown: 0,
        punchesMissed: 0,
        punchesReceived: 0,
        timesJailed: 0
    }
}));

vi.mock('@volt/renderer', () => {
    class RelationshipStatusInfo {}
    class UserRelationshipsComposer {
        constructor(public userId: number) {}
    }

    return {
        CreateLinkEvent: vi.fn(),
        GetSessionDataManager: () => ({ getGroupBadge: () => 'b-group', tags: [] }),
        RelationshipStatusEnum: { RELATIONSHIP_NAMES: {}, HEART: 0, SMILE: 1, BOBBA: 2 },
        RelationshipStatusInfo,
        RelationshipStatusInfoEvent: class {},
        RelationshipStatusInfoMessageParser: class {},
        RoomSessionFavoriteGroupUpdateEvent: { FAVOURITE_GROUP_UPDATE: 'FAVOURITE_GROUP_UPDATE' },
        RoomSessionUserBadgesEvent: { RSUBE_BADGES: 'RSUBE_BADGES' },
        RoomSessionUserFigureUpdateEvent: { USER_FIGURE: 'USER_FIGURE' },
        UserRelationshipsComposer
    };
});

vi.mock('../../../../../api', () => {
    class AvatarInfoUser {
        static OWN_USER = 'IUI_OWN_USER';
        static PEER = 'IUI_PEER';
        constructor(public readonly type: string) {}
    }

    return {
        AvatarInfoUser,
        CloneObject: (value: unknown) => ({ ...(value as object) }),
        GetConfigurationValue: (key: string, value?: unknown) => {
            if (key === 'activity.point.display.enabled') return true;
            return value;
        },
        GetGroupInformation: vi.fn(),
        GetUserProfile: state.profile,
        LocalizeText: (key: string) => key,
        localizeWithFallback: (_key: string, fallback: string) => fallback,
        SendMessageComposer: state.send
    };
});

vi.mock('../../../../../common', () => ({
    Column: ({ children }: any) => <div>{children}</div>,
    Flex: ({ children, onClick }: any) => <div onClick={onClick}>{children}</div>,
    LayoutAvatarImageView: () => null,
    LayoutBadgeImageView: ({ badgeCode }: any) => <img alt={badgeCode ?? ''} />,
    Text: ({ children, onClick }: any) => <span onClick={onClick}>{children}</span>,
    UserIdentityView: ({ username }: any) => <span>{username}</span>
}));

vi.mock('../../../../../hooks/roleplay/usePlayerCardAffiliations', () => ({
    usePlayerCardAffiliations: (userId: number) =>
    {
        state.affiliationsUserId = userId;
        return state.affiliations;
    }
}));

vi.mock('../../../../../hooks', () => ({
    useInventoryBadges: () => ({
        activeBadgeCodes: [],
        removeBadge: vi.fn(),
        requestBadges: vi.fn(),
        setBadgeAtSlot: vi.fn(),
        swapBadges: vi.fn()
    }),
    useMessageEvent: () => undefined,
    useRoom: () => ({ roomSession: state.roomSession }),
    useVoltEvent: () => undefined
}));

const affiliations = (overrides: Partial<(typeof state)['affiliations']> = {}) => ({ ...state.affiliations, ...overrides });

const createAvatarInfo = (type: string, overrides: Record<string, unknown> = {}) => ({
    type,
    name: 'Ada',
    motto: 'hello there',
    webID: 7,
    figure: 'hd-180-1',
    badges: ['b0503Xs09114'],
    groupId: -1,
    groupBadgeId: null,
    groupName: null,
    carryItem: 0,
    achievementScore: 395,
    roomIndex: 3,
    ...overrides
});

beforeEach(() => {
    state.profile.mockClear();
    state.send.mockClear();
    state.roomSession.sendMottoMessage.mockClear();
    state.affiliationsUserId = 0;
    state.affiliations = affiliations({ loading: false, unavailable: false, job: '', jobBadge: '', gang: '', gangBadge: '' });
});

afterEach(() => {
    cleanup();
});

describe('user infostand redesign', () => {
    it('shows exactly the two authoritative affiliation slots and no rank or achievement rows', () => {
        state.affiliations = affiliations({ job: 'Hospital', jobBadge: 'b-hospital', gang: 'Kings', gangBadge: 'b-gang' });

        render(<InfoStandWidgetUserView avatarInfo={createAvatarInfo('IUI_OWN_USER') as any} setAvatarInfo={vi.fn()} onClose={vi.fn()} />);

        expect(screen.queryByText(/Badge rank/i)).toBeNull();
        expect(screen.queryByText('infostand.text.achievement_score')).toBeNull();
        expect(screen.queryByText('395')).toBeNull();
        expect(document.querySelector('.volt-infostand__relationships')).toBeNull();
        expect(screen.getByRole('group', { name: 'Job badge' })).toBeInTheDocument();
        expect(screen.getByRole('group', { name: 'Gang badge' })).toBeInTheDocument();
        expect(screen.getByAltText('b-hospital')).toBeInTheDocument();
        expect(screen.getByAltText('b-gang')).toBeInTheDocument();
        expect(screen.getByText('Hospital')).toBeInTheDocument();
        expect(screen.getByText('Kings')).toBeInTheDocument();
        expect(screen.queryByText('+')).toBeNull();
        expect(document.querySelectorAll('.volt-infostand__badge-slot')).toHaveLength(0);
        expect(document.querySelectorAll('.volt-infostand__affiliation')).toHaveLength(2);
        expect(state.affiliationsUserId).toBe(7);
    });

    it('shows the duty ribbon and the job and gang ranks only for employed or ranked players', () => {
        state.affiliations = affiliations({ job: 'Hospital', jobBadge: 'b-job', rank: 'Doctor', gang: 'Kings', gangBadge: 'b-gang', gangRank: 'Enforcer', onDuty: true });
        const view = render(<InfoStandWidgetUserView avatarInfo={createAvatarInfo('IUI_PEER') as any} setAvatarInfo={vi.fn()} onClose={vi.fn()} />);

        expect(screen.getByText('On duty · Hospital')).toHaveClass('volt-infostand__duty', 'is-on');
        expect(document.querySelector('.volt-infostand__stage')).toHaveClass('has-duty');
        expect(within(screen.getByRole('group', { name: 'Job badge' })).getByText('Doctor')).toHaveClass('is-accent');
        expect(within(screen.getByRole('group', { name: 'Gang badge' })).getByText('Enforcer')).toBeInTheDocument();

        state.affiliations = affiliations({ job: 'Hospital', jobBadge: 'b-job', rank: 'Doctor', onDuty: false });
        view.rerender(<InfoStandWidgetUserView avatarInfo={createAvatarInfo('IUI_PEER') as any} setAvatarInfo={vi.fn()} onClose={vi.fn()} />);

        expect(screen.getByText('Off duty')).not.toHaveClass('is-on');

        state.affiliations = affiliations({ job: '', jobBadge: '', rank: '', gang: '', gangBadge: '', gangRank: 'Enforcer' });
        view.rerender(<InfoStandWidgetUserView avatarInfo={createAvatarInfo('IUI_PEER') as any} setAvatarInfo={vi.fn()} onClose={vi.fn()} />);

        expect(document.querySelector('.volt-infostand__duty')).toBeNull();
        expect(document.querySelector('.volt-infostand__stage')).not.toHaveClass('has-duty');
        expect(screen.queryByText('Enforcer')).toBeNull();
    });

    it('renders the requested avatar affiliations for own and peer cards', () => {
        state.affiliations = affiliations({ job: 'Hospital', jobBadge: 'b-job', gang: 'Kings', gangBadge: 'b-gang' });

        const view = render(<InfoStandWidgetUserView avatarInfo={createAvatarInfo('IUI_OWN_USER') as any} setAvatarInfo={vi.fn()} onClose={vi.fn()} />);

        expect(state.affiliationsUserId).toBe(7);
        expect(screen.getByAltText('b-job')).toBeInTheDocument();

        state.affiliations = affiliations({ job: '', jobBadge: '', gang: 'Wolves', gangBadge: 'b-wolf' });
        view.rerender(<InfoStandWidgetUserView avatarInfo={createAvatarInfo('IUI_PEER', { webID: 9 }) as any} setAvatarInfo={vi.fn()} onClose={vi.fn()} />);

        expect(state.affiliationsUserId).toBe(9);
        expect(screen.getByAltText('b-wolf')).toBeInTheDocument();
        expect(screen.queryByAltText('b-job')).toBeNull();
        expect(screen.getByText('No job')).toBeInTheDocument();
        expect(screen.getByText('Wolves')).toBeInTheDocument();
    });

    it('renders loading, unaffiliated, missing-badge and unavailable states', () => {
        state.affiliations = affiliations({ loading: true, unavailable: false, job: '', jobBadge: '', gang: '', gangBadge: '' });
        const view = render(<InfoStandWidgetUserView avatarInfo={createAvatarInfo('IUI_OWN_USER') as any} setAvatarInfo={vi.fn()} onClose={vi.fn()} />);

        expect(screen.getAllByText('Loading')).toHaveLength(2);

        state.affiliations = affiliations({ loading: false, unavailable: false, job: '', jobBadge: '', gang: '', gangBadge: '' });
        view.rerender(<InfoStandWidgetUserView avatarInfo={createAvatarInfo('IUI_OWN_USER') as any} setAvatarInfo={vi.fn()} onClose={vi.fn()} />);

        expect(screen.getByText('No job')).toBeInTheDocument();
        expect(screen.getByText('No gang')).toBeInTheDocument();

        state.affiliations = affiliations({ job: 'Hospital', jobBadge: '', gang: 'Kings', gangBadge: 'b-gang' });
        view.rerender(<InfoStandWidgetUserView avatarInfo={createAvatarInfo('IUI_OWN_USER') as any} setAvatarInfo={vi.fn()} onClose={vi.fn()} />);

        expect(screen.getAllByText('Badge unavailable')).toHaveLength(1);
        expect(screen.getByText('Kings')).toBeInTheDocument();

        state.affiliations = affiliations({ loading: false, unavailable: true, job: '', jobBadge: '', gang: '', gangBadge: '' });
        view.rerender(<InfoStandWidgetUserView avatarInfo={createAvatarInfo('IUI_OWN_USER') as any} setAvatarInfo={vi.fn()} onClose={vi.fn()} />);

        expect(screen.getAllByText('Unavailable')).toHaveLength(2);
    });

    it('has no name header and selects Stats from the avatar without opening the profile window', () => {
        const onClose = vi.fn();

        render(<InfoStandWidgetUserView avatarInfo={createAvatarInfo('IUI_PEER') as any} setAvatarInfo={vi.fn()} onClose={onClose} />);

        // The HUD above names the player; the card only carries it in the tab list's accessible name.
        expect(screen.queryByText('Ada')).toBeNull();
        expect(screen.getByRole('tablist', { name: 'Ada player card' })).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'View stats' }));

        expect(screen.getByRole('tab', { name: 'Stats' })).toHaveAttribute('aria-selected', 'true');
        expect(state.profile).not.toHaveBeenCalled();

        fireEvent.click(screen.getByRole('button', { name: 'Close' }));

        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('switches to Stats and renders the actual combat and punch counters', () => {
        state.affiliations = affiliations({
            rank: 'Captain',
            job: 'Hospital',
            kills: 12,
            deaths: 4,
            punchesThrown: 20,
            punchesMissed: 5,
            punchesReceived: 9,
            timesJailed: 2
        });

        render(<InfoStandWidgetUserView avatarInfo={createAvatarInfo('IUI_PEER') as any} setAvatarInfo={vi.fn()} onClose={vi.fn()} />);

        expect(screen.getByRole('tab', { name: 'Overview' })).toHaveAttribute('aria-selected', 'true');
        expect(document.querySelector('.volt-infostand__avatar-well')).not.toBeNull();

        fireEvent.click(screen.getByRole('tab', { name: 'Stats' }));

        expect(screen.getByRole('tab', { name: 'Stats' })).toHaveAttribute('aria-selected', 'true');
        expect(screen.getByRole('tabpanel')).toHaveAttribute('aria-labelledby', screen.getByRole('tab', { name: 'Stats' }).id);
        expect(document.querySelector('.volt-infostand__avatar-well')).toBeNull();

        // K/D hero with rank, and the kills-versus-deaths split (12 of 16 fights = 75%).
        const combat = within(screen.getByRole('region', { name: 'Combat' }));
        expect(combat.getByText('3.00')).toBeInTheDocument();
        expect(combat.getByText('Captain')).toBeInTheDocument();
        expect(combat.getByTitle('12 kills')).toBeInTheDocument();
        expect(combat.getByTitle('4 deaths')).toBeInTheDocument();
        expect(document.querySelector('.volt-infostand__kd-bar')).toHaveClass('has-deaths');
        expect((document.querySelector('.volt-infostand__kd-bar span') as HTMLElement).style.width).toBe('75%');

        // Fists: accuracy is landed / thrown, and the tiles read Thrown, Landed and Taken.
        const fists = within(screen.getByRole('region', { name: 'Fists' }));
        expect(fists.getByText('75%')).toBeInTheDocument();
        expect(fists.getByTitle('20')).toHaveTextContent('Thrown');
        expect(fists.getByTitle('15')).toHaveTextContent('Landed');
        expect(fists.getByTitle('9')).toHaveTextContent('Taken');
        expect(screen.queryByText('Received')).toBeNull();

        const record = within(screen.getByRole('region', { name: 'Record' }));
        expect(record.getByText('Times jailed')).toBeInTheDocument();
        expect(record.getByText('2')).toBeInTheDocument();
        expect(record.getByText('Known offender')).toBeInTheDocument();
    });

    it('shows a dash for accuracy and a clean record before any punches or arrests', () => {
        state.affiliations = affiliations({ kills: 0, deaths: 0, punchesThrown: 0, punchesMissed: 0, punchesReceived: 0, timesJailed: 0 });
        render(<InfoStandWidgetUserView avatarInfo={createAvatarInfo('IUI_PEER') as any} setAvatarInfo={vi.fn()} onClose={vi.fn()} initialTab="stats" />);

        expect(within(screen.getByRole('region', { name: 'Fists' })).getByText('—')).toBeInTheDocument();
        expect(screen.getByText('Clean record')).toBeInTheDocument();
        expect(document.querySelector('.volt-infostand__kd-bar')).not.toHaveClass('has-deaths');
    });

    it('shows a zero-death K/D with two decimals', () => {
        state.affiliations = affiliations({ kills: 2, deaths: 0 });

        render(<InfoStandWidgetUserView avatarInfo={createAvatarInfo('IUI_PEER') as any} setAvatarInfo={vi.fn()} onClose={vi.fn()} initialTab="stats" />);

        expect(screen.getByText('2.00').parentElement).toHaveAttribute('title', 'No deaths yet: K/D is the kill count');
        expect((document.querySelector('.volt-infostand__kd-bar span') as HTMLElement).style.width).toBe('100%');
    });

    it('keeps the full counter value in its title when the cell clips it', () => {
        const largeValue = 123456789012345;

        state.affiliations = affiliations({ punchesThrown: largeValue });

        render(<InfoStandWidgetUserView avatarInfo={createAvatarInfo('IUI_PEER') as any} setAvatarInfo={vi.fn()} onClose={vi.fn()} initialTab="stats" />);

        expect(screen.getAllByText(String(largeValue))[0].parentElement).toHaveAttribute('title', String(largeValue));
    });

    it('honours the initialTab request', () => {
        render(<InfoStandWidgetUserView avatarInfo={createAvatarInfo('IUI_PEER') as any} setAvatarInfo={vi.fn()} onClose={vi.fn()} initialTab="stats" />);

        expect(screen.getByRole('tab', { name: 'Stats' })).toHaveAttribute('aria-selected', 'true');
        expect(screen.getByRole('tabpanel')).toBeInTheDocument();
        expect(document.querySelector('.volt-infostand__avatar-well')).toBeNull();
    });

    it('shows explicit stats loading and unavailable states without zero counters', () => {
        state.affiliations = affiliations({ loading: true });
        const view = render(
            <InfoStandWidgetUserView avatarInfo={createAvatarInfo('IUI_PEER') as any} setAvatarInfo={vi.fn()} onClose={vi.fn()} initialTab="stats" />
        );

        expect(screen.getByRole('status')).toHaveTextContent('Loading stats');
        expect(screen.queryByText('0')).toBeNull();

        state.affiliations = affiliations({ loading: false, unavailable: true });
        view.rerender(
            <InfoStandWidgetUserView avatarInfo={createAvatarInfo('IUI_PEER') as any} setAvatarInfo={vi.fn()} onClose={vi.fn()} initialTab="stats" />
        );

        expect(screen.getByRole('status')).toHaveTextContent('Stats unavailable');
        expect(screen.queryByText('0')).toBeNull();
    });

    it('resets the tab when the viewed user changes', () => {
        state.affiliations = affiliations({ kills: 3 });
        const view = render(
            <InfoStandWidgetUserView avatarInfo={createAvatarInfo('IUI_PEER', { webID: 7 }) as any} setAvatarInfo={vi.fn()} onClose={vi.fn()} initialTab="stats" />
        );

        fireEvent.click(screen.getByRole('tab', { name: 'Overview' }));
        expect(screen.getByRole('tab', { name: 'Overview' })).toHaveAttribute('aria-selected', 'true');

        view.rerender(
            <InfoStandWidgetUserView avatarInfo={createAvatarInfo('IUI_PEER', { webID: 9 }) as any} setAvatarInfo={vi.fn()} onClose={vi.fn()} initialTab="stats" />
        );

        expect(screen.getByRole('tab', { name: 'Stats' })).toHaveAttribute('aria-selected', 'true');
        expect(state.affiliationsUserId).toBe(9);
    });

    it('moves between tabs with arrow keys, Home and End', () => {
        render(<InfoStandWidgetUserView avatarInfo={createAvatarInfo('IUI_PEER') as any} setAvatarInfo={vi.fn()} onClose={vi.fn()} />);

        const overview = screen.getByRole('tab', { name: 'Overview' });
        const stats = screen.getByRole('tab', { name: 'Stats' });

        fireEvent.keyDown(overview, { key: 'ArrowRight' });
        expect(stats).toHaveAttribute('aria-selected', 'true');

        fireEvent.keyDown(stats, { key: 'ArrowLeft' });
        expect(overview).toHaveAttribute('aria-selected', 'true');

        fireEvent.keyDown(overview, { key: 'End' });
        expect(stats).toHaveAttribute('aria-selected', 'true');

        fireEvent.keyDown(stats, { key: 'Home' });
        expect(overview).toHaveAttribute('aria-selected', 'true');
    });

    it('saves the own motto on Enter and on blur', () => {
        render(<InfoStandWidgetUserView avatarInfo={createAvatarInfo('IUI_OWN_USER') as any} setAvatarInfo={vi.fn()} onClose={vi.fn()} />);

        fireEvent.click(screen.getByRole('button', { name: 'hello there' }));

        const input = screen.getByRole('textbox');

        expect(input).toHaveAttribute('maxlength', '38');
        expect(input).toHaveAccessibleName('infostand.motto.change');

        fireEvent.change(input, { target: { value: 'new motto' } });
        fireEvent.keyDown(input, { key: 'Enter' });

        expect(state.roomSession.sendMottoMessage).toHaveBeenCalledWith('new motto');

        fireEvent.click(screen.getByRole('button', { name: 'new motto' }));

        const blurredInput = screen.getByRole('textbox');

        fireEvent.change(blurredInput, { target: { value: 'second motto' } });
        fireEvent.blur(blurredInput);

        expect(state.roomSession.sendMottoMessage).toHaveBeenCalledWith('second motto');
    });

    it('shows another user motto without an edit control', () => {
        render(
            <InfoStandWidgetUserView avatarInfo={createAvatarInfo('IUI_PEER', { motto: 'other motto' }) as any} setAvatarInfo={vi.fn()} onClose={vi.fn()} />
        );

        expect(screen.getByText('other motto')).toBeInTheDocument();
        expect(screen.queryByRole('textbox')).toBeNull();

        fireEvent.click(screen.getByText('other motto'));

        expect(screen.queryByRole('textbox')).toBeNull();
    });
});
