import { CreateLinkEvent, GetGuestRoomResultEvent, GetRoomEngine, RateFlatMessageComposer, RoomEngineEvent } from '@volt/renderer';
import { CSSProperties, FC, useEffect, useState } from 'react';
import { GetConfigurationValue, LocalizeText, SendMessageComposer, TryVisitRoom } from '../../../../api';
import { localizeWithFallback } from '../../../../api/utils/localizeWithFallback';
import { useAchievements, useMessageEvent, useNavigatorData, useVoltEvent, useRoom } from '../../../../hooks';
import { classNames } from '../../../../layout';
import { getRegisteredPlugins, IVoltPlugin, subscribePlugins } from '../../../plugins/VoltPluginApi';
import { getRoomHistoryList, useRoomToolsHistoryStore } from './roomToolsHistoryStore';
import { useRoomToolsMenuStore } from './roomToolsMenuStore';
import { applyRoomZoom, getLogicalRoomZoomScale, getNearestZoomScale, getNextZoomScale } from './roomZoom.helpers';

const getZoomText = (scale: number) => (Math.round(Math.log(getNearestZoomScale(scale)) / Math.LN2) + 1).toString();

export const RoomToolsWidgetView: FC<{}> = (props) => {
    const [zoomScale, setZoomScale] = useState<number>(1);
    const [hasLikedRoom, setHasLikedRoom] = useState<boolean>(false);
    // DistrictRP: the tools are a menu opened from the room name chip (DistrictHud), not a side rail.
    const isToolsOpen = useRoomToolsMenuStore((state) => state.open);
    const setToolsOpen = useRoomToolsMenuStore((state) => state.setOpen);
    const [isOpenHistory, setIsOpenHistory] = useState<boolean>(false);
    const historyEntries = useRoomToolsHistoryStore((state) => state.entries);
    const historyIndex = useRoomToolsHistoryStore((state) => state.index);
    const [plugins, setPlugins] = useState<IVoltPlugin[]>([]);
    const { navigatorData } = useNavigatorData();
    const { hasWiredAchievements } = useAchievements();
    const { roomSession = null } = useRoom();

    useEffect(() => {
        setPlugins(getRegisteredPlugins());
        return subscribePlugins(() => setPlugins(getRegisteredPlugins()));
    }, []);

    const getLogicalZoomScale = () => {
        if (!roomSession) return 1;

        return getLogicalRoomZoomScale(roomSession.roomId);
    };

    const applyZoomScale = (logicalScale: number) => {
        if (!roomSession) return;

        applyRoomZoom(roomSession.roomId, logicalScale);
        setZoomScale(logicalScale);
    };

    const updateZoomScale = () => {
        if (!roomSession) return;

        setZoomScale(getLogicalZoomScale());
    };

    const zoomRoom = (direction: number) => {
        if (!roomSession || direction === 0) return;

        if (!GetConfigurationValue('room.zoom.enabled', true)) {
            const geometry = GetRoomEngine().getRoomInstanceGeometry(roomSession.roomId, 1);
            if (!geometry) return;

            if (direction > 0) geometry.performZoomIn();
            else geometry.performZoomOut();

            setZoomScale(direction > 0 ? 2 : 1);
            return;
        }

        const currentScale = getLogicalZoomScale();
        const nextScale = getNextZoomScale(currentScale, direction);

        if (Math.abs(nextScale - currentScale) <= 0.001) return;

        applyZoomScale(nextScale);
    };

    const handleToolClick = (action: string, value?: string) => {
        if (!roomSession) return;

        // Tools that open another window put the menu away; zoom and room history keep it open.
        if (!action.startsWith('zoom') && !action.startsWith('room_history')) setToolsOpen(false);

        switch (action) {
            case 'achievements':
                CreateLinkEvent('questengine/achievements/wired_games');
                return;
            case 'settings':
                CreateLinkEvent('navigator/toggle-room-info');
                return;
            case 'zoom_in':
                zoomRoom(1);
                return;
            case 'zoom_out':
                zoomRoom(-1);
                return;
            case 'chat_history':
                CreateLinkEvent('chat-history/toggle');
                return;
            case 'like_room':
                if (hasLikedRoom) return;
                SendMessageComposer(new RateFlatMessageComposer(1));
                setHasLikedRoom(true);
                return;
            case 'toggle_room_link':
                CreateLinkEvent('navigator/toggle-room-link');
                return;
            case 'room_history':
                if (historyEntries.length > 1) setIsOpenHistory((prev) => !prev);
                return;
            case 'room_history_back': {
                const entry = useRoomToolsHistoryStore.getState().back();
                if (entry) TryVisitRoom(entry.roomId);
                return;
            }
            case 'room_history_next': {
                const entry = useRoomToolsHistoryStore.getState().forward();
                if (entry) TryVisitRoom(entry.roomId);
                return;
            }
        }
    };

    // RoomTools history buttons: back/forward follow the history index, the list needs more than one entry.
    const hasHistory = historyEntries.length > 1;
    const canGoBack = historyIndex > 0;
    const canGoNext = historyIndex >= 0 && historyIndex < historyEntries.length - 1;
    const roomHistory = getRoomHistoryList(historyEntries);

    useMessageEvent<GetGuestRoomResultEvent>(GetGuestRoomResultEvent, (event) => {
        const parser = event.getParser();
        if (!parser.roomEnter || parser.data.roomId !== roomSession.roomId) return;

        useRoomToolsHistoryStore.getState().visit(parser.data.roomId, parser.data.roomName);
    });

    useEffect(() => {
        setHasLikedRoom(false);
        updateZoomScale();
        setToolsOpen(false);
    }, [roomSession?.roomId]);

    // Escape or a click outside the menu and its chip closes it.
    useEffect(() => {
        if (!isToolsOpen) return;

        const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setToolsOpen(false);
        const onPointer = (event: PointerEvent) => {
            const target = event.target as Element | null;

            if (!target?.closest?.('.volt-room-tools-container, .district-location')) setToolsOpen(false);
        };

        window.addEventListener('keydown', onKey);
        window.addEventListener('pointerdown', onPointer);

        return () => {
            window.removeEventListener('keydown', onKey);
            window.removeEventListener('pointerdown', onPointer);
        };
    }, [isToolsOpen, setToolsOpen]);

    // The renderer can be zoomed from outside this toolbar (keyboard shortcuts,
    // other widgets), so resync the displayed level whenever the engine reports it.
    useVoltEvent<RoomEngineEvent>(RoomEngineEvent.ROOM_ZOOMED, (event) => {
        if (!roomSession || event.roomId !== roomSession.roomId) return;

        updateZoomScale();
    });

    const tools = [
        ...(hasWiredAchievements
            ? [{ action: 'achievements', icon: 'icon-room-achievements', label: localizeWithFallback('room.achievements.button.text', 'Achievements') }]
            : []),
        { action: 'settings', icon: 'icon-cog', label: LocalizeText('room.settings.button.text') },
        { action: 'chat_history', icon: 'icon-chat-history', label: LocalizeText('room.chathistory.button.text') },
        ...(navigatorData.canRate || hasLikedRoom
            ? [{ action: 'like_room', icon: 'icon-like-room', label: LocalizeText('room.like.button.text'), disabled: hasLikedRoom }]
            : []),
        { action: 'toggle_room_link', icon: 'icon-room-link', label: LocalizeText('navigator.embed.caption') }
    ];

    const canZoomIn = getNextZoomScale(zoomScale, 1) !== getNearestZoomScale(zoomScale);
    const canZoomOut = getNextZoomScale(zoomScale, -1) !== getNearestZoomScale(zoomScale);

    // room_tools_toolbar_xml: the window is as tall as its visible list items (zoom 30, buttons 25, history 43).
    const toolCount = tools.length + plugins.length;
    const windowHeight = 30 + toolCount * 25 + 43;
    const historyOpen = isOpenHistory && isToolsOpen;

    return (
        <div
            id="district-room-tools-menu"
            className={classNames('volt-room-tools-container district-room-tools', !isToolsOpen && 'is-collapsed')}
            style={{ '--room-tools-height': `${windowHeight}px` } as CSSProperties}
            hidden={!isToolsOpen}
        >
            <div className="volt-room-tools">
                <div className="room-tools-list">
                    <div className="room-tools-zoom-row">
                        <span className="room-tools-zoom-text">{localizeWithFallback('room.zoom.text', `Zoom ${getZoomText(zoomScale)}`, ['zoom_level'], [getZoomText(zoomScale)])}</span>
                        <button
                            className="room-tools-zoom-button room-tools-zoom-in"
                            type="button"
                            title={LocalizeText('room.zoom.zoom_in.tooltip')}
                            disabled={!canZoomIn}
                            onClick={() => handleToolClick('zoom_in')}
                        />
                        <button
                            className="room-tools-zoom-button room-tools-zoom-out"
                            type="button"
                            title={LocalizeText('room.zoom.zoom_out.tooltip')}
                            disabled={!canZoomOut}
                            onClick={() => handleToolClick('zoom_out')}
                        />
                    </div>
                    {tools.map((tool) => (
                        <div
                            key={tool.action}
                            className={classNames('room-tool-row', `room-tool-row--${tool.action}`, tool.disabled && 'is-disabled')}
                            title={tool.label}
                            onClick={() => !tool.disabled && handleToolClick(tool.action)}
                        >
                            <div className="room-tool-icon">
                                <div className={classNames('volt-icon', tool.icon)} />
                            </div>
                            <span className="room-tool-label">{tool.label}</span>
                        </div>
                    ))}
                    {plugins.map((plugin) => (
                        <div key={plugin.name} className="room-tool-row" title={plugin.label} onClick={() => plugin.onOpen()}>
                            <div className="room-tool-icon">
                                <div className={classNames('volt-icon', plugin.icon || 'icon-cog')} />
                            </div>
                            <span className="room-tool-label">{plugin.label}</span>
                        </div>
                    ))}
                    <div className="room-history-controls">
                        <div
                            className={classNames(
                                'room-history-back',
                                'volt-icon',
                                canGoBack ? 'cursor-pointer icon-room-history-back-enabled' : 'icon-room-history-back-disabled'
                            )}
                            title={LocalizeText('room.history.button.back.tooltip')}
                            onClick={() => canGoBack && handleToolClick('room_history_back')}
                        />
                        <div
                            className={classNames(
                                'room-history-open',
                                'volt-icon',
                                hasHistory ? 'cursor-pointer icon-room-history-enabled' : 'icon-room-history-disabled'
                            )}
                            title={LocalizeText('room.history.button.tooltip')}
                            onClick={() => hasHistory && handleToolClick('room_history')}
                        />
                        <div
                            className={classNames(
                                'room-history-forward',
                                'volt-icon',
                                canGoNext ? 'cursor-pointer icon-room-history-next-enabled' : 'icon-room-history-next-disabled'
                            )}
                            title={LocalizeText('room.history.button.forward.tooltip')}
                            onClick={() => canGoNext && handleToolClick('room_history_next')}
                        />
                    </div>
                </div>
            </div>
            {historyOpen && (
                <div className="volt-room-tools-history">
                    {roomHistory.map((history) => (
                        <div key={history.roomId} className="room-history-item" onClick={() => TryVisitRoom(history.roomId)}>
                            <span className="room-history-item-name">{history.roomName}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
