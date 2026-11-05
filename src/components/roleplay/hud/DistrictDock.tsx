import { CreateLinkEvent } from '@volt/renderer';
import { FC, useEffect, useId, useRef, useState } from 'react';
import backpackIcon from '../../../assets/images/roleplay/dock/backpack.png';
import radioIcon from '../../../assets/images/roleplay/dock/radio.svg';
import { MessengerIconState } from '../../../api';
import { Permission } from '../../../api/permissions';
import { useFriends, useHasPermission, useInventoryUnseenTracker, useMessenger, useOpenIssueCount } from '../../../hooks';

// The phone button also anchors the hidden dock tools, without adding permanent buttons beside chat.
export const DistrictDock: FC<{ isInRoom: boolean }> = ({ isInRoom }) =>
{
    const [menuOpen, setMenuOpen] = useState(false);
    const menuId = useId();
    const tools = useRef<HTMLDivElement>(null);
    const phone = useRef<HTMLButtonElement>(null);
    const menu = useRef<HTMLDivElement>(null);
    const { getFullCount } = useInventoryUnseenTracker();
    const { requests } = useFriends();
    const { iconState } = useMessenger();
    const isMod = useHasPermission(Permission.ModerationTool);
    const openIssues = useOpenIssueCount();
    const phoneUnread = requests.length + (iconState === MessengerIconState.UNREAD ? 1 : 0) + getFullCount + (isMod ? openIssues : 0);

    useEffect(() =>
    {
        if (!menuOpen) return;
        menu.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus();
        const outside = (event: PointerEvent) =>
        {
            if (event.target instanceof Node && !tools.current?.contains(event.target)) setMenuOpen(false);
        };
        document.addEventListener('pointerdown', outside);
        return () => document.removeEventListener('pointerdown', outside);
    }, [menuOpen]);

    return (
        <div className={`district-bottom ${isInRoom ? '' : 'is-hotel-view'} ${menuOpen ? 'has-dock-menu' : ''}`}>
            <div className="district-command-bar">
                {isInRoom && <div className="district-command-bar__chat"><div id="toolbar-chat-input-container" /></div>}
                <div className="district-command-bar__tools" ref={tools}>
                <button
                    ref={phone}
                    type="button"
                    className="district-command-bar__phone"
                    aria-label={phoneUnread ? `Phone, ${phoneUnread}` : 'Phone'}
                    title="Phone (Alt+P) · Right-click for dock tools"
                    aria-haspopup="menu"
                    aria-expanded={menuOpen}
                    aria-controls={menuOpen ? menuId : undefined}
                    aria-description="Click to open the phone. Right-click or press Shift+F10 for dock tools."
                    onContextMenu={event => { event.preventDefault(); event.stopPropagation(); setMenuOpen(true); }}
                    onKeyDown={event =>
                    {
                        if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10') || event.key === 'ArrowUp')
                        {
                            event.preventDefault(); event.stopPropagation(); setMenuOpen(true);
                        }
                    }}
                    onClick={() => { setMenuOpen(false); CreateLinkEvent('phone/toggle'); }}>
                    <span className="volt-icon icon-district-phone" aria-hidden="true" />
                    {!!phoneUnread && <b className="district-badge">{phoneUnread}</b>}
                </button>
                <div id={menuId} ref={menu} className={`district-dock-menu ${menuOpen ? 'is-open' : ''}`} role="menu" aria-label="Dock tools" aria-orientation="horizontal" aria-hidden={!menuOpen} inert={!menuOpen}
                    onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setMenuOpen(false); }}
                    onKeyDown={event =>
                    {
                        if (event.key === 'Escape')
                        {
                            event.preventDefault(); event.stopPropagation(); setMenuOpen(false); phone.current?.focus();
                        }
                        else if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key))
                        {
                            event.preventDefault();
                            const items = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="menuitem"]'));
                            const current = items.indexOf(document.activeElement as HTMLButtonElement);
                            const index = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : (current + (['ArrowDown', 'ArrowRight'].includes(event.key) ? 1 : -1) + items.length) % items.length;
                            items[index]?.focus();
                        }
                    }}>
                    <button type="button" role="menuitem" className="district-dock-menu__bubble is-bag" title="Bag (Alt+B)" onClick={() =>
                    {
                        setMenuOpen(false); phone.current?.focus();
                        CreateLinkEvent('phone/hide'); CreateLinkEvent('backpack/show');
                    }}><img src={backpackIcon} alt="" draggable={false} /><span>Bag</span></button>
                    <button type="button" role="menuitem" className="district-dock-menu__bubble is-radio" title="Radio (Alt+R)"
                        onClick={() =>
                        {
                            setMenuOpen(false); phone.current?.focus();
                            CreateLinkEvent('phone/hide'); CreateLinkEvent('radio/show');
                        }}>
                        <img src={radioIcon} alt="" width={24} height={34} draggable={false} /><span>Radio</span>
                    </button>
                </div>
                </div>
            </div>
        </div>
    );
};
