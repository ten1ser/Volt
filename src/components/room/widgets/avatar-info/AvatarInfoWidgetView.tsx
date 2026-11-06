import {
    AddLinkEventTracker,
    GetRoomEngine,
    GetSessionDataManager,
    ILinkEventTracker,
    RemoveLinkEventTracker,
    RoomEngineEvent,
    RoomEngineObjectEvent,
    RoomEnterEffect,
    RoomObjectCategory,
    RoomObjectType,
    RoomSessionDanceEvent
} from '@volt/renderer';
import { FC, useEffect, useState } from 'react';
import {
    AvatarInfoFurni,
    AvatarInfoPet,
    AvatarInfoRentableBot,
    AvatarInfoUser,
    AvatarInfoUtilities,
    GetConfigurationValue,
    RoomWidgetUpdateRentableBotChatEvent
} from '../../../../api';
import { Column, LayoutFurniIconImageView } from '../../../../common';
import { useAvatarInfoWidget, useFurniPickupGuard, useObjectSelectedEvent, useVoltEvent, useRoom, useUiEvent } from '../../../../hooks';
import { usePlayerCardStore } from '../../../../state/playerCardStore';
import { AvatarInfoPetTrainingPanelView } from './AvatarInfoPetTrainingPanelView';
import { AvatarInfoRentableBotChatView } from './AvatarInfoRentableBotChatView';
import { AvatarInfoUseProductConfirmView } from './AvatarInfoUseProductConfirmView';
import { AvatarInfoUseProductView } from './AvatarInfoUseProductView';
import { InfoStandWidgetBotView } from './infostand/InfoStandWidgetBotView';
import { InfoStandWidgetFurniView } from './infostand/InfoStandWidgetFurniView';
import { InfoStandWidgetPetView } from './infostand/InfoStandWidgetPetView';
import { InfoStandWidgetRentableBotView } from './infostand/InfoStandWidgetRentableBotView';
import { AvatarInfoWidgetAvatarView } from './menu/AvatarInfoWidgetAvatarView';
import { AvatarInfoWidgetDecorateView } from './menu/AvatarInfoWidgetDecorateView';
import { AvatarInfoWidgetFurniView } from './menu/AvatarInfoWidgetFurniView';
import { AvatarInfoWidgetNameView } from './menu/AvatarInfoWidgetNameView';
import { AvatarInfoWidgetOwnAvatarView } from './menu/AvatarInfoWidgetOwnAvatarView';
import { AvatarInfoWidgetOwnPetView } from './menu/AvatarInfoWidgetOwnPetView';
import { AvatarInfoWidgetPetView } from './menu/AvatarInfoWidgetPetView';
import { AvatarInfoWidgetRentableBotView } from './menu/AvatarInfoWidgetRentableBotView';

