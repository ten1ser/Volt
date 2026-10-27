import { HabbiconHubView } from './room/widgets/chat-input/HabbiconHubView';
import {
    AddLinkEventTracker,
    GetCommunication,
    GetRoomSessionManager,
    HabboWebTools,
    ILinkEventTracker,
    RemoveLinkEventTracker,
    RoomSessionEvent
} from '@volt/renderer';
import { AnimatePresence, motion } from 'framer-motion';
import { FC, useEffect, useState } from 'react';
import { NativeTextHaloFilter } from '../common';
import { useVoltEventReducer } from '../hooks';
import { AchievementsView } from './achievements/AchievementsView';
import { AvatarEditorView } from './avatar-editor';
import { BadgeLeaderboardView } from './badge-leaderboard/BadgeLeaderboardView';
import { CameraWidgetView } from './camera/CameraWidgetView';
import { CampaignView } from './campaign/CampaignView';
import { CatalogView } from './catalog/CatalogView';
import { ChatHistoryView } from './chat-history/ChatHistoryView';
import { FloorplanEditorView } from './floorplan-editor/FloorplanEditorView';
import { FriendsView } from './friends/FriendsView';
import { GameCenterView } from './game-center/GameCenterView';
import { SnowWarView } from './game-center/views/snowwar/SnowWarView';
import { GroupsView } from './groups/GroupsView';
import { BusinessView } from './roleplay/jobs/BusinessView';
import { HealOfferView } from './roleplay/jobs/HealOfferView';
import { BackpackView } from './roleplay/inventory/BackpackView';
import { GroupForumView } from './groups/views/forums/GroupForumView';
import { GuideToolView } from './guide-tool/GuideToolView';
import { HcCenterView } from './hc-center/HcCenterView';
import { HelpView } from './help/HelpView';
import { HotelView } from './hotel-view/HotelView';
import { InventoryView } from './inventory/InventoryView';
import { ModToolsView } from './mod-tools/ModToolsView';
import { NavigatorView } from './navigator/NavigatorView';
import { VoltbubbleHiddenView } from './voltbubblehidden/VoltbubbleHiddenView';
import { HabboPagesViewer } from './habbopages/HabboPagesViewer';
import { ExternalPluginLoader } from './plugins/ExternalPluginLoader';
import { DailyTasksView, QuestCompletedView, QuestsView, RewardTrackView } from './quests';
import { RightSideView } from './right-side/RightSideView';
import { RoomView } from './room/RoomView';
import { DistrictDock } from './roleplay/hud/DistrictDock';
import { DistrictHud } from './roleplay/hud/DistrictHud';
import { TraxEditorView } from './trax-editor/TraxEditorView';
import { UserProfileView } from './user-profile/UserProfileView';
import { UserSettingsView } from './user-settings/UserSettingsView';
import { VariablesExplorerView } from './variables-explorer/VariablesExplorerView';
import { VaultView } from './vault/VaultView';
import { WiredView } from './wired/WiredView';
import { WiredCreatorToolsView } from './wired-tools/WiredCreatorToolsView';

export const MainView: FC<{}> = (props) =>
{
    const [isReady, setIsReady] = useState(false);
    const [localizationVersion, setLocalizationVersion] = useState(0);

    const { landingViewVisible } = useVoltEventReducer<{ sessionId: number | null; landingViewVisible: boolean }, RoomSessionEvent>(
        [RoomSessionEvent.CREATED, RoomSessionEvent.ENDED],
        (state, event) =>
        {
            if (event.type === RoomSessionEvent.CREATED)
            {
                return { sessionId: event.session.roomId, landingViewVisible: false };
            }

            if (state.sessionId !== null && event.session.roomId !== state.sessionId)
            {
                return state;
            }

            return { sessionId: null, landingViewVisible: event.openLandingView };
        },
        { sessionId: null, landingViewVisible: true }
    );

    useEffect(() =>
    {
        setIsReady(true);

        GetRoomSessionManager().tryRestoreSession();

        GetCommunication().connection.ready();
        performance.mark('volt:hotel-ready');
    }, []);

    useEffect(() =>
    {
        const linkTracker: ILinkEventTracker = {
            linkReceived: (url: string) =>
            {
                const parts = url.split('/');

                if (parts.length < 2) return;

                switch (parts[1])
                {
                    case 'open':
                        if (parts.length > 2)
                        {
                            switch (parts[2])
                            {
                                case 'credits':
                                    //HabboWebTools.openWebPageAndMinimizeClient(this._windowManager.getProperty(ExternalVariables.WEB_SHOP_RELATIVE_URL));
                                    break;
                                default: {
                                    const name = parts[2];
                                    HabboWebTools.openHabblet(name);
                                }
                            }
                        }
                        return;
                }
            },
            eventUrlPrefix: 'habblet/'
        };

        AddLinkEventTracker(linkTracker);

        return () => RemoveLinkEventTracker(linkTracker);
    }, []);

    useEffect(() =>
    {
        const refreshLocalization = () => setLocalizationVersion((value) => value + 1);

        window.addEventListener('volt-localization-updated', refreshLocalization);

        return () => window.removeEventListener('volt-localization-updated', refreshLocalization);
    }, []);

    return (
        <>
            <div className="hidden" data-localization-version={localizationVersion} />
            <NativeTextHaloFilter />
            <DistrictHud />
            <BusinessView />
            <HealOfferView />
            <BackpackView />
            <AnimatePresence>
                {landingViewVisible && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                        <HotelView />
                    </motion.div>
                )}
            </AnimatePresence>
            <DistrictDock isInRoom={!landingViewVisible} />
            <ModToolsView />
            <WiredCreatorToolsView />
            <VariablesExplorerView />
            <RoomView />
            <ChatHistoryView />
            <WiredView />
            <AvatarEditorView />
            <BadgeLeaderboardView />
            <AchievementsView />
            <HabbiconHubView />
            <NavigatorView />
            <VoltbubbleHiddenView />
            <InventoryView />
            <CatalogView />
            <FriendsView />
            <RightSideView />
            <UserSettingsView />
            <VaultView />
            <QuestsView />
            <QuestCompletedView />
            <DailyTasksView />
            <RewardTrackView />
            <UserProfileView />
            <GroupsView />
            <GroupForumView />
            <CameraWidgetView />
            <HelpView />
            <HabboPagesViewer />
            <GuideToolView />
            <HcCenterView />
            <CampaignView />
            <GameCenterView />
            <SnowWarView />
            <FloorplanEditorView />
            <TraxEditorView />
            <ExternalPluginLoader />
        </>
    );
};
