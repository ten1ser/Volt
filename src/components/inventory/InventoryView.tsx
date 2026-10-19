import {
    AddLinkEventTracker,
    BadgePointLimitsEvent,
    GetLocalizationManager,
    GetRoomEngine,
    ILinkEventTracker,
    IRoomSession,
    RemoveLinkEventTracker,
    RoomEngineObjectEvent,
    RoomEngineObjectPlacedEvent,
    RoomPreviewer,
    RoomSessionEvent
} from '@volt/renderer';
import { FC, useEffect, useMemo, useState } from 'react';
import {
    filterFurnitureGroupItems,
    FURNI_MAIN_FILTER,
    FurniMainFilter,
    isObjectMoverRequested,
    LocalizeBadgeName,
    LocalizeText,
    setObjectMoverRequested,
    UnseenItemCategory
} from '../../api';
import { VoltCardHeaderView, VoltCardTabsItemView, VoltCardTabsView, VoltCardView } from '../../common';
import {
    useInventoryBadges,
    useInventoryFurni,
    useInventoryTrade,
    useWiredTrading,
    useInventoryUnseenTracker,
    useMessageEvent,
    useVoltEvent
} from '../../hooks';
import { InventoryBadgeView } from './views/badge/InventoryBadgeView';
import { InventoryBotView } from './views/bot/InventoryBotView';
import { InventoryFurnitureDeleteView } from './views/furniture/InventoryFurnitureDeleteView';
import { InventoryFurnitureView } from './views/furniture/InventoryFurnitureView';
import { InventoryTradeView } from './views/furniture/InventoryTradeView';
import { InventoryWiredTradeView } from './views/furniture/InventoryWiredTradeView';
import { BADGE_MAIN_ACHIEVEMENTS, BADGE_MAIN_ALL, BADGE_MAIN_NORMAL, BADGE_RARITY_ALL, InventoryCategoryFilterView } from './views/InventoryCategoryFilterView';
import { InventoryPetView } from './views/pet/InventoryPetView';

const TAB_FURNITURE = 'inventory.furni';
const TAB_BOTS = 'inventory.bots';
const TAB_PETS = 'inventory.furni.tab.pets';
const TAB_BADGES = 'inventory.badges';
const TABS = [TAB_FURNITURE, TAB_PETS, TAB_BADGES, TAB_BOTS];

const TAB_LABEL_FALLBACK: Record<string, string> = {
    [TAB_FURNITURE]: 'Furniture',
    [TAB_PETS]: 'Pets',
    [TAB_BADGES]: 'Achieved badges',
    [TAB_BOTS]: 'Bots'
};

const tabLabel = (name: string) => {
    const value = LocalizeText(name);

    return value && value !== name ? value : TAB_LABEL_FALLBACK[name] || name;
};

const TAB_FONT = '12px HabboAirUbuntu, Ubuntu, sans-serif';
const TAB_PADDING = 24;

let tabMeasureContext: CanvasRenderingContext2D | null = null;

const measureTabLabel = (label: string) =>
{
    tabMeasureContext ??= document.createElement('canvas').getContext('2d');
    tabMeasureContext.font = TAB_FONT;
    tabMeasureContext.fontKerning = 'none';

    return tabMeasureContext.measureText(label).width;
};

// v75 lays the tabs out at fractional x: each tab starts on the floor of its position and the last one ends on the ceiling.
const getTabBoxes = (labels: string[]) =>
{
    const edges = [0];

    labels.forEach((label, index) => edges.push(edges[index] + measureTabLabel(label) + TAB_PADDING));

    return labels.map((_, index) =>
    {
        const left = Math.floor(edges[index]);
        const right = index === labels.length - 1 ? Math.ceil(edges[index + 1]) : Math.floor(edges[index + 1]);

        return { width: right - left };
    });
};

const TAB_BY_CODE: Record<string, string> = {
    furni: TAB_FURNITURE,
    furniture: TAB_FURNITURE,
    pets: TAB_PETS,
    badges: TAB_BADGES,
    bots: TAB_BOTS
};

const UNSEEN_BY_TAB: Record<string, number> = {
    [TAB_FURNITURE]: UnseenItemCategory.FURNI,
    [TAB_PETS]: UnseenItemCategory.PET,
    [TAB_BADGES]: UnseenItemCategory.BADGE,
    [TAB_BOTS]: UnseenItemCategory.BOT
};

// AIR 13 keeps rented furni in the furni tab, so their unseen counter lands with owned furni.
const getTabUnseenCount = (name: string, getCount: (category: number) => number) => {
    const category = UNSEEN_BY_TAB[name];
    const count = getCount(category);
    return category === UnseenItemCategory.FURNI ? count + getCount(UnseenItemCategory.RENTABLE) : count;
};

