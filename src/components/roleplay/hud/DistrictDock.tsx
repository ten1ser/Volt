import { CreateLinkEvent } from '@volt/renderer';
import { FC } from 'react';
import { MessengerIconState } from '../../../api';
import { Permission } from '../../../api/permissions';
import { useFriends, useHasPermission, useInventoryUnseenTracker, useMessenger, useOpenIssueCount } from '../../../hooks';

// Bottom of the phone-first HUD: the chat bar with the phone button at its end. Every other tool is a phone app.
export const DistrictDock: FC<{ isInRoom: boolean }> = ({ isInRoom }) =>
{
    const { getFullCount } = useInventoryUnseenTracker();
    const { requests } = useFriends();
    const { iconState } = useMessenger();
    const isMod = useHasPermission(Permission.ModerationTool);
    const openIssues = useOpenIssueCount();
    const phoneUnread = requests.length + (iconState === MessengerIconState.UNREAD ? 1 : 0) + getFullCount + (isMod ? openIssues : 0);

    return (
        <div className={`district-bottom ${isInRoom ? '' : 'is-hotel-view'}`}>
            <div className="district-command-bar">
                {isInRoom && <div className="district-command-bar__chat"><div id="toolbar-chat-input-container" /></div>}
                <button
                    type="button"
                    className="district-command-bar__phone"
                    aria-label={phoneUnread ? `Phone, ${phoneUnread}` : 'Phone'}
                    title="Phone"
                    onClick={() => CreateLinkEvent('phone/toggle')}>
                    <span className="volt-icon icon-district-phone" aria-hidden="true" />
                    {!!phoneUnread && <b className="district-badge">{phoneUnread}</b>}
                </button>
            </div>
        </div>
    );
};
