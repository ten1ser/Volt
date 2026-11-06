import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePlayerCardStore } from '../../../../state/playerCardStore';
import { AvatarInfoWidgetView } from './AvatarInfoWidgetView';

const state = vi.hoisted(() => ({
    avatarInfo: null as any,
    setAvatarInfo: vi.fn(),
    setActiveNameBubble: vi.fn(),
    getUserInfo: vi.fn(),
    getUserData: vi.fn(),
    selectedHandler: null as any,
    tracker: null as any,
    userData: { roomIndex: 5, webID: 1 } as any,
    enterRunning: false,
    roomSession: {
        roomId: 1,
        ownRoomIndex: 5,
        isSpectator: false,
        userDataManager: { getUserData: (id: number) => state.getUserData(id), getUserDataByIndex: () => state.userData }
    } as any
}));

vi.mock('@volt/renderer', () => ({
    AddLinkEventTracker: (tracker: any) => {
        state.tracker = tracker;
    },
    GetRoomEngine: () => ({ clearSelectedAvatar: vi.fn() }),
    GetSessionDataManager: () => ({ getUserTags: vi.fn(), userId: 1, userName: 'Ada' }),
    RemoveLinkEventTracker: vi.fn(),
    RoomEngineEvent: { GAME_MODE: 'GAME_MODE', NORMAL_MODE: 'NORMAL_MODE' },
    RoomEngineObjectEvent: { REQUEST_MANIPULATION: 'REQUEST_MANIPULATION', REQUEST_PICKUP: 'REQUEST_PICKUP' },
    RoomEnterEffect: { isRunning: () => state.enterRunning },
    RoomObjectCategory: { UNIT: 100 },
    RoomObjectType: { BOT: 2, PET: 3, RENTABLE_BOT: 4, USER: 1 },
    RoomSessionDanceEvent: { RSDE_DANCE: 'RSDE_DANCE' }
}));

vi.mock('../../../../api', () => {
    class AvatarInfoUser {
        static BOT = 'IUI_BOT';
        static OWN_USER = 'IUI_OWN_USER';
        static PEER = 'IUI_PEER';

        get isOwnUser() {
            return this.type === AvatarInfoUser.OWN_USER;
        }

        constructor(public type: string, public roomIndex = 5) {}
    }

    class AvatarInfoFurni {
        static FURNI = 'FURNI';
    }

    class AvatarInfoPet {
        static PET_INFO = 'PET_INFO';
    }

    class AvatarInfoRentableBot {
        static RENTABLE_BOT = 'RENTABLE_BOT';
    }

    return {
        AvatarInfoFurni,
        AvatarInfoPet,
        AvatarInfoRentableBot,
        AvatarInfoUser,
        AvatarInfoUtilities: { getUserInfo: state.getUserInfo },
        GetConfigurationValue: (_key: string, value?: unknown) => value,
        RoomWidgetUpdateRentableBotChatEvent: { UPDATE_CHAT: 'UPDATE_CHAT' }
    };
});

vi.mock('../../../../common', () => ({
    Column: ({ children, className }: any) => <div data-testid="infostand-column" className={className}>{children}</div>,
    LayoutFurniIconImageView: () => null
}));

vi.mock('../../../../hooks', () => ({
    useAvatarInfoWidget: () => ({
        avatarInfo: state.avatarInfo,
        setAvatarInfo: state.setAvatarInfo,
        activeNameBubble: null,
        setActiveNameBubble: state.setActiveNameBubble,
        nameBubbles: [],
        removeNameBubble: vi.fn(),
        productBubbles: [],
        confirmingProduct: null,
        updateConfirmingProduct: vi.fn(),
        removeProductBubble: vi.fn(),
        isDecorating: false,
        setIsDecorating: vi.fn()
    }),
    useFurniPickupGuard: () => ({ pickupRoomObject: vi.fn() }),
    useObjectSelectedEvent: (handler: any) => {
        state.selectedHandler = handler;
    },
    useRoom: () => ({ roomSession: state.roomSession }),
    useUiEvent: () => undefined,
    useVoltEvent: () => undefined
}));