export const AvatarInfoWidgetView: FC<{}> = (props) => {
    const BLOCK_MENU_WINDOW_MS = 500;
    const BLOCK_ROTATE_WINDOW_MS = 500;
    const [isGameMode, setGameMode] = useState(false);
    const { pickupRoomObject } = useFurniPickupGuard();
    const [isDancing, setIsDancing] = useState(false);
    const [isTouchLayout, setIsTouchLayout] = useState(false);
    const [mobileFurniDetailsOpen, setMobileFurniDetailsOpen] = useState(false);
    const [mobileUserDetailsOpen, setMobileUserDetailsOpen] = useState(false);
    const [rentableBotChatEvent, setRentableBotChatEvent] = useState<RoomWidgetUpdateRentableBotChatEvent>(null);
    const {
        avatarInfo = null,
        setAvatarInfo = null,
        activeNameBubble = null,
        setActiveNameBubble = null,
        nameBubbles = [],
        removeNameBubble = null,
        productBubbles = [],
        confirmingProduct = null,
        updateConfirmingProduct = null,
        removeProductBubble = null,
        isDecorating = false,
        setIsDecorating = null
    } = useAvatarInfoWidget();
    const { roomSession = null } = useRoom();
    const isPlayerCard = avatarInfo?.type === AvatarInfoUser.OWN_USER || avatarInfo?.type === AvatarInfoUser.PEER;
    const cardVisible = usePlayerCardStore(state => state.avatarInfo !== null);

    const updateAvatarClickControl = (updates: { suppressMenuUntil?: number; suppressRotateUntil?: number }) => {
        const globalScope = globalThis as any;

        if (!globalScope.__voltAvatarClickControl) {
            globalScope.__voltAvatarClickControl = {
                suppressMenuUntil: 0,
                suppressRotateUntil: 0
            };
        }

        Object.assign(globalScope.__voltAvatarClickControl, updates);
    };

    useVoltEvent<RoomEngineEvent>(RoomEngineEvent.NORMAL_MODE, (event) => {
        if (isGameMode) setGameMode(false);
    });

    useVoltEvent<RoomEngineEvent>(RoomEngineEvent.GAME_MODE, (event) => {
        if (!isGameMode) setGameMode(true);
    });

    useEffect(() => {
        const query = window.matchMedia('(pointer: coarse), (hover: none)');
        const updateTouchLayout = () => setIsTouchLayout(query.matches);

        updateTouchLayout();
        query.addEventListener('change', updateTouchLayout);

        return () => query.removeEventListener('change', updateTouchLayout);
    }, []);

    useVoltEvent<RoomSessionDanceEvent>(RoomSessionDanceEvent.RSDE_DANCE, (event) => {
        if (event.roomIndex !== roomSession.ownRoomIndex) return;

        setIsDancing(event.danceId !== 0);
    });

    useUiEvent<RoomWidgetUpdateRentableBotChatEvent>(RoomWidgetUpdateRentableBotChatEvent.UPDATE_CHAT, (event) => setRentableBotChatEvent(event));

    useVoltEvent<RoomEngineObjectEvent>(RoomEngineObjectEvent.REQUEST_PICKUP, (event) => pickupRoomObject(event.objectId, event.category));

    useVoltEvent<RoomEngineObjectEvent>(RoomEngineObjectEvent.REQUEST_MANIPULATION, (event) => {
        if (!(avatarInfo instanceof AvatarInfoFurni)) return;
        if (event.category !== avatarInfo.category || event.objectId !== avatarInfo.id) return;

        setMobileFurniDetailsOpen(false);
    });

    useEffect(() => {
        const linkTracker: ILinkEventTracker = {
            linkReceived: (url: string) => {
                const parts = url.split('/');

                if (parts.length < 2) return;

                switch (parts[1]) {
                    case 'hide':
                        setAvatarInfo(null);
                        setActiveNameBubble(null);
                        usePlayerCardStore.getState().close();

                        if (roomSession) GetRoomEngine().clearSelectedAvatar(roomSession.roomId);
                        return;
                    case 'toggle-own': {
                        if (!roomSession || isGameMode || roomSession.isSpectator || RoomEnterEffect.isRunning()) return;

                        const userData = roomSession.userDataManager?.getUserDataByIndex(roomSession.ownRoomIndex);

                        if (!userData) return;

                        const info = AvatarInfoUtilities.getUserInfo(RoomObjectCategory.UNIT, userData);

                        if (!info || info.isSpectatorMode) return;

                        const card = usePlayerCardStore.getState();

                        setActiveNameBubble(null);

                        if (card.source === 'room' && card.avatarInfo?.webID === info.webID) {
                            card.close();
                            return;
                        }

                        card.open(info, 'overview', 'room');
                        return;
                    }
                    case 'toggle-user': {
                        if (!roomSession || isGameMode || roomSession.isSpectator || RoomEnterEffect.isRunning()) return;

                        const rawUserId = parts[2];

                        if (!rawUserId || !/^\d+$/.test(rawUserId)) return;

                        const userId = Number(rawUserId);

                        if (!Number.isSafeInteger(userId) || userId <= 0) return;

                        const userData = roomSession.userDataManager?.getUserData(userId);

                        if (!userData || userData.webID !== userId || userData.type !== RoomObjectType.USER) return;

                        const info = AvatarInfoUtilities.getUserInfo(RoomObjectCategory.UNIT, userData);

                        if (!info) return;

                        const card = usePlayerCardStore.getState();

                        setActiveNameBubble(null);

                        if (card.source === 'room' && card.avatarInfo?.webID === userId) {
                            card.close();
                            return;
                        }

                        card.open(info, 'overview', 'room');
                        return;
                    }
                    case 'block-menu':
                        updateAvatarClickControl({ suppressMenuUntil: Date.now() + BLOCK_MENU_WINDOW_MS });
                        usePlayerCardStore.getState().close();
                        setAvatarInfo(null);
                        setActiveNameBubble(null);
                        return;
                    case 'block-rotate':
                        updateAvatarClickControl({ suppressRotateUntil: Date.now() + BLOCK_ROTATE_WINDOW_MS });
                        return;
                }
            },
            eventUrlPrefix: 'avatar-info/'
        };

        AddLinkEventTracker(linkTracker);

        return () => RemoveLinkEventTracker(linkTracker);
    }, [isGameMode, roomSession, setActiveNameBubble, setAvatarInfo]);

    useEffect(() => {
        if (avatarInfo?.type !== AvatarInfoFurni.FURNI) {
            setMobileFurniDetailsOpen(false);
        }

        if (avatarInfo?.type !== AvatarInfoUser.OWN_USER && avatarInfo?.type !== AvatarInfoUser.PEER) {
            setMobileUserDetailsOpen(false);
        }
    }, [avatarInfo]);

    useObjectSelectedEvent(() => usePlayerCardStore.getState().close());

    // A card opened from the in-room HUD belongs to this room; a globally opened profile stays.
    const roomId = roomSession?.roomId ?? -1;

    useEffect(() => {
        return () => {
            const card = usePlayerCardStore.getState();

            if (card.source === 'room') card.close();
        };
    }, [roomId]);

    const getMenuView = () => {
        if (!roomSession || isGameMode || cardVisible) return null;

        if (activeNameBubble) return <AvatarInfoWidgetNameView nameInfo={activeNameBubble} onClose={() => setActiveNameBubble(null)} />;

        if (avatarInfo) {
            switch (avatarInfo.type) {
                case AvatarInfoFurni.FURNI: {
                    const info = avatarInfo as AvatarInfoFurni;

                    if (!isDecorating) return null;

                    return <AvatarInfoWidgetFurniView avatarInfo={info} onClose={() => setAvatarInfo(null)} />;
                }
                case AvatarInfoUser.OWN_USER:
                case AvatarInfoUser.PEER: {
                    const info = avatarInfo as AvatarInfoUser;

                    if (isTouchLayout && !mobileUserDetailsOpen) return null;

                    if (GetConfigurationValue('user.tags.enabled')) GetSessionDataManager().getUserTags(info.roomIndex);

                    if (info.isSpectatorMode) return null;

                    if (info.isOwnUser) {
                        if (RoomEnterEffect.isRunning()) return null;

                        return (
                            <AvatarInfoWidgetOwnAvatarView
                                avatarInfo={info}
                                isDancing={isDancing}
                                setIsDecorating={setIsDecorating}
                                onClose={() => setAvatarInfo(null)}
                            />
                        );
                    }

                    return <AvatarInfoWidgetAvatarView avatarInfo={info} onClose={() => setAvatarInfo(null)} />;
                }
                case AvatarInfoPet.PET_INFO: {
                    const info = avatarInfo as AvatarInfoPet;

                    if (info.isOwner) return <AvatarInfoWidgetOwnPetView avatarInfo={info} onClose={() => setAvatarInfo(null)} />;

                    return <AvatarInfoWidgetPetView avatarInfo={info} onClose={() => setAvatarInfo(null)} />;
                }
                case AvatarInfoRentableBot.RENTABLE_BOT: {
                    return <AvatarInfoWidgetRentableBotView avatarInfo={avatarInfo as AvatarInfoRentableBot} onClose={() => setAvatarInfo(null)} />;
                }
            }
        }

        return null;
    };

    const getInfostandView = () => {
        if (!avatarInfo) return null;

        switch (avatarInfo.type) {
            case AvatarInfoFurni.FURNI:
                if (isTouchLayout && !isDecorating) {
                    const info = avatarInfo as AvatarInfoFurni;

                    if (!mobileFurniDetailsOpen) {
                        return (
                            <button className="volt-mobile-furni-infostand-trigger" type="button" onClick={() => setMobileFurniDetailsOpen(true)}>
                                <LayoutFurniIconImageView productType={info.productType} productClassId={info.spriteId} />
                            </button>
                        );
                    }
                }

                return <InfoStandWidgetFurniView avatarInfo={avatarInfo as AvatarInfoFurni} onClose={() => setAvatarInfo(null)} />;
            case AvatarInfoUser.BOT:
                return <InfoStandWidgetBotView avatarInfo={avatarInfo as AvatarInfoUser} onClose={() => setAvatarInfo(null)} />;
            case AvatarInfoRentableBot.RENTABLE_BOT:
                return <InfoStandWidgetRentableBotView avatarInfo={avatarInfo as AvatarInfoRentableBot} onClose={() => setAvatarInfo(null)} />;
            case AvatarInfoPet.PET_INFO:
                return <InfoStandWidgetPetView avatarInfo={avatarInfo as AvatarInfoPet} onClose={() => setAvatarInfo(null)} />;
        }
    };

    return (
        <>
            {isDecorating && (
                <AvatarInfoWidgetDecorateView
                    roomIndex={roomSession.ownRoomIndex}
                    setIsDecorating={setIsDecorating}
                    userId={GetSessionDataManager().userId}
                    userName={GetSessionDataManager().userName}
                />
            )}
            {getMenuView()}
            {avatarInfo && !isPlayerCard && (
                <Column alignItems="end" className="absolute right-[5px] bottom-[57px] pointer-events-none z-30 text-white">
                    {getInfostandView()}
                </Column>
            )}
            {nameBubbles.length > 0 &&
                nameBubbles.map((name, index) => <AvatarInfoWidgetNameView key={index} isFriendEntry={true} nameInfo={name} onClose={() => removeNameBubble(index)} />)}
            {productBubbles.length > 0 &&
                productBubbles.map((item, index) => {
                    return (
                        <AvatarInfoUseProductView
                            key={item.id}
                            item={item}
                            updateConfirmingProduct={updateConfirmingProduct}
                            onClose={() => removeProductBubble(index)}
                        />
                    );
                })}
            {rentableBotChatEvent && <AvatarInfoRentableBotChatView chatEvent={rentableBotChatEvent} onClose={() => setRentableBotChatEvent(null)} />}
            {confirmingProduct && <AvatarInfoUseProductConfirmView item={confirmingProduct} onClose={() => updateConfirmingProduct(null)} />}
            <AvatarInfoPetTrainingPanelView />
        </>
    );
};
