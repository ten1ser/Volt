import { FC } from 'react';
import { Column } from '../../common';
import { NotificationCenterView } from '../notification-center/NotificationCenterView';
import { QuestTrackerView } from '../quests/QuestTrackerView';
import { MysteryBoxExtensionView } from '../room/widgets/mysterybox/MysteryBoxExtensionView';

export const RightSideView: FC<{}> = (props) => {
    return (
        <div className="district-context-rail">
            <Column gap={0} position="relative" alignItems="end" className="w-full gap-2">
                <QuestTrackerView />
                {/* DistrictRP hides the native group homeroom card; groups are reached through the phone's Gang and Businesses apps. */}
                <MysteryBoxExtensionView />
                <NotificationCenterView />
            </Column>
        </div>
    );
};
