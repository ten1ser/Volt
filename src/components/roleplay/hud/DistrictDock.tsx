import { CreateLinkEvent, PerkEnum } from '@volt/renderer';
import { FC, RefObject, useEffect, useRef, useState } from 'react';
import { DispatchUiEvent, GetConfigurationValue, localizeWithFallback, MessengerIconState } from '../../../api';
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
    // City, Help, Earnings, Settings and Club were removed: Settings lives in the phone and HC is disabled hotel-wide.
    const moreCandidates: (Action | false)[] = [
        isInRoom && cameraAllowed && { label: 'Camera', icon: 'camera', run: link('camera/toggle') },
        !!GetConfigurationValue('games_icon_enabled', GetConfigurationValue('game.center.enabled', false)) && { label: 'Games', icon: 'game', run: link('games/toggle') },
        !!GetConfigurationValue('toolbar.stories.enabled', false) && { label: 'Stories', icon: 'stories', run: link('stories/toggle') },
        guideAllowed && !!GetConfigurationValue('guides.enabled') && { label: 'Helper tool', icon: 'me-helper-tool', run: () => DispatchUiEvent(new GuideToolEvent(GuideToolEvent.TOGGLE_GUIDE_TOOL)) },
        isInRoom && !!showToolbarButton && { label: 'Wired tools', icon: 'wired-tools', run: openMonitor },
        isInRoom && !!buildHeightAvailable && { label: 'Build height', icon: 'buildheight', run: toggleBuildHeight },
        isMod && { label: 'Moderator tools', icon: 'modtools', run: link('mod-tools/show'), count: openIssues }
    ];
    const moreActions = moreCandidates.filter((action): action is Action => !!action);

    if (panel && !moreActions.length) setPanel(null);
    const moreCount = isMod ? openIssues : 0;

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
                {!!moreActions.length && (
                    <button
                        type="button"
                        ref={moreButton}
                        className="district-command-bar__button"
                        aria-label={moreCount ? `More, ${moreCount}` : 'More'}
                        title="More"
                        aria-expanded={panel === 'more'}
                        aria-controls="district-more"
                        onClick={togglePanel('more')}>
                        <span className="volt-icon icon-me-settings" aria-hidden="true" />
                        {!!moreCount && <b className="district-badge">{moreCount}</b>}
                    </button>
                )}
            </div>
            <section id="district-popup" className="district-popup district-panel" aria-label="District actions" hidden={panel === null}>
                <section id="district-more" className="district-subpanel" aria-label="More" hidden={panel !== 'more'}>
                    <h2>More</h2>
                    <div className="district-subpanel__actions">{moreActions.map(actionButton)}</div>
                </section>
            </section>
        </div>
    );
};
