import { InfiniteGrid } from '@layout/InfiniteGrid';
import { GetSessionDataManager, IRoomSession, RoomPreviewer, Vector3d } from '@volt/renderer';
import { FC, useEffect, useMemo, useState } from 'react';
import { FaTrashAlt } from 'react-icons/fa';
import {
    attemptItemPlacement,
    DispatchUiEvent,
    FurniCategory,
    getGroupItemKey,
    GroupItem,
    LocalizeText,
    localizeWithFallback,
    UnseenItemCategory
} from '../../../../api';
import { LayoutLimitedEditionCompactPlateView, LayoutRarityLevelView, LayoutRoomPreviewerView } from '../../../../common';
import { CatalogPostMarketplaceOfferEvent, DeleteItemConfirmEvent } from '../../../../events';
import { useInventoryFurni, useInventoryTrade, useInventoryUnseenTracker, useNotification } from '../../../../hooks';
import { VoltButton } from '../../../../layout';
import { InventoryCategoryEmptyView } from '../InventoryCategoryEmptyView';
import { furnitureDescription } from './furnitureDescription';
import { InventoryFurnitureItemView } from './InventoryFurnitureItemView';
import { offerGroupItemsToTrade } from './inventoryTradeOffer';

const attemptPlaceMarketplaceOffer = (groupItem: GroupItem) => {
    const item = groupItem.getLastItem();
    if (!item) return false;
    if (!item.sellable) return false;
    DispatchUiEvent(
        new CatalogPostMarketplaceOfferEvent(
            item,
            groupItem.items.filter((groupedItem) => groupedItem.sellable && !groupedItem.locked).map((groupedItem) => groupedItem.id)
        )
    );
};

const attemptDeleteItem = (groupItem: GroupItem) => {
    const item = groupItem.getLastItem();
    if (!item) return;
    DispatchUiEvent(new DeleteItemConfirmEvent(item, groupItem.getTotalCount()));
};

