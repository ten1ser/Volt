import { CreateLinkEvent } from '@volt/renderer';
import { FC } from 'react';
import { localizeWithFallback, MessengerIconState } from '../../../api';
import { Permission } from '../../../api/permissions';
import { useFriends, useHasPermission, useInventoryUnseenTracker, useMessenger, useOpenIssueCount } from '../../../hooks';
import { StatsHud } from '../stats/StatsHud';
import { TargetHud } from '../stats/TargetHud';

// Everything else (inventory, shop, social, camera, staff and building tools, settings) lives in the phone.
export const DistrictDock: FC<{ isInRoom: boolean }> = ({ isInRoom }) =>
{
    const { getFullCount } = useInventoryUnseenTracker();
    const { requests } = useFriends();
    const { iconState } = useMessenger();
    const isMod = useHasPermission(Permission.ModerationTool);
    const openIssues = useOpenIssueCount();
    const phoneUnread = requests.length + (iconState === MessengerIconState.UNREAD ? 1 : 0) + getFullCount + (isMod ? openIssues : 0);

    const link = (url: string) => () => CreateLinkEvent(url);
    const barButton = (options: { label: string; icon: string; count?: number; onClick: () => void }) => (
        <button
            type="button"
            className="district-command-bar__button"
            aria-label={options.count ? `${options.label}, ${options.count}` : options.label}
            title={options.label}
            onClick={options.onClick}>
            <span className={`volt-icon icon-${options.icon}`} aria-hidden="true" />
            {!!options.count && <b className="district-badge">{options.count}</b>}
        </button>
    );

    // Layout A: the vitals cards stand on their own at the bottom left (target above own); the dock beside them holds chat and the icons.
    return (
        <div className="district-bottom">
            <div className="district-vitals">
                <TargetHud />
                <StatsHud />
            </div>
            <div className="district-command-bar">
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
                </div>
            </div>
        </div>
    );
};