vi.mock('./AvatarInfoPetTrainingPanelView', () => ({ AvatarInfoPetTrainingPanelView: () => null }));
vi.mock('./AvatarInfoRentableBotChatView', () => ({ AvatarInfoRentableBotChatView: () => null }));
vi.mock('./AvatarInfoUseProductConfirmView', () => ({ AvatarInfoUseProductConfirmView: () => null }));
vi.mock('./AvatarInfoUseProductView', () => ({ AvatarInfoUseProductView: () => null }));
vi.mock('./infostand/InfoStandWidgetBotView', () => ({ InfoStandWidgetBotView: () => <div data-testid="bot-card" /> }));
vi.mock('./infostand/InfoStandWidgetFurniView', () => ({ InfoStandWidgetFurniView: () => null }));
vi.mock('./infostand/InfoStandWidgetPetView', () => ({ InfoStandWidgetPetView: () => null }));
vi.mock('./infostand/InfoStandWidgetRentableBotView', () => ({ InfoStandWidgetRentableBotView: () => null }));
vi.mock('./menu/AvatarInfoWidgetAvatarView', () => ({ AvatarInfoWidgetAvatarView: () => <div data-testid="peer-menu" /> }));
vi.mock('./menu/AvatarInfoWidgetDecorateView', () => ({ AvatarInfoWidgetDecorateView: () => null }));
vi.mock('./menu/AvatarInfoWidgetFurniView', () => ({ AvatarInfoWidgetFurniView: () => null }));
vi.mock('./menu/AvatarInfoWidgetNameView', () => ({ AvatarInfoWidgetNameView: () => null }));
vi.mock('./menu/AvatarInfoWidgetOwnAvatarView', () => ({ AvatarInfoWidgetOwnAvatarView: () => <div data-testid="own-menu" /> }));
vi.mock('./menu/AvatarInfoWidgetOwnPetView', () => ({ AvatarInfoWidgetOwnPetView: () => null }));
vi.mock('./menu/AvatarInfoWidgetPetView', () => ({ AvatarInfoWidgetPetView: () => null }));
vi.mock('./menu/AvatarInfoWidgetRentableBotView', () => ({ AvatarInfoWidgetRentableBotView: () => null }));

const cardState = () => usePlayerCardStore.getState();

beforeEach(() => {
    state.avatarInfo = null;
    state.setAvatarInfo.mockReset();
    state.setAvatarInfo.mockImplementation((value: any) => {
        state.avatarInfo = value;
    });
    state.setActiveNameBubble.mockClear();
    state.getUserInfo.mockReset();
    state.getUserData.mockReset();
    state.getUserData.mockImplementation(() => state.userData);
    state.selectedHandler = null;
    state.tracker = null;
    state.userData = { roomIndex: 5, webID: 1 };
    state.enterRunning = false;
    state.roomSession = {
        roomId: 1,
        ownRoomIndex: 5,
        isSpectator: false,
        userDataManager: { getUserData: (id: number) => state.getUserData(id), getUserDataByIndex: () => state.userData }
    };
    cardState().close();

    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
});

afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
});

