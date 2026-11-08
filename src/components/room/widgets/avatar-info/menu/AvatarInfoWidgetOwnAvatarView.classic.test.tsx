import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { type ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AvatarInfoWidgetOwnAvatarView } from './AvatarInfoWidgetOwnAvatarView';

const mocks = vi.hoisted(() => ({
    config: new Map<string, unknown>(),
    createLinkEvent: vi.fn(),
    effectId: 0,
    hasClub: true,
    hasVip: true,
    phoneStatus: { hasSim: true, number: '555-0142' } as { hasSim: boolean; number: string } | null,
    posture: 'std',
    sendDanceMessage: vi.fn(),
    sendExpressionMessage: vi.fn(),
    sendPostureMessage: vi.fn(),
    sendSignMessage: vi.fn(),
    showInspectButton: true
}));

afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    mocks.config.clear();
    mocks.effectId = 0;
    mocks.hasClub = true;
    mocks.hasVip = true;
    mocks.phoneStatus = { hasSim: true, number: '555-0142' };
    mocks.posture = 'std';
    mocks.showInspectButton = true;
});

vi.mock('@volt/renderer', () => ({
    AvatarAction: { POSTURE_STAND: 'std', POSTURE_SWIM: 'swim' },
    AvatarExpressionEnum: {
        BLOW: { ordinal: 2 },
        IDLE: { ordinal: 3 },
        LAUGH: { ordinal: 4 },
        WAVE: { ordinal: 1 }
    },
    CreateLinkEvent: mocks.createLinkEvent,
    RoomControllerLevel: { GUEST: 0 },
    RoomObjectCategory: { UNIT: 100 },
    RoomObjectVariable: { FIGURE_EFFECT: 'figure_effect' },
    RoomUnitDropHandItemComposer: class {}
}));

vi.mock('../../../../../api', () => ({
    DispatchUiEvent: vi.fn(),
    GetCanStandUp: () => false,
    GetConfigurationValue: (key: string, fallback: unknown) => (mocks.config.has(key) ? mocks.config.get(key) : fallback),
    GetOwnPosture: () => mocks.posture,
    GetOwnRoomObject: () => ({ model: { getValue: () => mocks.effectId } }),
    GetUserProfile: vi.fn(),
    HasHabboClub: () => mocks.hasClub,
    HasHabboVip: () => mocks.hasVip,
    IsRidingHorse: () => false,
    LocalizeText: (key: string) => key,
    localizeWithFallback: (_key: string, fallback: string) => fallback,
    PostureTypeEnum: { POSTURE_SIT: 'sit', POSTURE_STAND: 'stand' },
    SendMessageComposer: vi.fn()
}));

vi.mock('../../../../../events', () => ({ HelpNameChangeEvent: class {} }));

vi.mock('../../../../../hooks', () => ({
    useRoom: () => ({
        roomSession: {
            sendDanceMessage: mocks.sendDanceMessage,
            sendExpressionMessage: mocks.sendExpressionMessage,
            sendPostureMessage: mocks.sendPostureMessage,
            sendSignMessage: mocks.sendSignMessage
        }
    }),
    useWiredTools: () => ({ openInspectionForUser: vi.fn(), showInspectButton: mocks.showInspectButton })
}));

vi.mock('../../../../../hooks/roleplay/useRpPhone', () => ({ useRpPhone: () => ({ status: mocks.phoneStatus }) }));

vi.mock('../../context-menu/ContextMenuView', () => ({
    ContextMenuView: ({
        children,
        classNames = [],
        freezePositionOnHover,
        maximumVerticalLeadRatio,
        tallAvatarOffset
    }: {
        children: ReactNode;
        classNames?: string[];
        freezePositionOnHover?: boolean;
        maximumVerticalLeadRatio?: number;
        tallAvatarOffset?: number;
    }) => (
        <div
            className={classNames.join(' ')}
            data-freeze-position-on-hover={String(freezePositionOnHover)}
            data-maximum-vertical-lead-ratio={maximumVerticalLeadRatio}
            data-tall-avatar-offset={tallAvatarOffset}
        >
            {children}
        </div>
    )
}));

const avatarInfo = {
    allowNameChange: true,
    amIAnyRoomController: false,
    amIOwner: true,
    carryItem: 7,
    name: 'tester',
    roomControllerLevel: 0,
    roomIndex: 7,
    userType: 1,
    webID: 42
} as any;

const renderMenu = (onClose = vi.fn(), isDancing = false) =>
    render(<AvatarInfoWidgetOwnAvatarView avatarInfo={avatarInfo} isDancing={isDancing} setIsDecorating={vi.fn()} onClose={onClose} />);

const getActionLabels = () => Array.from(document.querySelector('.air-avatar-menu-buttons').children).map((element) => element.textContent);

describe('AIR own-avatar menu', () => {
    it('uses the own-menu variant, AIR anchor rules and the trimmed DistrictRP row order', () => {
        renderMenu();

        const menu = document.querySelector('.volt-avatar-action-menu--own');

        expect(menu).toHaveClass('volt-avatar-action-menu');
        expect(menu).toHaveAttribute('data-tall-avatar-offset', '25');
        expect(menu).toHaveAttribute('data-maximum-vertical-lead-ratio', '0.05');
        expect(menu).toHaveAttribute('data-freeze-position-on-hover', 'true');
        expect(getActionLabels()).toEqual([
            'Clothing',
            'infostand.link.expressions',
            'widget.memenu.dance',
            'infostand.show.signs',
            'avatar.widget.drop_hand_item',
            'infostand.button.wired_inspect'
        ]);
        expect(screen.queryByText('product.type.effect')).not.toBeInTheDocument();
    });

    it('keeps the Clothing action wired', () => {
        const onClose = vi.fn();

        renderMenu(onClose);

        fireEvent.click(screen.getByText('Clothing'));

        expect(mocks.createLinkEvent).toHaveBeenCalledWith('avatar-editor/show');
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('shows the phone number under the name', () => {
        renderMenu();

        expect(document.querySelector('.district-avatar-menu-phone')).toHaveTextContent('555-0142');
    });

    it('shows No SIM when the phone has no SIM', () => {
        mocks.phoneStatus = { hasSim: false, number: '' };

        renderMenu();

        expect(document.querySelector('.district-avatar-menu-phone')).toHaveTextContent('No SIM');
    });

    it('shows no phone line without phone status', () => {
        mocks.phoneStatus = null;

        renderMenu();

        expect(document.querySelector('.district-avatar-menu-phone')).not.toBeInTheDocument();
    });

    it('no longer shows the removed rows', () => {
        renderMenu();

        expect(screen.queryByText('widget.avatar.change_name')).not.toBeInTheDocument();
        expect(screen.queryByText('widget.avatar.decorate')).not.toBeInTheDocument();
        expect(screen.queryByText('Badge leaderboard')).not.toBeInTheDocument();
    });

});