export const InventoryFurnitureView: FC<{
    roomSession: IRoomSession;
    roomPreviewer: RoomPreviewer;
    filteredGroupItems: GroupItem[];
}> = (props) => {
    const { roomSession = null, roomPreviewer = null, filteredGroupItems = [] } = props;
    const [isVisible, setIsVisible] = useState(false);
    const { groupItems = [], selectedItem = null, setSelectedItem = null, activate = null, deactivate = null } = useInventoryFurni();
    const { resetItems = null } = useInventoryUnseenTracker();
    const { isTrading = false, ownUser = null } = useInventoryTrade();
    const { simpleAlert = null } = useNotification();
    const [offerCount, setOfferCount] = useState('1');

    const [page, setPage] = useState(0);
    const pageCount = Math.floor(filteredGroupItems.length / 200) + 1;
    const currentPage = Math.min(page, pageCount - 1);

    useEffect(() => {
        setPage(0);
    }, [filteredGroupItems]);

    const tradeableCount = useMemo(() => {
        if (!selectedItem) return 0;
        return selectedItem.items.filter((item) => item.isTradable && !item.locked).length;
    }, [selectedItem]);

    const recyclableCount = useMemo(() => {
        if (!selectedItem) return 0;
        return selectedItem.items.filter((item) => item.recyclable && !item.locked).length;
    }, [selectedItem]);

    // v75 offertotrade_cnt: the amount stays within 1..tradable count of the selection.
    const [clampedFor, setClampedFor] = useState(tradeableCount);

    if (clampedFor !== tradeableCount)
    {
        setClampedFor(tradeableCount);
        setOfferCount((prevValue) => String(Math.min(Math.max(1, Number.parseInt(prevValue, 10) || 1), Math.max(1, tradeableCount))));
    }

    const attemptOffer = () =>
    {
        if (!selectedItem) return;

        const count = Math.max(1, Number.parseInt(offerCount, 10) || 1);
        const offered = offerGroupItemsToTrade(ownUser, selectedItem, count, simpleAlert);

        setOfferCount(String(offered || 1));
    };

    useEffect(() => {
        if (!selectedItem || !roomPreviewer) return;
        const furnitureItem = selectedItem.getLastItem();
        if (!furnitureItem) return;

        roomPreviewer.reset(false);

        const isRoomDecoration =
            furnitureItem.category === FurniCategory.WALL_PAPER ||
            furnitureItem.category === FurniCategory.FLOOR ||
            furnitureItem.category === FurniCategory.LANDSCAPE;

        // v75 previews furniture in its own neutral room, not the room the user is standing in.
        let floorType = '110';
        let wallType = 'default';
        let landscapeType = 'default';

        if (isRoomDecoration) {
            floorType = furnitureItem.category === FurniCategory.FLOOR ? selectedItem.stuffData.getLegacyString() : floorType;
            wallType = furnitureItem.category === FurniCategory.WALL_PAPER ? selectedItem.stuffData.getLegacyString() : wallType;
            landscapeType = furnitureItem.category === FurniCategory.LANDSCAPE ? selectedItem.stuffData.getLegacyString() : landscapeType;
            roomPreviewer.updateRoomWallsAndFloorVisibility(true, true);
            roomPreviewer.updateObjectRoom(floorType, wallType, landscapeType);
            if (furnitureItem.category === FurniCategory.LANDSCAPE) {
                const data = GetSessionDataManager().getWallItemDataByName('window_double_default');
                if (data) roomPreviewer.addWallItemIntoRoom(data.id, new Vector3d(90, 0, 0), data.customParams);
            }
            return;
        }

        roomPreviewer.updateObjectRoom(floorType, wallType, landscapeType);
        roomPreviewer.updateRoomWallsAndFloorVisibility(selectedItem.isWallItem, true);
        if (selectedItem.isWallItem) {
            roomPreviewer.addWallItemIntoRoom(selectedItem.type, new Vector3d(90), furnitureItem.stuffData.getLegacyString());
        } else {
            roomPreviewer.addFurnitureIntoRoom(selectedItem.type, new Vector3d(90), selectedItem.stuffData, furnitureItem.extra.toString());
        }
    }, [roomPreviewer, selectedItem]);

    useEffect(() => {
        if (!selectedItem || !selectedItem.hasUnseenItems) return;
        resetItems(
            UnseenItemCategory.FURNI,
            selectedItem.items.map((item) => item.id)
        );
        selectedItem.hasUnseenItems = false;
    }, [selectedItem, resetItems]);

    useEffect(() => {
        if (!isVisible) return;
        const id = activate();
        return () => deactivate(id);
    }, [isVisible, activate, deactivate]);

    useEffect(() => {
        setIsVisible(true);
        return () => setIsVisible(false);
    }, []);

    if (!groupItems || !groupItems.length) {
        return <InventoryCategoryEmptyView desc={LocalizeText('inventory.empty.desc')} title={LocalizeText('inventory.empty.title')} />;
    }

    return (
        <div className="volt-inventory-furni">
            <div className="volt-inventory-furni-grid">
                <InfiniteGrid<GroupItem>
                    squareItems
                    classicScrollbar
                    columnCount={6}
                    columnGap={2}
                    rowGap={2}
                    itemKey={getGroupItemKey}
                    itemRender={(item) => (
                        <InventoryFurnitureItemView
                            groupItem={item}
                            isActive={item === selectedItem}
                            onOffer={isTrading ? (groupItem) => offerGroupItemsToTrade(ownUser, groupItem, 1, simpleAlert) : null}
                            onSelect={setSelectedItem}
                        />
                    )}
                    items={filteredGroupItems.slice(currentPage * 200, (currentPage + 1) * 200)}
                />
                {pageCount > 1 && (
                    <div className="volt-inventory-pages">
                        {Array.from({ length: pageCount }, (_, index) => (
                            <button key={index} type="button" aria-current={index === currentPage ? 'page' : undefined} onClick={() => setPage(index)}>
                                {index}
                            </button>
                        ))}
                    </div>
                )}
            </div>
            <div className="volt-inventory-furni-preview">
                <div
                    className="volt-inventory-furni-preview-stage"
                    onPointerDown={(event) => {
                        if (event.button !== 0 || !roomSession || !selectedItem) return;
                        if ([FurniCategory.FLOOR, FurniCategory.WALL_PAPER, FurniCategory.LANDSCAPE].includes(selectedItem.category)) return;
                        attemptItemPlacement(selectedItem);
                    }}
                >
                    <LayoutRoomPreviewerView
                        fitParent
                        roomPreviewer={roomPreviewer}
                        onPreviewClick={() => {
                            if (roomSession) attemptItemPlacement(selectedItem);
                        }}
                    />
                    {selectedItem && (
                        <div className="volt-inventory-furni-status">
                            <div
                                className={`volt-inventory-furni-status-icon ${tradeableCount > 0 ? 'is-trade' : 'is-no-trade'}`}
                                title={
                                    tradeableCount > 0
                                        ? LocalizeText('inventory.furni.trading.is_tradable', ['amount'], [String(tradeableCount)])
                                        : LocalizeText('inventory.furni.trading.is_not_tradable')
                                }
                            >
                                {tradeableCount > 0 && <span className="volt-inventory-furni-status-count is-trade-count">{tradeableCount}</span>}
                            </div>
                            <div
                                className={`volt-inventory-furni-status-icon ${recyclableCount > 0 ? 'is-recycle' : 'is-no-recycle'}`}
                                title={
                                    recyclableCount > 0
                                        ? LocalizeText('inventory.furni.recycling.is_recyclable', ['amount'], [String(recyclableCount)])
                                        : LocalizeText('inventory.furni.recycling.is_not_recyclable')
                                }
                            >
                                {recyclableCount > 0 && <span className="volt-inventory-furni-status-count is-recycle-count">{recyclableCount}</span>}
                            </div>
                        </div>
                    )}
                    {selectedItem && selectedItem.stuffData.isUnique && (
                        <LayoutLimitedEditionCompactPlateView
                            className="top-2 inset-e-2"
                            position="absolute"
                            uniqueNumber={selectedItem.stuffData.uniqueNumber}
                            uniqueSeries={selectedItem.stuffData.uniqueSeries}
                        />
                    )}
                    {selectedItem && selectedItem.stuffData.rarityLevel > -1 && (
                        <LayoutRarityLevelView className="top-2 inset-e-2" level={selectedItem.stuffData.rarityLevel} position="absolute" />
                    )}
                </div>
                {selectedItem && (
                    <div className="volt-inventory-furni-details">
                        <div className="volt-inventory-furni-name">{selectedItem.name}</div>
                        <div className="volt-inventory-furni-desc">{furnitureDescription(selectedItem.description, selectedItem.getTotalCount())}</div>
                        <div className="volt-inventory-furni-actions">
                            <VoltButton
                                disabled={!roomSession || isTrading || !selectedItem.getUnlockedCount()}
                                className="volt-inventory-btn-place"
                                onClick={() => attemptItemPlacement(selectedItem)}
                            >
                                {LocalizeText('inventory.furni.placetoroom')}
                            </VoltButton>
                            <div className="volt-inventory-preview-controls">
                                <button type="button" onClick={() => roomPreviewer?.changeRoomObjectDirection()}>
                                    {localizeWithFallback('widget.furniture.button.rotate', 'Rotate')}
                                </button>
                                <button type="button" onClick={() => roomPreviewer?.changeRoomObjectState()}>
                                    {localizeWithFallback('widget.furniture.button.use', 'Use')}
                                </button>
                            </div>
                            {isTrading && (
                                <div className="volt-inventory-offer">
                                    <input
                                        className="volt-inventory-offer-count"
                                        aria-label={LocalizeText('inventory.trading.offer')}
                                        inputMode="numeric"
                                        value={offerCount}
                                        onChange={(event) => setOfferCount(event.target.value)}
                                    />
                                    <VoltButton
                                        disabled={!tradeableCount || !ownUser || ownUser.accepts}
                                        className="volt-inventory-btn-offer"
                                        onClick={attemptOffer}
                                    >
                                        {LocalizeText('inventory.trading.offer')}
                                    </VoltButton>
                                </div>
                            )}
                            {selectedItem.isSellable && !isTrading && (
                                <VoltButton className="volt-inventory-btn-sell" onClick={() => attemptPlaceMarketplaceOffer(selectedItem)}>
                                    {LocalizeText('inventory.marketplace.sell')}
                                </VoltButton>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