export const InventoryView: FC<{}> = () => {
    const [isVisible, setIsVisible] = useState(false);
    const [currentTab, setCurrentTab] = useState<string>(TABS[0]);
    const [roomSession, setRoomSession] = useState<IRoomSession>(null);
    const [roomPreviewer, setRoomPreviewer] = useState<RoomPreviewer>(null);
    const [searchValue, setSearchValue] = useState('');
    const [appliedSearch, setAppliedSearch] = useState('');
    const [mainFilter, setMainFilter] = useState<string>(FURNI_MAIN_FILTER.ALL);
    const [typeFilter, setTypeFilter] = useState<string>('any');
    const [, setTabFontLoaded] = useState(false);
    const { isTrading = false, stopTrading = null, ownUser = null, otherUser = null } = useInventoryTrade();
    const { isOpen: isWiredTrading = false } = useWiredTrading();
    const { getCount = null } = useInventoryUnseenTracker();
    const { groupItems = [] } = useInventoryFurni();
    const { badgeCodes = [] } = useInventoryBadges();

    useEffect(() =>
    {
        document.fonts.load(TAB_FONT).then(() => setTabFontLoaded(true));
    }, []);

    useEffect(() => {
        setSearchValue('');
        setAppliedSearch('');
        if (currentTab === TAB_BADGES) {
            setMainFilter(BADGE_MAIN_ALL);
            setTypeFilter(String(BADGE_RARITY_ALL));
        } else {
            setMainFilter(FURNI_MAIN_FILTER.ALL);
            setTypeFilter('any');
        }
    }, [currentTab]);

    useEffect(() => {
        if (currentTab !== TAB_FURNITURE) return;
        setTypeFilter('any');
    }, [mainFilter, currentTab]);

    const filteredGroupItems = useMemo(() => {
        if (currentTab !== TAB_FURNITURE) return groupItems;

        return filterFurnitureGroupItems(groupItems, appliedSearch, mainFilter as FurniMainFilter, typeFilter);
    }, [groupItems, appliedSearch, mainFilter, typeFilter, currentTab]);

    const filteredBadgeCodes = useMemo(() => {
        const comparison = appliedSearch.toLocaleLowerCase().trim();

        // Only the highest level of an achievement shows up; v75 keeps the order the badges arrived in.
        const highest: { [key: string]: number } = {};

        for (const badge of badgeCodes)
        {
            if (!badge.startsWith('ACH_')) continue;

            const name = badge.split(/[\d]+/)[0];
            const number = Number(badge.replace(name, ''));

            if (highest[name] === undefined || number > highest[name]) highest[name] = number;
        }

        return badgeCodes.filter((badge) =>
        {
            if (badge.startsWith('ACH_'))
            {
                const name = badge.split(/[\d]+/)[0];

                if (Number(badge.replace(name, '')) !== highest[name] || mainFilter === BADGE_MAIN_NORMAL) return false;
            }
            else if (mainFilter === BADGE_MAIN_ACHIEVEMENTS) return false;

            return LocalizeBadgeName(badge).toLocaleLowerCase().includes(comparison);
        });
    }, [badgeCodes, appliedSearch, mainFilter]);

    const onClose = () => {
        if (isTrading) stopTrading();
        setIsVisible(false);
    };

    useVoltEvent<RoomEngineObjectPlacedEvent>(RoomEngineObjectEvent.PLACED, (event) => {
        if (!isObjectMoverRequested()) return;
        setObjectMoverRequested(false);
        if (!event.placedInRoom) setIsVisible(true);
    });

    useVoltEvent<RoomSessionEvent>([RoomSessionEvent.CREATED, RoomSessionEvent.ENDED], (event) => {
        switch (event.type) {
            case RoomSessionEvent.CREATED:
                setRoomSession(event.session);
                return;
            case RoomSessionEvent.ENDED:
                setRoomSession(null);
                setIsVisible(false);
                return;
        }
    });

    useMessageEvent<BadgePointLimitsEvent>(BadgePointLimitsEvent, (event) => {
        const parser = event.getParser();
        for (const data of parser.data) GetLocalizationManager().setBadgePointLimit(data.badgeId, data.limit);
    });

    useEffect(() => {
        const linkTracker: ILinkEventTracker = {
            linkReceived: (url: string) => {
                const parts = url.split('/');
                if (parts.length < 2) return;

                switch (parts[1]) {
                    case 'show':
                        setIsVisible(true);
                        if (parts[2] && TAB_BY_CODE[parts[2]]) setCurrentTab(TAB_BY_CODE[parts[2]]);
                        return;
                    case 'hide':
                        setIsVisible(false);
                        return;
                    case 'toggle':
                        setIsVisible((prevValue) => !prevValue);
                        if (parts[2] && TAB_BY_CODE[parts[2]]) setCurrentTab(TAB_BY_CODE[parts[2]]);
                        return;
                }
            },
            eventUrlPrefix: 'inventory/'
        };

        AddLinkEventTracker(linkTracker);
        return () => RemoveLinkEventTracker(linkTracker);
    }, []);

    useEffect(() => {
        const previewer = new RoomPreviewer(GetRoomEngine(), ++RoomPreviewer.PREVIEW_COUNTER);
        previewer.backgroundColor = null;
        previewer.centerWallItems = true;
        setRoomPreviewer(previewer);
        return () => {
            previewer.dispose();
        };
    }, []);

    useEffect(() => {
        if (!isVisible && (isTrading || isWiredTrading)) setIsVisible(true);
    }, [isVisible, isTrading, isWiredTrading]);

    // The v75 trade table sits under the furni list items are offered from.
    const [wasTrading, setWasTrading] = useState(false);

    if (wasTrading !== isTrading)
    {
        setWasTrading(isTrading);
        if (isTrading) setCurrentTab(TAB_FURNITURE);
    }

    if (!isVisible) return null;

    const tabBoxes = getTabBoxes(TABS.map(tabLabel));
    const showWiredTrade = !isTrading && isWiredTrading;
    // v75 shrinks the trade table to a "Trade in progress" box while another tab is open.
    const isTradeMinimized = isTrading && currentTab !== TAB_FURNITURE;
    const hasCreditNote = !!ownUser?.creditsCount || !!otherUser?.creditsCount;
    const showFilter = (currentTab === TAB_FURNITURE && groupItems.length > 0) || currentTab === TAB_BADGES;

    return (
        <>
            <VoltCardView
                theme="district"
                className={`volt-inventory-window max-w-[calc(100vw-16px)] ${isTrading ? (isTradeMinimized ? 'is-trading is-minimized' : `is-trading${hasCreditNote ? ' has-credit-note' : ''}`) : ''}`}
                frameStyle={3}
                resizeAxis="vertical"
                uniqueKey="inventory"
            >
                <VoltCardHeaderView headerText={LocalizeText('inventory.title')} onCloseClick={onClose} />
                {!showWiredTrade && (
                    <>
                        <VoltCardTabsView classNames={['volt-inventory-tabs-shell']}>
                            {TABS.map((name, index) => (
                                <VoltCardTabsItemView
                                    key={name}
                                    style={tabBoxes[index]}
                                    count={getTabUnseenCount(name, getCount)}
                                    isActive={currentTab === name}
                                    onClick={() => setCurrentTab(name)}
                                >
                                    <span className="volt-inventory-tab-label">{tabLabel(name)}</span>
                                </VoltCardTabsItemView>
                            ))}
                        </VoltCardTabsView>
                        <div className="volt-inventory-body">
                            {showFilter && (
                                <InventoryCategoryFilterView
                                    currentTab={currentTab}
                                    mainFilter={mainFilter}
                                    typeFilter={typeFilter}
                                    searchValue={searchValue}
                                    onMainFilterChange={(value) => {
                                        setMainFilter(value);
                                        setAppliedSearch(searchValue);
                                    }}
                                    onTypeFilterChange={(value) => {
                                        setTypeFilter(value);
                                        setAppliedSearch(searchValue);
                                    }}
                                    onSearchChange={setSearchValue}
                                    onSearchApply={setAppliedSearch}
                                />
                            )}
                            <div className={`volt-inventory-content ${currentTab === TAB_FURNITURE ? 'is-furniture' : ''}`}>
                                {currentTab === TAB_FURNITURE && (
                                    <InventoryFurnitureView filteredGroupItems={filteredGroupItems} roomPreviewer={roomPreviewer} roomSession={roomSession} />
                                )}
                                {currentTab === TAB_PETS && <InventoryPetView roomPreviewer={roomPreviewer} roomSession={roomSession} />}
                                {currentTab === TAB_BADGES && <InventoryBadgeView filteredBadgeCodes={filteredBadgeCodes} />}
                                {currentTab === TAB_BOTS && <InventoryBotView roomPreviewer={roomPreviewer} roomSession={roomSession} />}
                            </div>
                        </div>
                    </>
                )}
                {isTrading && (
                    <div className="volt-inventory-subcontent">
                        <InventoryTradeView isMinimized={isTradeMinimized} cancelTrade={stopTrading} continueTrade={() => setCurrentTab(TAB_FURNITURE)} />
                    </div>
                )}
                {showWiredTrade && (
                    <div className="volt-inventory-body is-trade">
                        <InventoryWiredTradeView />
                    </div>
                )}
            </VoltCardView>
            <InventoryFurnitureDeleteView />
        </>
    );
};
