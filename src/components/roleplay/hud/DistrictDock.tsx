import { CreateLinkEvent, PerkEnum } from '@volt/renderer';
import { FC, RefObject, useEffect, useRef, useState } from 'react';
import { DispatchUiEvent, GetConfigurationValue, localizeWithFallback, MessengerIconState, VisitDesktop } from '../../../api';
import { Permission } from '../../../api/permissions';
import { GuideToolEvent } from '../../../events';
import { useBuildHeight, useFriends, useHasPermission, useInventoryUnseenTracker, useMessenger, useOpenIssueCount, useWiredTools } from '../../../hooks';
import { usePerkAllowed } from '../../../state/perkAllowancesStore';
import { StatsHud } from '../stats/StatsHud';
import { TargetHud } from '../stats/TargetHud';

// Inventory, Shop, Friends and Messages live in the phone; the dock keeps the RP tools, Rooms and More.
type Panel = 'more';
type Action = { label: string; icon: string; run: () => void; count?: number };

export const DistrictDock: FC<{ isInRoom: boolean }> = ({ isInRoom }) =>
{
    const [panel, setPanel] = useState<Panel | null>(null);
    const bar = useRef<HTMLDivElement>(null);
    const moreButton = useRef<HTMLButtonElement>(null);
    const { getFullCount } = useInventoryUnseenTracker();
    const { requests } = useFriends();
    const { iconState } = useMessenger();
    const { openMonitor, showToolbarButton } = useWiredTools();
    const { available: buildHeightAvailable, toggle: toggleBuildHeight } = useBuildHeight();
    const isMod = useHasPermission(Permission.ModerationTool);
    const openIssues = useOpenIssueCount();
    const cameraAllowed = usePerkAllowed(PerkEnum.CAMERA);
    const guideAllowed = usePerkAllowed(PerkEnum.USE_GUIDE_TOOL);
    const phoneUnread = requests.length + (iconState === MessengerIconState.UNREAD ? 1 : 0) + getFullCount;

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
            moreButton.current?.focus();
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
            <span className="district-command-bar__divider" aria-hidden="true" />
            {isInRoom && (
                <>
                    <div className="district-command-bar__chat"><div id="toolbar-chat-input-container" /></div>
                    <span className="district-command-bar__divider" aria-hidden="true" />
                </>
            )}
            <div className="district-command-bar__actions" role="group" aria-label="District actions">
                {barButton({ label: 'Businesses', icon: 'district-business', onClick: link('businesses/toggle') })}
                {barButton({ label: 'Backpack', icon: 'district-backpack', onClick: link('backpack/toggle') })}
                {barButton({ label: 'Phone', icon: 'district-phone', count: phoneUnread, onClick: link('phone/toggle') })}
                <span className="district-command-bar__divider" aria-hidden="true" />
                {barButton({ label: localizeWithFallback('toolbar.icon.label.navigator', 'Rooms'), icon: 'rooms', onClick: link('navigator/toggle') })}
                {barButton({ label: 'More', icon: 'me-settings', count: isMod ? openIssues : 0, expanded: 'more', buttonRef: moreButton, onClick: togglePanel('more') })}
            </div>
            <section id="district-popup" className="district-popup district-panel" aria-label="District actions" hidden={panel === null}>
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