describe('avatar info player card', () => {
    it('leaves world own and peer selections to their ordinary menus without a card', () => {
        for (const [type, menu] of [['IUI_OWN_USER', 'own-menu'], ['IUI_PEER', 'peer-menu']] as const) {
            state.avatarInfo = { type, roomIndex: 5, isOwnUser: type === 'IUI_OWN_USER', isSpectatorMode: false };

            const view = render(<AvatarInfoWidgetView />);

            expect(screen.getByTestId(menu)).toBeInTheDocument();
            expect(screen.queryByTestId('infostand-column')).toBeNull();
            expect(cardState().avatarInfo).toBeNull();

            view.unmount();
        }
    });

    it('ignores HUD toggles without a room session', () => {
        state.roomSession = null;

        render(<AvatarInfoWidgetView />);

        act(() => state.tracker.linkReceived('avatar-info/toggle-own'));
        act(() => state.tracker.linkReceived('avatar-info/toggle-user/6'));

        expect(state.getUserInfo).not.toHaveBeenCalled();
        expect(cardState().avatarInfo).toBeNull();
    });

    it('keeps non-user infostands in the original bottom-right placement', () => {
        state.avatarInfo = { type: 'IUI_BOT', roomIndex: 5 };

        render(<AvatarInfoWidgetView />);

        const column = screen.getByTestId('infostand-column');

        expect(column).toContainElement(screen.getByTestId('bot-card'));
    });

    it('opens the shared Overview card from the HUD toggle without a world menu', () => {
        const ownInfo = { type: 'IUI_OWN_USER', webID: 1, roomIndex: 5, isOwnUser: true, isSpectatorMode: false };

        state.getUserInfo.mockReturnValue(ownInfo);
        render(<AvatarInfoWidgetView />);

        act(() => state.tracker.linkReceived('avatar-info/toggle-own'));

        expect(state.getUserInfo).toHaveBeenCalledWith(100, state.userData);
        expect(state.setActiveNameBubble).toHaveBeenCalledWith(null);
        expect(state.setAvatarInfo).not.toHaveBeenCalled();
        expect(cardState()).toMatchObject({ avatarInfo: ownInfo, initialTab: 'overview', source: 'room' });
    });

    it('closes the same card on a second HUD toggle', () => {
        const ownInfo = { type: 'IUI_OWN_USER', webID: 1, roomIndex: 5, isOwnUser: true, isSpectatorMode: false };

        state.getUserInfo.mockReturnValue(ownInfo);
        render(<AvatarInfoWidgetView />);

        act(() => state.tracker.linkReceived('avatar-info/toggle-own'));
        expect(cardState().avatarInfo).toBe(ownInfo);

        act(() => state.tracker.linkReceived('avatar-info/toggle-own'));

        expect(cardState().avatarInfo).toBeNull();
    });

    it('opens Overview from the HUD when a profile card for the same own user is open', () => {
        const ownInfo = { type: 'IUI_OWN_USER', webID: 1, roomIndex: 5, isOwnUser: true, isSpectatorMode: false };

        cardState().open(ownInfo as any, 'stats', 'profile');
        state.getUserInfo.mockReturnValue(ownInfo);
        render(<AvatarInfoWidgetView />);

        act(() => state.tracker.linkReceived('avatar-info/toggle-own'));

        expect(cardState()).toMatchObject({ avatarInfo: ownInfo, initialTab: 'overview', source: 'room' });

        act(() => state.tracker.linkReceived('avatar-info/toggle-own'));

        expect(cardState().avatarInfo).toBeNull();
    });

    it('opens Overview from the HUD for a targeted user whose profile card is open', () => {
        const peerInfo = { type: 'IUI_PEER', webID: 6, roomIndex: 6, name: 'Mara' };

        cardState().open(peerInfo as any, 'stats', 'profile');
        state.userData = { webID: 6, type: 1, roomIndex: 6 };
        state.getUserInfo.mockReturnValue(peerInfo);
        render(<AvatarInfoWidgetView />);

        act(() => state.tracker.linkReceived('avatar-info/toggle-user/6'));

        expect(cardState()).toMatchObject({ avatarInfo: peerInfo, initialTab: 'overview', source: 'room' });

        act(() => state.tracker.linkReceived('avatar-info/toggle-user/6'));

        expect(cardState().avatarInfo).toBeNull();
    });

    it('replaces an open peer card with the own card from the HUD toggle', () => {
        const ownInfo = { type: 'IUI_OWN_USER', webID: 1, roomIndex: 5, isOwnUser: true, isSpectatorMode: false };
        const peerInfo = { type: 'IUI_PEER', webID: 6, roomIndex: 6, name: 'Peer' };

        cardState().open(peerInfo as any, 'stats', 'profile');
        state.getUserInfo.mockReturnValue(ownInfo);
        render(<AvatarInfoWidgetView />);

        act(() => state.tracker.linkReceived('avatar-info/toggle-own'));

        expect(cardState()).toMatchObject({ avatarInfo: ownInfo, initialTab: 'overview', source: 'room' });
    });

    it('opens the own card from the HUD when the own avatar was selected by the world', () => {
        const ownInfo = { type: 'IUI_OWN_USER', webID: 1, roomIndex: 5, isOwnUser: true, isSpectatorMode: false };

        state.avatarInfo = ownInfo;
        state.getUserInfo.mockReturnValue(ownInfo);
        render(<AvatarInfoWidgetView />);

        expect(screen.getByTestId('own-menu')).toBeInTheDocument();

        act(() => state.tracker.linkReceived('avatar-info/toggle-own'));

        expect(state.setAvatarInfo).not.toHaveBeenCalled();
        expect(cardState().avatarInfo).toBe(ownInfo);
        expect(screen.queryByTestId('own-menu')).toBeNull();
    });

    it('opens and closes a targeted peer card from its user id', () => {
        const peerInfo = { type: 'IUI_PEER', webID: 6, roomIndex: 6, name: 'Mara' };

        state.userData = { webID: 6, type: 1, roomIndex: 6 };
        state.getUserInfo.mockReturnValue(peerInfo);
        render(<AvatarInfoWidgetView />);

        act(() => state.tracker.linkReceived('avatar-info/toggle-user/6'));

        expect(state.getUserData).toHaveBeenCalledWith(6);
        expect(state.getUserInfo).toHaveBeenCalledWith(100, state.userData);
        expect(state.setAvatarInfo).not.toHaveBeenCalled();
        expect(cardState()).toMatchObject({ avatarInfo: peerInfo, initialTab: 'overview', source: 'room' });

        act(() => state.tracker.linkReceived('avatar-info/toggle-user/6'));

        expect(cardState().avatarInfo).toBeNull();
    });

    it('denies invalid, missing, mismatched, or bot target ids', () => {
        state.userData = { webID: 6, type: 1, roomIndex: 6 };
        render(<AvatarInfoWidgetView />);

        for (const link of ['avatar-info/toggle-user/abc', 'avatar-info/toggle-user/0', 'avatar-info/toggle-user/-1', 'avatar-info/toggle-user/1.5']) {
            act(() => state.tracker.linkReceived(link));
        }

        expect(state.getUserData).not.toHaveBeenCalled();
        expect(state.getUserInfo).not.toHaveBeenCalled();
        expect(cardState().avatarInfo).toBeNull();

        state.getUserData.mockClear();
        state.userData = null;
        act(() => state.tracker.linkReceived('avatar-info/toggle-user/6'));
        expect(state.getUserData).toHaveBeenCalledWith(6);
        expect(state.getUserInfo).not.toHaveBeenCalled();
        expect(cardState().avatarInfo).toBeNull();

        state.userData = { webID: 7, type: 1, roomIndex: 6 };
        act(() => state.tracker.linkReceived('avatar-info/toggle-user/6'));
        expect(state.getUserInfo).not.toHaveBeenCalled();

        state.userData = { webID: 6, type: 2, roomIndex: 6 };
        act(() => state.tracker.linkReceived('avatar-info/toggle-user/6'));
        expect(state.getUserInfo).not.toHaveBeenCalled();
        expect(cardState().avatarInfo).toBeNull();
    });

    it('ignores the HUD toggle without own user data, in spectator mode, or during a room transition', () => {
        state.userData = null;
        render(<AvatarInfoWidgetView />);

        act(() => state.tracker.linkReceived('avatar-info/toggle-own'));

        expect(state.getUserInfo).not.toHaveBeenCalled();
        expect(cardState().avatarInfo).toBeNull();

        cleanup();
        state.userData = { roomIndex: 5, webID: 1 };
        state.roomSession = { roomId: 1, ownRoomIndex: 5, isSpectator: true, userDataManager: { getUserDataByIndex: () => state.userData } };
        render(<AvatarInfoWidgetView />);

        act(() => state.tracker.linkReceived('avatar-info/toggle-own'));

        expect(state.getUserInfo).not.toHaveBeenCalled();
        expect(cardState().avatarInfo).toBeNull();

        cleanup();
        state.roomSession = { roomId: 1, ownRoomIndex: 5, isSpectator: false, userDataManager: { getUserDataByIndex: () => state.userData } };
        state.enterRunning = true;
        render(<AvatarInfoWidgetView />);

        act(() => state.tracker.linkReceived('avatar-info/toggle-own'));

        expect(state.getUserInfo).not.toHaveBeenCalled();
        expect(cardState().avatarInfo).toBeNull();
    });

    it('closes the shared card on a room object selection and restores the world menu', () => {
        const peerInfo = { type: 'IUI_PEER', webID: 6, roomIndex: 6, isOwnUser: false, isSpectatorMode: false };

        state.avatarInfo = peerInfo;
        cardState().open(peerInfo as any, 'overview', 'room');
        render(<AvatarInfoWidgetView />);

        expect(screen.queryByTestId('peer-menu')).toBeNull();

        act(() => state.selectedHandler());

        expect(cardState().avatarInfo).toBeNull();
        expect(screen.getByTestId('peer-menu')).toBeInTheDocument();
    });

    it('closes the shared card from hide and block-menu links', () => {
        const ownInfo = { type: 'IUI_OWN_USER', webID: 1, roomIndex: 5, isOwnUser: true, isSpectatorMode: false };

        state.getUserInfo.mockReturnValue(ownInfo);
        render(<AvatarInfoWidgetView />);

        cardState().open(ownInfo as any, 'overview', 'room');
        act(() => state.tracker.linkReceived('avatar-info/hide'));

        expect(cardState().avatarInfo).toBeNull();
        expect(state.setAvatarInfo).toHaveBeenCalledWith(null);

        cardState().open(ownInfo as any, 'overview', 'room');
        act(() => state.tracker.linkReceived('avatar-info/block-menu'));

        expect(cardState().avatarInfo).toBeNull();
    });

    it('clears a room card on unmount but keeps a globally opened profile', () => {
        const roomInfo = { type: 'IUI_PEER', webID: 6, roomIndex: 6 };
        const profileInfo = { type: 'IUI_PEER', webID: 7, roomIndex: -1 };

        const view = render(<AvatarInfoWidgetView />);

        cardState().open(roomInfo as any, 'overview', 'room');
        view.unmount();

        expect(cardState().avatarInfo).toBeNull();

        cardState().open(profileInfo as any, 'stats', 'profile');

        const second = render(<AvatarInfoWidgetView />);

        second.unmount();

        expect(cardState().avatarInfo).toBe(profileInfo);

        cardState().open(roomInfo as any, 'overview', 'room');

        const third = render(<AvatarInfoWidgetView />);

        state.roomSession = { ...state.roomSession, roomId: 2 };
        third.rerender(<AvatarInfoWidgetView />);

        expect(cardState().avatarInfo).toBeNull();
    });
});
