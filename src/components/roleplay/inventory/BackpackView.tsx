import type { RpInventorySlot } from '@volt/renderer';
import { AddLinkEventTracker, ILinkEventTracker, RemoveLinkEventTracker } from '@volt/renderer';
import { useEffect, useId, useRef, useState } from 'react';
import mp5Icon from '../../../assets/images/roleplay/items/mp5.png';
import pistolIcon from '../../../assets/images/roleplay/items/pistol.png';
import vestIcon from '../../../assets/images/roleplay/items/vest.png';
import { VoltCardView } from '../../../common';
import { useRpInventory, useSelectedUserId } from '../../../hooks/roleplay/useRpInventory';
import './BackpackView.scss';

const ITEM_ICONS: Record<string, string> = { pistol: pistolIcon, mp5: mp5Icon, vest: vestIcon };
const WEAPON = 1;
const ARMOR = 2;
const BAG_SLOTS = [3, 4, 5, 6, 7, 8, 9, 10];

const describe = (slot: RpInventorySlot | undefined) =>
{
    if(!slot || !slot.key) return 'Empty slot';
    const equipped = slot.slot === 1 || slot.slot === 2;
    const hint = equipped ? 'double-click to put away' : 'drag to its slot or double-click to equip';
    if(slot.kind === WEAPON) return `Weapon · ${hint}`;
    if(slot.kind === ARMOR) return `Armor · ${slot.durability}/${slot.maxDurability} · ${hint}`;
    return 'Item';
};

export const BackpackView = () =>
{
    const windowId = useId();
    const [open, setOpen] = useState(false);
    const [selected, setSelected] = useState(1);
    const dragged = useRef(0);
    const { slots, notice, clearNotice, pendingDestroy, move, use, drop, confirmDestroy, cancelDestroy, authenticated } = useRpInventory(open);
    const targetUserId = useSelectedUserId();

    useEffect(() =>
    {
        const tracker: ILinkEventTracker = { eventUrlPrefix: 'backpack/', linkReceived: url =>
        {
            if(url === 'backpack/hide') setOpen(false);
            else if(url === 'backpack/show') setOpen(true);
            else if(url === 'backpack/toggle') setOpen(previous => !previous);
        } };
        AddLinkEventTracker(tracker);
        return () => RemoveLinkEventTracker(tracker);
    }, []);

    if(!authenticated && open) setOpen(false);
    if(!open || !authenticated) return null;

    const at = (slot: number) => slots.find(item => item.slot === slot);
    const used = slots.filter(item => item.key).length;
    const current = at(selected);

    const slotButton = (slot: number, caption?: string) =>
    {
        const item = at(slot);
        const icon = item?.key ? ITEM_ICONS[item.key] : undefined;
        return <button
            key={slot}
            type="button"
            className={`backpack-slot ${selected === slot ? 'is-selected' : ''}`}
            aria-label={`Slot ${slot}: ${item?.key ? item.name : 'empty'}`}
            aria-pressed={selected === slot}
            draggable={!!item?.key}
            onClick={() => setSelected(slot)}
            onDoubleClick={() => item?.key && use(slot)}
            onDragStart={event =>
            {
                dragged.current = slot; event.dataTransfer.setData('text/plain', String(slot));
            }}
            onDragOver={event => event.preventDefault()}
            onDrop={event =>
            {
                event.preventDefault();
                const from = dragged.current || Number(event.dataTransfer.getData('text/plain'));
                dragged.current = 0;
                if(from && from !== slot) move(from, slot);
            }}>
            <span className="backpack-number">{slot}</span>
            {item?.key && (icon ? <img className="backpack-icon" src={icon} alt="" /> : <span className="backpack-name">{item.name}</span>)}
            {item && item.quantity > 1 && <span className="backpack-quantity">x{item.quantity}</span>}
            {item?.kind === ARMOR && item.maxDurability > 0 && <span className="backpack-durability" aria-hidden="true"><span style={{ width: `${Math.round(item.durability / item.maxDurability * 100)}%` }} /></span>}
            {caption && <span className="backpack-caption">{caption}</span>}
        </button>;
    };

    return <VoltCardView theme="district" uniqueKey="district-backpack" className="district-backpack" isResizable={false} constrainToViewport>
        <div role="dialog" aria-labelledby={`${windowId}-title`} onKeyDown={event =>
        {
            if(event.key === 'Escape' && !event.defaultPrevented)
            {
                event.stopPropagation(); setOpen(false);
            }
        }}>
            <header className="backpack-titlebar drag-handler"><span id={`${windowId}-title`}>Backpack</span><button type="button" className="backpack-close" aria-label="Close Backpack" onClick={() => setOpen(false)}>×</button></header>
            <div className="backpack-body">
                <h3 className="backpack-label">Equipped</h3>
                <div className="backpack-equipped">
                    {slotButton(1, 'Weapon')}
                    {slotButton(2, 'Armor')}
                    <div className="backpack-info" role="status">
                        <strong>{current?.key ? current.name : `Slot ${selected}`}</strong>
                        <span>{describe(current)}</span>
                    </div>
                </div>
                <h3 className="backpack-label">Items</h3>
                <div className="backpack-grid">{BAG_SLOTS.map(slot => slotButton(slot))}</div>
                {notice && <p className="backpack-notice" role="alert">{notice}<button type="button" aria-label="Dismiss" onClick={clearNotice}>×</button></p>}
                {pendingDestroy && <div className="backpack-confirm" role="alertdialog" aria-label="Destroy item">
                    <span>{pendingDestroy.message}</span>
                    <button type="button" onClick={confirmDestroy}>Destroy</button>
                    <button type="button" onClick={cancelDestroy}>Cancel</button>
                </div>}
                <footer className="backpack-footer">
                    <span>{used} of 10 slots used</span>
                    <span className="backpack-actions">
                        <button type="button" disabled={!current?.key} onClick={() => use(selected)}>Use</button>
                        <button type="button" disabled={!current?.key} onClick={() => drop(selected, targetUserId)}>Drop</button>
                    </span>
                </footer>
            </div>
        </div>
    </VoltCardView>;
};
