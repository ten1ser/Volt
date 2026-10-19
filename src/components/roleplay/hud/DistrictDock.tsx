import { CreateLinkEvent, PerkEnum } from '@volt/renderer';
import { FC, useEffect, useRef, useState } from 'react';
import { DispatchUiEvent, GetConfigurationValue, localizeWithFallback, MessengerIconState, OpenMessengerChat, VisitDesktop } from '../../../api';
import { Permission } from '../../../api/permissions';
import { GuideToolEvent } from '../../../events';
import { useBuildHeight, useFriends, useHasPermission, useInventoryUnseenTracker, useMessenger, useOpenIssueCount, useWiredTools } from '../../../hooks';
import { usePerkAllowed } from '../../../state/perkAllowancesStore';

type Panel = 'friends' | 'tools';
type Action = { label: string; icon: string; run: () => void; count?: number };

export const DistrictDock: FC<{ isInRoom: boolean }> = ({ isInRoom }) =>
{
    const [panel, setPanel] = useState<Panel | null>(null);
    const dock = useRef<HTMLDivElement>(null);
    const trigger = useRef<HTMLButtonElement>(null);
    const { getFullCount } = useInventoryUnseenTracker();
    const { requests } = useFriends();
    const { iconState } = useMessenger();
    const { openMonitor, showToolbarButton } = useWiredTools();
    const { available: buildHeightAvailable, toggle: toggleBuildHeight } = useBuildHeight();
    const isMod = useHasPermission(Permission.ModerationTool);
    const openIssues = useOpenIssueCount();
    const cameraAllowed = usePerkAllowed(PerkEnum.CAMERA);
    const guideAllowed = usePerkAllowed(PerkEnum.USE_GUIDE_TOOL);

    useEffect(() =>
    {
        if(!panel) return;
        const dismiss = (event: PointerEvent) =>
        {
            if(!dock.current?.contains(event.target as Node)) setPanel(null);
        };
        const escape = (event: KeyboardEvent) =>
        {
            if(event.key !== 'Escape') return;
            setPanel(null);
            trigger.current?.focus();
        };
        document.addEventListener('pointerdown', dismiss);
        document.addEventListener('keydown', escape);
        return () =>
        {
            document.removeEventListener('pointerdown', dismiss);
            document.removeEventListener('keydown', escape);
        };
    }, [panel]);

    const link = (url: string) => () => CreateLinkEvent(url);
    const run = (action: () => void) =>
    {
        setPanel(null);
        action();
    };
    const actionButton = (action: Action, className?: string) => (
        <button type="button" key={action.label} className={className} onClick={() => run(action.run)}>
            <span className={`volt-icon icon-${action.icon}`} aria-hidden="true" />
            <span>{action.label}</span>
            {!!action.count && <b className="district-badge">{action.count}</b>}
        </button>
    );
    const panelButton = (id: Panel, label: string, icon: string, count = 0, className?: string) => (
        <button type="button" className={className} aria-expanded={panel === id} aria-controls={`district-${id}`} onClick={event =>
        {
            trigger.current = event.currentTarget;
            setPanel(previous => previous === id ? null : id);
        }}>
            <span className={`volt-icon icon-${icon}`} aria-hidden="true" />
            <span>{label}</span>
            {count > 0 && <b className="district-badge">{count}</b>}
        </button>
    );

    return (
        <>
            {isInRoom && <div className="district-chat"><div id="toolbar-chat-input-container" /></div>}
            <div className="district-dock" ref={dock}>
                <section id="district-friends" className="district-drawer district-panel" hidden={panel !== 'friends'} aria-label="Social">
                    <h2>Social</h2>
                    <div className="district-drawer__actions">
                        {actionButton({ label: 'Friends', icon: 'friendall', run: link('friends/toggle'), count: requests.length })}
                        {actionButton({ label: 'Find people', icon: 'friendsearch', run: link('friends/search') })}
                        {actionButton({ label: 'Business/Corporation', icon: 'rooms', run: link('businesses/toggle') })}
                        {iconState !== MessengerIconState.HIDDEN && actionButton({ label: 'Messages', icon: 'message', run: () => OpenMessengerChat(), count: iconState === MessengerIconState.UNREAD ? 1 : 0 })}
                    </div>
                    <div id="toolbar-friend-bar-container-desktop" className="district-friendbar" />
                </section>
                <section id="district-tools" className="district-drawer district-panel" hidden={panel !== 'tools'} aria-label="Tools">
                    <h2>Tools & settings</h2>
                    <div className="district-drawer__actions">
                        {actionButton({ label: 'Shop', icon: 'catalog', run: link('catalog/toggle/normal') }, 'district-mobile-action')}
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
                <nav className="district-nav district-panel" aria-label="DistrictRP navigation">
                    <div className="district-nav__brand" aria-hidden="true">D<span>RP</span></div>
                    {actionButton({ label: isInRoom ? 'City' : 'Home', icon: 'house', run: isInRoom ? () => VisitDesktop() : link('navigator/goto/home') })}
                    {actionButton({ label: localizeWithFallback('toolbar.icon.label.navigator', 'Rooms'), icon: 'rooms', run: link('navigator/toggle') })}
                    {actionButton({ label: 'Inventory', icon: 'inventory', run: link('inventory/toggle'), count: getFullCount })}
                    {actionButton({ label: 'Shop', icon: 'catalog', run: link('catalog/toggle/normal') }, 'district-nav__secondary')}
                    {panelButton('friends', 'Social', 'friendall', requests.length + (iconState === MessengerIconState.UNREAD ? 1 : 0))}
                    {panelButton('tools', 'Tools', 'me-settings', isMod ? openIssues : 0)}
                </nav>
            </div>
        </>
    );
};
