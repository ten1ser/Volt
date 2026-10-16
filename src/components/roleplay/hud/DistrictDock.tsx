import { CreateLinkEvent, PerkEnum } from '@volt/renderer';
import { FC, useEffect, useRef, useState } from 'react';
import { DispatchUiEvent, GetConfigurationValue, GetUserProfile, localizeWithFallback, MessengerIconState, OpenMessengerChat, VisitDesktop } from '../../../api';
import { Permission } from '../../../api/permissions';
import { GuideToolEvent } from '../../../events';
import { useAchievements, useBuildHeight, useDailyTasks, useFriends, useHasPermission, useInventoryUnseenTracker, useMessenger, useOpenIssueCount, useRewardTracks, useWiredTools } from '../../../hooks';
import { useUserDataSnapshot } from '../../../hooks/session/useSessionSnapshots';
import { useGroupForumUnreadStore } from '../../../state/groupForumUnreadStore';
import { usePerkAllowed } from '../../../state/perkAllowancesStore';

type Panel = 'character' | 'progress' | 'friends' | 'tools';
type Action = { label: string; icon: string; run: () => void; count?: number };

export const DistrictDock: FC<{ isInRoom: boolean }> = ({ isInRoom }) =>
{
    const [panel, setPanel] = useState<Panel | null>(null);
    const dock = useRef<HTMLDivElement>(null);
    const trigger = useRef<HTMLButtonElement>(null);
    const { userId } = useUserDataSnapshot();
    const { getFullCount } = useInventoryUnseenTracker();
    const { getTotalUnseen } = useAchievements();
    const { unseenCount: dailyCount } = useDailyTasks();
    const { unseenCount: rewardCount } = useRewardTracks();
    const { requests } = useFriends();
    const { iconState } = useMessenger();
    const { openMonitor, showToolbarButton } = useWiredTools();
    const { available: buildHeightAvailable, toggle: toggleBuildHeight } = useBuildHeight();
    const isMod = useHasPermission(Permission.ModerationTool);
    const openIssues = useOpenIssueCount();
    const cameraAllowed = usePerkAllowed(PerkEnum.CAMERA);
    const guideAllowed = usePerkAllowed(PerkEnum.USE_GUIDE_TOOL);
    const forumCount = useGroupForumUnreadStore(state => state.unreadForumsCount);
    const progressCount = getTotalUnseen + dailyCount + rewardCount;

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
                <section id="district-character" className="district-drawer district-panel" hidden={panel !== 'character'} aria-label="Character">
                    <h2>Character</h2>
                    <div className="district-drawer__actions">
                        {actionButton({ label: 'My profile', icon: 'me-profile', run: () => GetUserProfile(userId) })}
                        {actionButton({ label: 'Change appearance', icon: 'me-clothing', run: link('avatar-editor/show') })}
                        {actionButton({ label: 'My rooms', icon: 'me-rooms', run: link('navigator/search/myworld_view') })}
                        {actionButton({ label: 'Forums', icon: 'me-forums', run: link('groupforum/list/my'), count: forumCount })}
                    </div>
                </section>
                <section id="district-progress" className="district-drawer district-panel" hidden={panel !== 'progress'} aria-label="Progress">
                    <h2>Progress</h2>
                    <div className="district-drawer__actions">
                        {actionButton({ label: 'Achievements', icon: 'me-achievements', run: link('achievements/toggle'), count: getTotalUnseen })}
                        {GetConfigurationValue('dailytasks.enabled') && actionButton({ label: 'Daily tasks', icon: 'me-dailytasks', run: link('dailytasks/open'), count: dailyCount })}
                        {!GetConfigurationValue('toolbar.hide.quests') && actionButton({ label: 'Quests', icon: 'me-quests', run: link('quests/toggle') })}
                        {actionButton({ label: 'Rewards', icon: 'me-rewardtrack', run: link('reward_track/open/introduction'), count: rewardCount })}
                        {actionButton({ label: 'Leaderboards', icon: 'progression-leaderboards', run: link('badge-leaderboard/show') })}
                    </div>
                </section>
                <section id="district-friends" className="district-drawer district-panel" hidden={panel !== 'friends'} aria-label="Social">
                    <h2>Social</h2>
                    <div className="district-drawer__actions">
                        {actionButton({ label: 'Friends', icon: 'friendall', run: link('friends/toggle'), count: requests.length })}
                        {actionButton({ label: 'Find people', icon: 'friendsearch', run: link('friends/search') })}
                        {iconState !== MessengerIconState.HIDDEN && actionButton({ label: 'Messages', icon: 'message', run: () => OpenMessengerChat(), count: iconState === MessengerIconState.UNREAD ? 1 : 0 })}
                    </div>
                    <div id="toolbar-friend-bar-container-desktop" className="district-friendbar" />
                </section>
                <section id="district-tools" className="district-drawer district-panel" hidden={panel !== 'tools'} aria-label="Tools">
                    <h2>Tools & settings</h2>
                    <div className="district-drawer__actions">
                        {actionButton({ label: 'Shop', icon: 'catalog', run: link('catalog/toggle/normal') }, 'district-mobile-action')}
                        {actionButton({ label: 'Progress', icon: 'progression', run: () => setPanel('progress'), count: progressCount }, 'district-mobile-action')}
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
                    {panelButton('character', 'Character', 'me-profile', forumCount)}
                    {panelButton('friends', 'Social', 'friendall', requests.length + (iconState === MessengerIconState.UNREAD ? 1 : 0))}
                    {panelButton('progress', 'Progress', 'progression', progressCount, 'district-nav__secondary')}
                    {panelButton('tools', 'Tools', 'me-settings', isMod ? openIssues : 0)}
                </nav>
            </div>
        </>
    );
};
