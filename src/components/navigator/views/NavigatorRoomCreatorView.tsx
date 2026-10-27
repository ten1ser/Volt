import { CreateFlatMessageComposer, GetSessionDataManager } from '@volt/renderer';
import { FC, PointerEvent, ReactNode, RefObject, useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { CreateLinkEvent, GetConfigurationValue, IRoomModel, LocalizeText, SendMessageComposer } from '../../../api';
import scrollThumb from '../../../assets/images/habbo-skin/slices/scroll-thumb-v.png';
import scrollThumbPressed from '../../../assets/images/habbo-skin/slices/scroll-thumb-v-pressed.png';
import vipIconBig from '../../../assets/images/navigator/air/icon-vip-big.png';
import vipIconSmall from '../../../assets/images/navigator/air/icon-vip-small.png';
import popupArrowDown from '../../../assets/images/navigator/air/popup-arrow-down.png';
import selectArrow from '../../../assets/images/navigator/air/select-arrow.png';
import tileIconBlack from '../../../assets/images/navigator/air/tile-icon-black.png';
import tileIconWhite from '../../../assets/images/navigator/air/tile-icon-white.png';
import { VoltCardView } from '../../../common';
import { HabboDropMenuView } from '../../../common/dropmenu/HabboDropMenuView';
import { useNavigatorData, useNavigatorUiStore, useUserDataSnapshot } from '../../../hooks';
import { useRoomCreatorStore } from './navigatorRoomCreatorStore';

const AIR_TRADE_KEYS = ['navigator.roomsettings.trade_not_allowed', 'navigator.roomsettings.trade_not_with_Controller', 'navigator.roomsettings.trade_allowed'];

const ROOM_LIMIT_HC = 75;
const ROOM_LIMIT_NON_SUBSCRIBER = 50;

const buildVisitorOptions = (limit: number) => {
    const values: string[] = [];

    for (let value = 10; value <= limit; value += 5) values.push(String(value));

    return values;
};

// VQ._rc3630013d6f5f4: native catalogue order, independent of creatable-model packets.
const ROOM_MODELS: readonly IRoomModel[] = [
    { name: 'a', tileSize: 104, clubLevel: 0 },
    { name: 'b', tileSize: 94, clubLevel: 0 },
    { name: 'c', tileSize: 36, clubLevel: 0 },
    { name: 'd', tileSize: 84, clubLevel: 0 },
    { name: 'e', tileSize: 80, clubLevel: 0 },
    { name: 'f', tileSize: 80, clubLevel: 0 },
    { name: 'i', tileSize: 416, clubLevel: 0 },
    { name: 'j', tileSize: 320, clubLevel: 0 },
    { name: 'k', tileSize: 448, clubLevel: 0 },
    { name: 'l', tileSize: 352, clubLevel: 0 },
    { name: 'm', tileSize: 384, clubLevel: 0 },
    { name: 'n', tileSize: 372, clubLevel: 0 },
    { name: 'g', tileSize: 80, clubLevel: 1 },
    { name: 'h', tileSize: 74, clubLevel: 1 },
    { name: 'o', tileSize: 416, clubLevel: 1 },
    { name: 'p', tileSize: 352, clubLevel: 1 },
    { name: 'q', tileSize: 304, clubLevel: 1 },
    { name: 'r', tileSize: 336, clubLevel: 1 },
    { name: 'u', tileSize: 748, clubLevel: 1 },
    { name: 'v', tileSize: 438, clubLevel: 1 },
    { name: 't', tileSize: 540, clubLevel: 2 },
    { name: 'w', tileSize: 512, clubLevel: 2 },
    { name: 'x', tileSize: 396, clubLevel: 2 },
    { name: 'y', tileSize: 440, clubLevel: 2 },
    { name: 'z', tileSize: 456, clubLevel: 2 },
    { name: '0', tileSize: 208, clubLevel: 2 },
    { name: '1', tileSize: 1009, clubLevel: 2 },
    { name: '2', tileSize: 1044, clubLevel: 2 },
    { name: '3', tileSize: 183, clubLevel: 2 },
    { name: '4', tileSize: 254, clubLevel: 2 },
    { name: '5', tileSize: 1024, clubLevel: 2 },
    { name: '6', tileSize: 801, clubLevel: 2 },
    { name: '7', tileSize: 354, clubLevel: 2 },
    { name: '8', tileSize: 888, clubLevel: 2 },
    { name: '9', tileSize: 926, clubLevel: 2 },
    { name: 'snowwar1', tileSize: 2500, clubLevel: -1 },
    { name: 'snowwar2', tileSize: 2500, clubLevel: -1 }
];

const onPositionChange = (position: { x: number; y: number }) => useRoomCreatorStore.getState().setPosition(position);

// roc_create_room / Lq: 295px viewport, 16px buttons, 15px step.
const LAYOUT_HEIGHT = 295;
const TRACK_HEIGHT = LAYOUT_HEIGHT - 32;
const SCROLL_STEP = 15;

const LayoutScrollbarThumb = ({ pressed, id }: { pressed: boolean; id: string }) => {
    const image = <image href={pressed ? scrollThumbPressed : scrollThumb} width={17} height={24} />;

    return (
        <>
            <svg className="volt-room-creator-air__thumb-middle" aria-hidden="true" width="17" height="100%">
                <defs>
                    <pattern id={id + '-middle'} width="17" height="1" patternUnits="userSpaceOnUse">
                        <svg width="17" height="1" viewBox="0 2 17 1">{image}</svg>
                    </pattern>
                </defs>
                <rect width="17" height="100%" fill={'url(#' + id + '-middle)'} />
            </svg>
            <svg className="volt-room-creator-air__thumb-top" aria-hidden="true" viewBox="0 0 17 2">{image}</svg>
            <svg className="volt-room-creator-air__thumb-bottom" aria-hidden="true" viewBox="0 22 17 2">{image}</svg>
            <svg className="volt-room-creator-air__thumb-grip" aria-hidden="true" width="7" height="100%">
                <defs>
                    <pattern id={id + '-grip'} width="7" height="10" patternUnits="userSpaceOnUse">
                        <svg width="7" height="10" viewBox="5 7 7 10">{image}</svg>
                    </pattern>
                </defs>
                <rect width="7" height="100%" fill={'url(#' + id + '-grip)'} />
            </svg>
        </>
    );
};

const RoomLayoutScrollView = ({ children, viewportRef }: { children: ReactNode; viewportRef: RefObject<HTMLDivElement> }) => {
    const id = useId();
    const contentRef = useRef<HTMLDivElement>(null);
    const dragRef = useRef<{ pointerId: number; y: number; scrollTop: number }>(null);
    const [scroll, setScroll] = useState({ top: 0, height: LAYOUT_HEIGHT });
    const [dragging, setDragging] = useState(false);
    const maxScroll = Math.max(0, scroll.height - LAYOUT_HEIGHT);
    // Lq assigns a fractional height through WindowController.setRectangle (truncation).
    const thumbHeight = Math.max(12, Math.min(TRACK_HEIGHT, Math.trunc(TRACK_HEIGHT * LAYOUT_HEIGHT / scroll.height)));
    const thumbTop = maxScroll > 0 ? Math.round(scroll.top / maxScroll * (TRACK_HEIGHT - thumbHeight)) : 0;

    const updateScroll = useCallback(() => {
        const viewport = viewportRef.current;
        if (!viewport) return;
        const top = viewport.scrollTop;
        const height = viewport.scrollHeight;
        setScroll((previous) => previous.top === top && previous.height === height ? previous : { top, height });
    }, [viewportRef]);

    useLayoutEffect(() => {
        updateScroll();
        const observer = new ResizeObserver(updateScroll);
        if (contentRef.current) observer.observe(contentRef.current);
        return () => observer.disconnect();
    }, [updateScroll]);

    const scrollBy = (offset: number) => viewportRef.current?.scrollBy(0, offset);
    const stopDragging = (event: PointerEvent<HTMLDivElement>) => {
        if (dragRef.current?.pointerId !== event.pointerId) return;
        dragRef.current = null;
        setDragging(false);
    };

    return (
        <div className="volt-room-creator-air__layouts">
            <div id={id} ref={viewportRef} className="volt-room-creator-air__layout-viewport" onScroll={updateScroll}>
                <div ref={contentRef} className="volt-room-creator-air__layout-rows">{children}</div>
            </div>
            <div className="volt-room-creator-air__scrollbar" onWheel={(event) => scrollBy(event.deltaY)}>
                <button
                    type="button" className="volt-room-creator-air__scroll-up" aria-label="Scroll up" disabled={maxScroll === 0}
                    onPointerDown={(event) => { if (event.button === 0) scrollBy(-SCROLL_STEP); }}
                    onClick={(event) => { if (event.detail === 0) scrollBy(-SCROLL_STEP); }}
                />
                <div className="volt-room-creator-air__scroll-track" onPointerDown={(event) => {
                    if (maxScroll === 0 || event.button !== 0 || event.target !== event.currentTarget) return;
                    const y = event.clientY - event.currentTarget.getBoundingClientRect().top;
                    if (y < thumbTop) scrollBy(-(LAYOUT_HEIGHT - SCROLL_STEP));
                    else if (y > thumbTop + thumbHeight) scrollBy(LAYOUT_HEIGHT - SCROLL_STEP);
                }}>
                    {maxScroll > 0 && (
                        <div
                            className="volt-room-creator-air__scroll-thumb"
                            role="scrollbar" aria-orientation="vertical" aria-label={LocalizeText('navigator.createroom.chooselayoutcaption')}
                            aria-controls={id} aria-valuemin={0} aria-valuemax={maxScroll} aria-valuenow={scroll.top} tabIndex={0}
                            style={{ height: thumbHeight, top: thumbTop }}
                            onKeyDown={(event) => {
                                const viewport = viewportRef.current;
                                if (!viewport) return;
                                if (event.key === 'ArrowUp') scrollBy(-SCROLL_STEP);
                                else if (event.key === 'ArrowDown') scrollBy(SCROLL_STEP);
                                else if (event.key === 'PageUp') scrollBy(-(LAYOUT_HEIGHT - SCROLL_STEP));
                                else if (event.key === 'PageDown') scrollBy(LAYOUT_HEIGHT - SCROLL_STEP);
                                else if (event.key === 'Home') viewport.scrollTop = 0;
                                else if (event.key === 'End') viewport.scrollTop = maxScroll;
                                else return;
                                event.preventDefault();
                            }}
                            onPointerDown={(event) => {
                                if (event.button !== 0) return;
                                event.currentTarget.setPointerCapture(event.pointerId);
                                dragRef.current = { pointerId: event.pointerId, y: event.clientY, scrollTop: viewportRef.current?.scrollTop ?? 0 };
                                setDragging(true);
                            }}
                            onPointerMove={(event) => {
                                const drag = dragRef.current;
                                if (drag?.pointerId !== event.pointerId || !viewportRef.current) return;
                                viewportRef.current.scrollTop = drag.scrollTop + (event.clientY - drag.y) * maxScroll / (TRACK_HEIGHT - thumbHeight);
                            }}
                            onPointerUp={stopDragging} onPointerCancel={stopDragging} onLostPointerCapture={stopDragging}
                        >
                            <LayoutScrollbarThumb pressed={dragging} id={id} />
                        </div>
                    )}
                </div>
                <button
                    type="button" className="volt-room-creator-air__scroll-down" aria-label="Scroll down" disabled={maxScroll === 0}
                    onPointerDown={(event) => { if (event.button === 0) scrollBy(SCROLL_STEP); }}
                    onClick={(event) => { if (event.detail === 0) scrollBy(SCROLL_STEP); }}
                />
            </div>
        </div>
    );
};

export const NavigatorRoomCreatorView: FC = () => {
    const { categories } = useNavigatorData();
    const { clubLevel } = useUserDataSnapshot();
    const isCreatorOpen = useNavigatorUiStore((state) => state.isCreatorOpen);
    const canUseStaffCategories = GetSessionDataManager().hasSecurity(7);
    const { name, nameTouched, description, descriptionTouched, categoryIndex, visitorsIndex, tradeIndex, nameError, nameInvalid, selectedModelName, position, showVersion, setForm } = useRoomCreatorStore();
    const canUseSpecialModels = GetSessionDataManager().hasSecurity(4);
    const roomModels = ROOM_MODELS.filter((model) => model.clubLevel !== -1 || canUseSpecialModels);
    const selectedModel = roomModels.find((model) => model.name === selectedModelName) ?? roomModels[0];
    const layoutsRef = useRef<HTMLDivElement>(null);
    const arrowDirectionRef = useRef(true);

    useEffect(() => {
        if (!isCreatorOpen) return;
        const timer = window.setInterval(() => {
            const arrow = layoutsRef.current?.querySelector<HTMLImageElement>('.is-selected .volt-room-creator-air__select-arrow');
            if (!arrow) return;
            let y = Number.parseFloat(arrow.style.top || '0');
            const step = Math.abs(y) < 2 || Math.abs(y - 15) < 2 ? 1 : 2;
            y += arrowDirectionRef.current ? step : -step;
            if (y < 0) { arrowDirectionRef.current = true; y = 1; }
            else if (y > 15) { arrowDirectionRef.current = false; y = 14; }
            arrow.style.top = `${y}px`;
        }, 100);
        return () => window.clearInterval(timer);
    }, [isCreatorOpen, showVersion]);

    const selectableCategories = useMemo(
        () => (categories ?? []).filter((category) => category.visible && !category.automatic && (!category.staffOnly || canUseStaffCategories)),
        [categories, canUseStaffCategories]
    );

    const visitorOptions = useMemo(() => buildVisitorOptions(clubLevel >= 1 ? ROOM_LIMIT_HC : ROOM_LIMIT_NON_SUBSCRIBER), [clubLevel]);

    const safeCategoryIndex = categoryIndex < selectableCategories.length ? categoryIndex : 0;
    const safeVisitorsIndex = visitorsIndex < visitorOptions.length ? visitorsIndex : 0;

    const namePlaceholder = LocalizeText('navigator.createroom.roomnameinfo');
    const descriptionPlaceholder = LocalizeText('navigator.createroom.roomdescinfo');
    const tileSizeLabel = LocalizeText('navigator.createroom.tilesize');

    const getRoomModelImage = (modelName: string) => `${GetConfigurationValue<string>('images.url', '').replace(/\/$/, '')}/navigator/models/model_${modelName}.png`;

    const closeCreator = () => useNavigatorUiStore.getState().closeCreator();

    const selectModel = (model: IRoomModel) => {
        // Native cr.hasClub and cr.hasVip both accept clubLevel >= 1 in this build.
        if (model.clubLevel > 0 && clubLevel < 1) {
            CreateLinkEvent('habboUI/open/hccenter');
            return;
        }
        setForm({ selectedModelName: model.name });
    };

    const createRoom = () => {
        const roomName = nameTouched ? name : '';

        if (!nameTouched || roomName.replace(/^ +| +$/g, '').length <= 2) {
            setForm({ nameError: LocalizeText('navigator.createroom.nameerr'), nameInvalid: true });

            return;
        }

        setForm({ nameInvalid: false });

        const category = selectableCategories[safeCategoryIndex];

        SendMessageComposer(
            new CreateFlatMessageComposer(
                roomName,
                descriptionTouched ? description : '',
                `model_${selectedModel.name}`,
                category ? category.id : 0,
                Number(visitorOptions[safeVisitorsIndex] ?? 10),
                tradeIndex
            )
        );
    };

    const showVipPromo = clubLevel < 2 && !GetConfigurationValue<boolean>('habbo_club_buy_disabled', false);

    if (!isCreatorOpen || !position) return null;

    return (
        <VoltCardView key={showVersion} uniqueKey="navigator-room-creator" handleSelector=".volt-room-creator-air__caption" frameStyle={3} isResizable={false} dragStyle={{ filter: 'drop-shadow(2.828px 2.828px 2px rgba(0, 0, 0, 0.349))' }} initialPosition={position} unconstrainedPosition={true} onPositionChange={onPositionChange} className="volt-room-creator-air" role="dialog" aria-label={LocalizeText('navigator.createroom.title')}>
            <div className="volt-card-header-shell volt-room-creator-air__caption">
                <span className="volt-card-title volt-room-creator-air__title">{LocalizeText('navigator.createroom.title')}</span>
                <button type="button" className="volt-card-close-button volt-room-creator-air__close" aria-label={LocalizeText('generic.close')} onClick={closeCreator} />
            </div>

            <span className="volt-room-creator-air__label volt-room-creator-air__label--name">{LocalizeText('navigator.roomname')}</span>
            <div className={`volt-room-creator-air__field volt-room-creator-air__field--name${nameInvalid ? ' is-invalid' : ''}`}>
                <input
                    className="volt-room-creator-air__input"
                    maxLength={25}
                    type="text"
                    aria-label={LocalizeText('navigator.roomname')}
                    aria-invalid={nameInvalid}
                    value={nameTouched ? name : namePlaceholder.slice(0, 25)}
                    onFocus={() => {
                        if (nameTouched) return;
                        setForm({ nameTouched: true, nameInvalid: false });
                    }}
                    onChange={(event) => setForm({ name: event.target.value })}
                />
            </div>
            {nameError && (
                <div className="volt-room-creator-air__error" role="alert">
                    <div className="volt-room-creator-air__error-border">
                        <span>{nameError}</span>
                    </div>
                    <img className="volt-room-creator-air__error-arrow" src={popupArrowDown} alt="" width={11} height={11} />
                </div>
            )}

            <span className="volt-room-creator-air__label volt-room-creator-air__label--desc">{LocalizeText('navigator.roomdesc')}</span>
            <div className="volt-room-creator-air__field volt-room-creator-air__field--desc">
                <textarea
                    className="volt-room-creator-air__input volt-room-creator-air__input--multiline"
                    maxLength={128}
                    aria-label={LocalizeText('navigator.roomdesc')}
                    value={descriptionTouched ? description : descriptionPlaceholder.slice(0, 128)}
                    onFocus={() => setForm({ descriptionTouched: true })}
                    onChange={(event) => setForm({ description: event.target.value })}
                />
            </div>

            <span className="volt-room-creator-air__label volt-room-creator-air__label--category">{LocalizeText('navigator.category')}</span>
            <HabboDropMenuView
                className="volt-room-creator-air__dropmenu volt-room-creator-air__dropmenu--category"
                label={LocalizeText('navigator.category')}
                options={selectableCategories.map((category, index) => ({ value: index, label: LocalizeText(category.name) }))}
                value={safeCategoryIndex}
                onSelect={(categoryIndex) => setForm({ categoryIndex })}
            />

            <span className="volt-room-creator-air__label volt-room-creator-air__label--visitors">{LocalizeText('navigator.maxvisitors')}</span>
            <HabboDropMenuView
                className="volt-room-creator-air__dropmenu volt-room-creator-air__dropmenu--visitors"
                label={LocalizeText('navigator.maxvisitors')}
                options={visitorOptions.map((label, value) => ({ value, label }))}
                value={safeVisitorsIndex}
                onSelect={(visitorsIndex) => setForm({ visitorsIndex })}
            />

            <span className="volt-room-creator-air__label volt-room-creator-air__label--trade">{LocalizeText('navigator.tradesettings')}</span>
            <HabboDropMenuView
                className="volt-room-creator-air__dropmenu volt-room-creator-air__dropmenu--trade"
                label={LocalizeText('navigator.tradesettings')}
                options={AIR_TRADE_KEYS.map((key, value) => ({ value, label: LocalizeText(key) }))}
                value={tradeIndex}
                onSelect={(tradeIndex) => setForm({ tradeIndex })}
            />

            <button type="button" className="volt-room-creator-air__button volt-room-creator-air__button--create" onClick={createRoom}>
                {LocalizeText('navigator.createroom.create')}
            </button>
            <button type="button" className="volt-room-creator-air__button volt-room-creator-air__button--cancel" onClick={closeCreator}>
                {LocalizeText('generic.cancel')}
            </button>

            <span className="volt-room-creator-air__label volt-room-creator-air__label--layout">
                {LocalizeText('navigator.createroom.chooselayoutcaption')}
            </span>
            <RoomLayoutScrollView viewportRef={layoutsRef}>
                {roomModels.map((model) => {
                    const isSelected = selectedModel?.name === model.name;

                    return (
                        <div
                            key={model.name}
                            className={`volt-room-creator-air__thumbnail${isSelected ? ' is-selected' : ''}`}
                            role="button"
                            tabIndex={0}
                            aria-pressed={isSelected}
                            onClick={() => selectModel(model)}
                            onKeyDown={(event) => {
                                if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); selectModel(model); }
                            }}
                        >
                            <span className="volt-room-creator-air__thumbnail-bg" aria-hidden="true" />
                            <img className="volt-room-creator-air__select-arrow" src={selectArrow} alt="" width={18} height={20} />
                            <img className="volt-room-creator-air__thumbnail-pic" src={getRoomModelImage(model.name)} alt="" />
                            <img
                                className="volt-room-creator-air__thumbnail-tile-icon"
                                src={isSelected ? tileIconWhite : tileIconBlack}
                                alt=""
                                width={18}
                                height={10}
                            />
                            <span className="volt-room-creator-air__thumbnail-tiles">
                                {model.tileSize} {tileSizeLabel}
                            </span>
                            {model.clubLevel > 0 && (
                                <img className="volt-room-creator-air__thumbnail-club" src={vipIconSmall} alt="" width={19} height={10} />
                            )}
                        </div>
                    );
                })}
                {showVipPromo && (
                    <div className="volt-room-creator-air__vip-promo">
                        <img className="volt-room-creator-air__vip-promo-icon" src={vipIconBig} alt="" width={37} height={37} />
                        <span className="volt-room-creator-air__vip-promo-text">{LocalizeText('navigator.createroom.vippromo.text')}</span>
                        <button
                            type="button"
                            className="volt-room-creator-air__vip-promo-link"
                            onClick={() => CreateLinkEvent('habboUI/open/hccenter')}
                        >
                            {LocalizeText('navigator.createroom.vippromo.link')}
                        </button>
                    </div>
                )}
            </RoomLayoutScrollView>
        </VoltCardView>
    );
};
