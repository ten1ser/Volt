import { CreateLinkEvent, PerkEnum } from '@volt/renderer';
import { FC, RefObject, useEffect, useRef, useState } from 'react';
import { DispatchUiEvent, GetConfigurationValue, localizeWithFallback, MessengerIconState, OpenMessengerChat, VisitDesktop } from '../../../api';
import { Permission } from '../../../api/permissions';
import { GuideToolEvent } from '../../../events';
import { useBuildHeight, useFriends, useHasPermission, useInventoryUnseenTracker, useMessenger, useOpenIssueCount, usePurse, useWiredTools } from '../../../hooks';
import { usePerkAllowed } from '../../../state/perkAllowancesStore';
import { StatsHud } from '../stats/StatsHud';
import { TargetHud } from '../stats/TargetHud';

type Panel = 'social' | 'more';
type Action = { label: string; icon: string; run: () => void; count?: number };

export const DistrictDock: FC<{ isInRoom: boolean }> = ({ isInRoom }) =>
{
    const [panel, setPanel] = useState<Panel | null>(null);
    const bar = useRef<HTMLDivElement>(null);
    const socialButton = useRef<HTMLButtonElement>(null);
    const moreButton = useRef<HTMLButtonElement>(null);
    const { purse } = usePurse();
    const { getFullCount } = useInventoryUnseenTracker();
    const { requests } = useFriends();
    const { iconState } = useMessenger();
    const { openMonitor, showToolbarButton } = useWiredTools();
    const { available: buildHeightAvailable, toggle: toggleBuildHeight } = useBuildHeight();
    const isMod = useHasPermission(Permission.ModerationTool);
    const openIssues = useOpenIssueCount();
    const cameraAllowed = usePerkAllowed(PerkEnum.CAMERA);
    const guideAllowed = usePerkAllowed(PerkEnum.USE_GUIDE_TOOL);
    const socialUnread = requests.length + (iconState === MessengerIconState.UNREAD ? 1 : 0);
    const coinLabel = localizeWithFallback('roleplay.currency.coins', 'RP Coins');

    useEffect(() =>
    {
        if(!panel) return;
        const dismiss = (event: PointerEvent) =>
        {
            if(bar.current?.contains(event.target as Node)) return;
            setPanel(null);
        };
        const escape = (event: KeyboardEvent) =>
        {
            if(event.key !== 'Escape') return;
            setPanel(null);
            (panel === 'social' ? socialButton : moreButton).current?.focus();
        };
        document.addEventListener('pointerdown', dismiss);
        document.addEventListener('keydown', escape);
        return () =>
        {
            document.removeEventListener('pointerdown', dismiss);
            document.removeEventListener('keydown', escape);
        };
    }, [panel]);

    useEffect(() =>
    {
        if(!panel) return;
        const frame = window.requestAnimationFrame(() =>
        {
            const popup = document.getElementById('district-popup');
            popup?.querySelector<HTMLElement>('.district-subpanel:not([hidden]) .district-popup__action')?.focus();
        });
        return () => window.cancelAnimationFrame(frame);
    }, [panel]);

    const link = (url: string) => () => CreateLinkEvent(url);
    const togglePanel = (next: Panel) => () => setPanel(current => (current === next ? null : next));
    const runAction = (action: () => void) =>
    {
        const trigger = panel ? document.querySelector<HTMLButtonElement>(`[aria-controls="district-${panel}"]`) : null;

        setPanel(null);
        trigger?.focus();
        action();
    };
    const actionButton = (action: Action) => (
        <button type="button" key={action.label} className="district-popup__action" title={action.label} onClick={() => runAction(action.run)}>
            <span className={`volt-icon icon-${action.icon}`} aria-hidden="true" />
            <span>{action.label}</span>
            {!!action.count && <b className="district-badge">{action.count}</b>}
        </button>
    );
    const barButton = (options: { label: string; icon: string; count?: number; expanded?: Panel; buttonRef?: RefObject<HTMLButtonElement>; onClick: () => void }) => (
        <button
            type="button"
            ref={options.buttonRef}
            className="district-command-bar__button"
            aria-label={options.count ? `${options.label}, ${options.count}` : options.label}
            title={options.label}
            aria-expanded={options.expanded ? panel === options.expanded : undefined}
            aria-controls={options.expanded ? `district-${options.expanded}` : undefined}
            onClick={options.onClick}>
            <span className={`volt-icon icon-${options.icon}`} aria-hidden="true" />
            {!!options.count && <b className="district-badge">{options.count}</b>}
        </button>
    );

    return (
        <div className="district-command-bar" ref={bar}>
            <div className="district-command-bar__identity">
                <TargetHud />
                <StatsHud />
            </div>
            {isInRoom && <div className="district-command-bar__chat"><div id="toolbar-chat-input-container" /></div>}
            <div className="district-command-bar__coins" aria-label={coinLabel} title={coinLabel}>
                <svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="8" /><path d="M10 5v10M7 7h5M7 10h6M8 13h5" /></svg>
                <strong>{(purse?.credits ?? 0).toLocaleString()}</strong>
                <span>{coinLabel}</span>
            </div>
            <div className="district-command-bar__actions" role="group" aria-label="District actions">
                {barButton({ label: 'Businesses', icon: 'navigator-room-group', onClick: link('businesses/toggle') })}
                {barButton({ label: 'Inventory', icon: 'inventory', count: getFullCount, onClick: link('inventory/toggle') })}
                {barButton({ label: 'Shop', icon: 'catalog', onClick: link('catalog/toggle/normal') })}
                {barButton({ label: 'Social', icon: 'friendall', count: socialUnread, expanded: 'social', buttonRef: socialButton, onClick: togglePanel('social') })}
                {barButton({ label: localizeWithFallback('toolbar.icon.label.navigator', 'Rooms'), icon: 'rooms', onClick: link('navigator/toggle') })}
                {barButton({ label: 'More', icon: 'me-settings', count: isMod ? openIssues : 0, expanded: 'more', buttonRef: moreButton, onClick: togglePanel('more') })}
            </div>
            <section id="district-popup" className="district-popup district-panel" aria-label="District actions" hidden={panel === null}>
                <section id="district-social" className="district-subpanel" aria-label="Social" hidden={panel !== 'social'}>
                    <h2>Social</h2>
                    <div className="district-subpanel__actions">
                        {actionButton({ label: 'Friends', icon: 'friendall', run: link('friends/toggle'), count: requests.length })}
                        {actionButton({ label: 'Find people', icon: 'friendsearch', run: link('friends/search') })}
                        {iconState !== MessengerIconState.HIDDEN && actionButton({ label: 'Messages', icon: 'message', run: () => OpenMessengerChat(), count: iconState === MessengerIconState.UNREAD ? 1 : 0 })}
                    </div>
                    <div id="toolbar-friend-bar-container-desktop" className="district-friendbar" />
                </section>
                <section id="district-more" className="district-subpanel" aria-label="More" hidden={panel !== 'more'}>
                    <h2>More</h2>
                    <div className="district-subpanel__actions">
                        {actionButton({ label: isInRoom ? 'City' : 'Home', icon: 'house', run: isInRoom ? () => VisitDesktop() : link('navigator/goto/home') })}
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
        </div>
    );
};
