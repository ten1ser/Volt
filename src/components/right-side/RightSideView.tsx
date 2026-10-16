import { FC } from 'react';
import { Column } from '../../common';
import { GroupRoomInformationView } from '../groups/views/GroupRoomInformationView';
import { NotificationCenterView } from '../notification-center/NotificationCenterView';
import { QuestTrackerView } from '../quests/QuestTrackerView';
import { MysteryBoxExtensionView } from '../room/widgets/mysterybox/MysteryBoxExtensionView';

export const RightSideView: FC<{}> = (props) => {
    return (
        <div className="district-context-rail">
            <Column gap={0} position="relative" alignItems="end" className="w-full gap-2">
                <QuestTrackerView />
                <GroupRoomInformationView />
                <MysteryBoxExtensionView />
                <NotificationCenterView />
            </Column>
        </div>
    );
};
