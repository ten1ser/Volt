import { CreateLinkEvent, PerkEnum } from '@volt/renderer';
import { FC, MouseEvent, useEffect, useRef, useState } from 'react';
import { DispatchUiEvent, GetConfigurationValue, localizeWithFallback, MessengerIconState, OpenMessengerChat, VisitDesktop } from '../../../api';
import { Permission } from '../../../api/permissions';
import { GuideToolEvent } from '../../../events';
import { useBuildHeight, useFriends, useHasPermission, useInventoryUnseenTracker, useMessenger, useOpenIssueCount, useWiredTools } from '../../../hooks';
import { usePerkAllowed } from '../../../state/perkAllowancesStore';

type Panel = 'friends' | 'tools';
type Action = { label: string; icon: string; run: () => void; count?: number };

export const DistrictDock: FC<{ isInRoom: boolean }> = ({ isInRoom }) =>
{
    const [open, setOpen] = useState(false);
    const [panel, setPanel] = useState<Panel | null>(null);
    const dock = useRef<HTMLDivElement>(null);
    const [focusKind, setFocusKind] = useState<'first' | 'back' | 'trigger' | 'menu' | null>(null);
    const [focusRequest, setFocusRequest] = useState(0);
    const [returnTo, setReturnTo] = useState<Panel>('friends');
    const { getFullCount } = useInventoryUnseenTracker();
    const { requests } = useFriends();
    const { iconState } = useMessenger();
    const { openMonitor, showToolbarButton } = useWiredTools();
    const { available: buildHeightAvailable, toggle: toggleBuildHeight } = useBuildHeight();
    const isMod = useHasPermission(Permission.ModerationTool);
    const openIssues = useOpenIssueCount();
    const cameraAllowed = usePerkAllowed(PerkEnum.CAMERA);
    const guideAllowed = usePerkAllowed(PerkEnum.USE_GUIDE_TOOL);
    const unread = getFullCount + requests.length + (iconState === MessengerIconState.UNREAD ? 1 : 0) + (isMod ? openIssues : 0);

    useEffect(() =>
    {
        if(!open) return;
        const dismiss = (event: PointerEvent) =>
        {
            if(dock.current?.contains(event.target as Node)) return;
            setOpen(false);
            setPanel(null);
        };
        const escape = (event: KeyboardEvent) =>
        {
            if(event.key !== 'Escape') return;
            setOpen(false);
            setPanel(null);
            (document.getElementById('district-menu-button') as HTMLButtonElement | null)?.focus();
        };
        document.addEventListener('pointerdown', dismiss);
        document.addEventListener('keydown', escape);
        return () =>
        {
            document.removeEventListener('pointerdown', dismiss);
            document.removeEventListener('keydown', escape);
        };
    }, [open]);

    useEffect(() =>
    {
        if(!focusRequest) return;
        if(!open && focusKind !== 'menu') return;
        const frame = window.requestAnimationFrame(() =>
        {
            const popup = document.getElementById('district-popup');

            if(!popup) return;

            let target: Element | null = null;

            if(focusKind === 'first') target = popup.querySelector('.district-popup__grid-button');
            else if(focusKind === 'back') target = popup.querySelector('.district-subpanel:not([hidden]) .district-back');
            else if(focusKind === 'trigger') target = popup.querySelector(`[aria-controls="district-${returnTo}"]`);
            else
            {
                const active = document.activeElement;

                if(active && active !== document.body && !popup.contains(active)) return;

                target = document.getElementById('district-menu-button');
            }

            (target as HTMLElement | null)?.focus();
        });

        return () => window.cancelAnimationFrame(frame);
    }, [open, focusRequest, focusKind, returnTo]);

    const link = (url: string) => () => CreateLinkEvent(url);
    const requestFocus = (kind: 'first' | 'back' | 'trigger' | 'menu') =>
    {
        setFocusKind(kind);
        setFocusRequest(value => value + 1);
    };
    const toggleMenu = () =>
    {
        if(open)
        {
            setOpen(false);
            setPanel(null);
            return;
        }
        setOpen(true);
        setPanel(null);
        requestFocus('first');
    };
    const closeAndRun = (action: () => void) =>
    {
        setOpen(false);
        setPanel(null);
        requestFocus('menu');
        action();
    };
    const openPanel = (id: Panel) =>
    {
        setReturnTo(id);
        setOpen(true);
        setPanel(id);
        requestFocus('back');
    };
    const backToMenu = () =>
    {
        setPanel(null);
        requestFocus('trigger');
    };
    const actionButton = (action: Action) => (
        <button type="button" key={action.label} className="district-popup__action" title={action.label} onClick={() => closeAndRun(action.run)}>
            <span className={`volt-icon icon-${action.icon}`} aria-hidden="true" />
            <span>{action.label}</span>
            {!!action.count && <b className="district-badge">{action.count}</b>}
        </button>
    );
    const gridButton = (label: string, icon: string, action: (event: MouseEvent<HTMLButtonElement>) => void, options: { count?: number; expanded?: Panel } = {}) => (
        <button
            type="button"
            className="district-popup__grid-button"
            title={label}
            aria-expanded={options.expanded ? panel === options.expanded : undefined}
            aria-controls={options.expanded ? `district-${options.expanded}` : undefined}
            onClick={action}>
            <span className={`volt-icon icon-${icon}`} aria-hidden="true" />
            <span>{label}</span>
            {!!options.count && <b className="district-badge">{options.count}</b>}
        </button>
    );

    return (
        <>
            {isInRoom && <div className="district-chat"><div id="toolbar-chat-input-container" /></div>}
            <div className="district-dock" ref={dock}>
                <section id="district-popup" className="district-popup district-panel" aria-label="District menu" hidden={!open}>
                    <div className="district-popup__grid" hidden={panel !== null}>
                        {gridButton(isInRoom ? 'City' : 'Home', 'house', () => closeAndRun(isInRoom ? () => VisitDesktop() : link('navigator/goto/home')))}
                        {gridButton(localizeWithFallback('toolbar.icon.label.navigator', 'Rooms'), 'rooms', () => closeAndRun(link('navigator/toggle')))}
                        {gridButton('Inventory', 'inventory', () => closeAndRun(link('inventory/toggle')), { count: getFullCount })}
                        {gridButton('Shop', 'catalog', () => closeAndRun(link('catalog/toggle/normal')))}
                        {gridButton('Businesses', 'navigator-room-group', () => closeAndRun(link('businesses/toggle')))}
                        {gridButton('Social', 'friendall', () => openPanel('friends'), { count: requests.length + (iconState === MessengerIconState.UNREAD ? 1 : 0), expanded: 'friends' })}
                        {gridButton('Tools', 'me-settings', () => openPanel('tools'), { count: isMod ? openIssues : 0, expanded: 'tools' })}
                    </div>
                    <section id="district-friends" className="district-subpanel" aria-label="Social" hidden={panel !== 'friends'}>
                        <div className="district-subpanel__head">
                            <button type="button" className="district-back" onClick={backToMenu}>
                                <span aria-hidden="true">‹</span>
                                <span>Back to District menu</span>
                            </button>
                            <h2>Social</h2>
                        </div>
                        <div className="district-subpanel__actions">
                            {actionButton({ label: 'Friends', icon: 'friendall', run: link('friends/toggle'), count: requests.length })}
                            {actionButton({ label: 'Find people', icon: 'friendsearch', run: link('friends/search') })}
                            {iconState !== MessengerIconState.HIDDEN && actionButton({ label: 'Messages', icon: 'message', run: () => OpenMessengerChat(), count: iconState === MessengerIconState.UNREAD ? 1 : 0 })}
                        </div>
                        <div id="toolbar-friend-bar-container-desktop" className="district-friendbar" />
                    </section>
                    <section id="district-tools" className="district-subpanel" aria-label="Tools" hidden={panel !== 'tools'}>
                        <div className="district-subpanel__head">
                            <button type="button" className="district-back" onClick={backToMenu}>
                                <span aria-hidden="true">‹</span>
                                <span>Back to District menu</span>
                            </button>
                            <h2>Tools and settings</h2>
                        </div>
                        <div className="district-subpanel__actions">
                            {actionButton({ label: 'Settings', icon: 'me-settings', run: link('user-settings/show/other') })}
                            {actionButton({ label: 'Help', icon: 'me-helper-tool', run: link('help/show') })}
                            {isInRoom && cameraAllowed && actionButton({ label: 'Camera', icon: 'camera', run: link('camera/toggle') })}
                            {actionButton({ label: 'Earnings', icon: 'catalog', run: link('habboUI/open/vault') })}
                            {!GetConfigurationValue('hc.disabled', false) && actionButton({ label: 'Club', icon: 'catalogue-hc_small', run: link('habboUI/open/hccenter') })}
                            {GetConfigurationValue('games_icon_enabled', GetConfigurationValue('game.center.enabled', false)) && actionButton({ label: 'Games', icon: 'game', run: link('games/toggle') })}
                            {GetConfigurationValue('toolbar.stories.enabled', false) && actionButton({ label: 'Stories', icon: 'stories', run: link('stories/toggle') })}
                            {guideAllowed && GetConfigurationValue('guides.enabled') && actionButton({ label: 'Helper tool', icon: 'me-helper-tool', run: () => DispatchUiEvent(new GuideToolEvent(GuideToolEvent.TOGGLE_GUIDE_TOOL)) })}
                            {isInRoom && showToolbarButton && actionButton({ label: 'Wired tools', icon: 'wired-tools', run: openMonitor })}
                            {isInRoom && buildHeightAvailable && actionButton({ label: 'Build height', icon: 'buildheight', run: toggleBuildHeight })}
                            {isMod && actionButton({ label: 'Moderator tools', icon: 'modtools', run: link('mod-tools/show'), count: openIssues })}
                        </div>
                    </section>
                </section>
                <button
                    id="district-menu-button"
                    type="button"
                    className="district-menu-button"
                    aria-label={unread > 0 ? `District menu, ${unread} unread` : 'District menu'}
                    aria-expanded={open}
                    aria-controls="district-popup"
                    onClick={toggleMenu}>
                    <span className="district-menu-button__mark" aria-hidden="true">D</span>
                    {!open && unread > 0 && <b className="district-badge">{unread}</b>}
                </button>
            </div>
        </>
    );
};
