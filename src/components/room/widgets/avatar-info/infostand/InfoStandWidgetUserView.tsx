import {
    GetSessionDataManager,
    RelationshipStatusInfoEvent,
    RelationshipStatusInfoMessageParser,
    RoomSessionFavoriteGroupUpdateEvent,
    RoomSessionUserBadgesEvent,
    RoomSessionUserFigureUpdateEvent,
    UserRelationshipsComposer
} from '@volt/renderer';
import { Dispatch, FC, FocusEvent, KeyboardEvent, SetStateAction, useCallback, useEffect, useId, useRef, useState } from 'react';
import { AvatarInfoUser, CloneObject, GetConfigurationValue, LocalizeText, SendMessageComposer } from '../../../../../api';
import pencilIcon from '../../../../../assets/images/infostand/pencil-icon.png';
import { Column, LayoutBadgeImageView, UserIdentityView } from '../../../../../common';
import { useMessageEvent, useVoltEvent, useRoom } from '../../../../../hooks';
import { usePlayerCardAffiliations } from '../../../../../hooks/roleplay/usePlayerCardAffiliations';
import { killDeathRatio } from '../../../../../hooks/roleplay/useRpProfile';
import { InfoStandAvatarView } from './InfoStandAvatarView';
import { InfoStandWidgetUserRelationshipsView } from './InfoStandWidgetUserRelationshipsView';
import { InfoStandWidgetUserTagsView } from './InfoStandWidgetUserTagsView';

const affiliationText = (name: string, badge: string, loading: boolean, unavailable: boolean, emptyLabel: string): string =>
{
    if (loading) return 'Loading';
    if (unavailable) return 'Unavailable';
    if (!name) return emptyLabel;

    return badge ? name : 'Badge unavailable';
};

const stat = (label: string, value: string | number, accent = false, title?: string) => (
    <div className="volt-infostand__stat" key={label} title={title ?? String(value)}>
        <strong className={accent ? 'is-accent' : undefined}>{value}</strong>
        <span>{label}</span>
    </div>
);

type InfoStandUserTab = 'overview' | 'stats';
type InfoStandUserStatsSection = 'combat' | 'punches';

const USER_TABS: InfoStandUserTab[] = ['overview', 'stats'];

const TAB_LABELS: Record<InfoStandUserTab, string> = { overview: 'Overview', stats: 'Stats' };

interface InfoStandWidgetUserViewProps {
    avatarInfo: AvatarInfoUser;
    setAvatarInfo: Dispatch<SetStateAction<AvatarInfoUser>>;
    onClose: () => void;
    initialTab?: InfoStandUserTab;
}

export const InfoStandWidgetUserView: FC<InfoStandWidgetUserViewProps> = (props) => {
    const { avatarInfo = null, setAvatarInfo = null, onClose = null, initialTab = 'overview' } = props;
    const [motto, setMotto] = useState<string>(null);
    const [isEditingMotto, setIsEditingMotto] = useState(false);
    const [relationships, setRelationships] = useState<RelationshipStatusInfoMessageParser>(null);
    const [tab, setTab] = useState<InfoStandUserTab>(initialTab);
    const [statsSection, setStatsSection] = useState<InfoStandUserStatsSection>('combat');
    const { roomSession = null } = useRoom();
    const affiliations = usePlayerCardAffiliations(avatarInfo?.webID ?? 0);
    const idPrefix = useId();
    const overviewTabRef = useRef<HTMLButtonElement>(null);
    const statsTabRef = useRef<HTMLButtonElement>(null);
    const tabRefs = { overview: overviewTabRef, stats: statsTabRef };

    const tabId = (value: InfoStandUserTab) => `${idPrefix}-tab-${value}`;
    const panelId = `${idPrefix}-panel`;

    const onTabKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        const currentIndex = USER_TABS.indexOf(tab);
        let nextIndex: number = -1;

        switch (event.key) {
            case 'ArrowRight':
                nextIndex = (currentIndex + 1) % USER_TABS.length;
                break;
            case 'ArrowLeft':
                nextIndex = (currentIndex - 1 + USER_TABS.length) % USER_TABS.length;
                break;
            case 'Home':
                nextIndex = 0;
                break;
            case 'End':
                nextIndex = USER_TABS.length - 1;
                break;
            default:
                return;
        }

        event.preventDefault();

        const nextTab = USER_TABS[nextIndex];

        setTab(nextTab);
        tabRefs[nextTab].current?.focus();
    };

    const saveMotto = (motto: string) => {
        if (!isEditingMotto || motto.length > GetConfigurationValue<number>('motto.max.length', 38) || !roomSession) return;

        roomSession.sendMottoMessage(motto);
        setIsEditingMotto(false);
    };

    const onMottoBlur = (event: FocusEvent<HTMLInputElement>) => saveMotto(event.target.value);

    const onMottoKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
        event.stopPropagation();

        switch (event.key) {
            case 'Enter':
                saveMotto((event.target as HTMLInputElement).value);
                return;
        }
    };

    useVoltEvent<RoomSessionUserBadgesEvent>(RoomSessionUserBadgesEvent.RSUBE_BADGES, (event) => {
        if (!avatarInfo || avatarInfo.webID !== event.userId) return;

        // Deduplicate badges from server
        const seen = new Set<string>();
        const dedupedBadges = event.badges.map((code) => {
            if (!code || seen.has(code)) return '';
            seen.add(code);
            return code;
        });

        const oldBadges = avatarInfo.badges.join('');

        if (oldBadges === dedupedBadges.join('')) return;

        setAvatarInfo((prevValue) => {
            if (!prevValue) return prevValue;

            const newValue = CloneObject(prevValue);
            newValue.badges = dedupedBadges;
            return newValue;
        });
    });

    useVoltEvent<RoomSessionUserFigureUpdateEvent>(RoomSessionUserFigureUpdateEvent.USER_FIGURE, (event) => {
        if (!avatarInfo || avatarInfo.roomIndex !== event.roomIndex) return;

        setAvatarInfo((prevValue) => {
            if (!prevValue) return prevValue;

            const newValue = CloneObject(prevValue);
            newValue.figure = event.figure;
            newValue.motto = event.customInfo;
            newValue.achievementScore = event.activityPoints;
            return newValue;
        });
    });

    useVoltEvent<RoomSessionFavoriteGroupUpdateEvent>(RoomSessionFavoriteGroupUpdateEvent.FAVOURITE_GROUP_UPDATE, (event) => {
        if (!avatarInfo || avatarInfo.roomIndex !== event.roomIndex) return;

        setAvatarInfo((prevValue) => {
            if (!prevValue) return prevValue;

            const newValue = CloneObject(prevValue);
            const clearGroup = event.status === -1 || event.habboGroupId <= 0;

            newValue.groupId = clearGroup ? -1 : event.habboGroupId;
            newValue.groupName = clearGroup ? null : event.habboGroupName;
            newValue.groupBadgeId = clearGroup ? null : GetSessionDataManager().getGroupBadge(event.habboGroupId);
            return newValue;
        });
    });

    useMessageEvent<RelationshipStatusInfoEvent>(RelationshipStatusInfoEvent, (event) => {
        const parser = event.getParser();

        if (!avatarInfo || avatarInfo.webID !== parser.userId) return;

        setRelationships(parser);
    });

    useEffect(() => {
        setIsEditingMotto(false);
        setMotto(avatarInfo.motto);

        SendMessageComposer(new UserRelationshipsComposer(avatarInfo.webID));

        return () => {
            setRelationships(null);
        };
    }, [avatarInfo]);

    useEffect(() => {
        setTab(initialTab);
        setStatsSection('combat');
    }, [avatarInfo?.webID, initialTab]);

    if (!avatarInfo) return null;

    const isOwnUser = avatarInfo.type === AvatarInfoUser.OWN_USER;
    const mottoMaxLength = GetConfigurationValue<number>('motto.max.length', 38);

    return (
        <div className="volt-infostand district-user-infostand pointer-events-auto z-30">
            <div className="volt-infostand__header">
                <button type="button" className="volt-infostand__profile-link" onClick={() => setTab('stats')}>
                    <UserIdentityView className="volt-infostand__identity" nameClassName="text-white" username={avatarInfo.name} />
                </button>
                <button type="button" className="volt-infostand__close" aria-label="Close" onClick={onClose} />
            </div>
            <div className="volt-infostand__tabs" role="tablist" aria-label="Player card" onKeyDown={onTabKeyDown}>
                {USER_TABS.map((entry) => (
                    <button
                        key={entry}
                        ref={tabRefs[entry]}
                        type="button"
                        role="tab"
                        id={tabId(entry)}
                        aria-selected={tab === entry}
                        aria-controls={panelId}
                        tabIndex={tab === entry ? 0 : -1}
                        className="volt-infostand__tab"
                        onClick={() => setTab(entry)}
                    >
                        {TAB_LABELS[entry]}
                    </button>
                ))}
            </div>
            {tab === 'overview' ? (
                <div key="overview" id={panelId} role="tabpanel" aria-labelledby={tabId('overview')} className="volt-infostand__panel">
                    <div className="volt-infostand__figure-row">
                        <button
                            type="button"
                            className="volt-infostand__avatar-well"
                            aria-label="View stats"
                            onClick={() => setTab('stats')}
                        >
                            <InfoStandAvatarView direction={4} figure={avatarInfo.figure} top={24} left={17} />
                        </button>
                        <div className="volt-infostand__badges">
                            <div
                                className="volt-infostand__affiliation"
                                role="group"
                                aria-label="Job badge"
                                aria-busy={affiliations.loading}
                                title={affiliations.job || undefined}
                            >
                                <span className="volt-infostand__affiliation-badge">
                                    {affiliations.jobBadge ? (
                                        <LayoutBadgeImageView badgeCode={affiliations.jobBadge} customTitle={affiliations.job} isGroup={true} showInfo={true} />
                                    ) : (
                                        <svg className="volt-infostand__affiliation-mark" viewBox="0 0 24 24" aria-hidden="true">
                                            <path d="M9 7V5.5A2.5 2.5 0 0 1 11.5 3h1A2.5 2.5 0 0 1 15 5.5V7M5 7h14v11H5zM5 12h14" />
                                        </svg>
                                    )}
                                </span>
                                <span className="volt-infostand__affiliation-caption">Job</span>
                                <span className="volt-infostand__affiliation-name">
                                    {affiliationText(affiliations.job, affiliations.jobBadge, affiliations.loading, affiliations.unavailable, 'No job')}
                                </span>
                            </div>
                            <div
                                className="volt-infostand__affiliation"
                                role="group"
                                aria-label="Gang badge"
                                aria-busy={affiliations.loading}
                                title={affiliations.gang || undefined}
                            >
                                <span className="volt-infostand__affiliation-badge">
                                    {affiliations.gangBadge ? (
                                        <LayoutBadgeImageView badgeCode={affiliations.gangBadge} customTitle={affiliations.gang} isGroup={true} showInfo={true} />
                                    ) : (
                                        <svg className="volt-infostand__affiliation-mark" viewBox="0 0 24 24" aria-hidden="true">
                                            <path d="M12 3l7 3v5c0 5-3.5 8-7 9-3.5-1-7-4-7-9V6z" />
                                        </svg>
                                    )}
                                </span>
                                <span className="volt-infostand__affiliation-caption">Gang</span>
                                <span className="volt-infostand__affiliation-name">
                                    {affiliationText(affiliations.gang, affiliations.gangBadge, affiliations.loading, affiliations.unavailable, 'No gang')}
                                </span>
                            </div>
                        </div>
                    </div>
                    <div className="volt-infostand__motto volt-infostand__motto--box">
                        {isOwnUser && <img src={pencilIcon} alt="" className="volt-infostand__pen" />}
                        {!isOwnUser && <span className="volt-infostand__motto-text">{motto}</span>}
                        {isOwnUser && !isEditingMotto && (
                            <button type="button" className={`volt-infostand__motto-text ${motto ? '' : 'is-placeholder'}`} onClick={() => setIsEditingMotto(true)}>
                                {motto || LocalizeText('infostand.motto.change')}
                            </button>
                        )}
                        {isOwnUser && isEditingMotto && (
                            <>
                                <input
                                    autoFocus={true}
                                    aria-label={LocalizeText('infostand.motto.change')}
                                    className="motto-input"
                                    maxLength={mottoMaxLength}
                                    type="text"
                                    value={motto}
                                    onBlur={onMottoBlur}
                                    onChange={(event) => setMotto(event.target.value)}
                                    onKeyDown={onMottoKeyDown}
                                />
                                <span className="volt-infostand__motto-count">
                                    {motto.length}/{mottoMaxLength}
                                </span>
                            </>
                        )}
                    </div>
                    {avatarInfo.carryItem > 0 && (
                        <>
                            <div className="volt-infostand__rule" />
                            <div className="volt-infostand__carry">
                                {LocalizeText('infostand.text.handitem', ['item'], [LocalizeText('handitem' + avatarInfo.carryItem)])}
                            </div>
                        </>
                    )}
                    {relationships && relationships.relationshipStatusMap.length > 0 && (
                        <>
                            <div className="volt-infostand__rule" />
                            <div className="volt-infostand__relationships">
                                <InfoStandWidgetUserRelationshipsView relationships={relationships} />
                            </div>
                        </>
                    )}
                    {GetConfigurationValue('user.tags.enabled') && (
                        <Column className="mt-1" gap={1}>
                            <InfoStandWidgetUserTagsView tags={GetSessionDataManager().tags} />
                        </Column>
                    )}
                </div>
            ) : (
                <div key="stats" id={panelId} role="tabpanel" aria-labelledby={tabId('stats')} className="volt-infostand__panel volt-infostand__panel--stats">
                    {!affiliations.loading && !affiliations.unavailable && (affiliations.rank || affiliations.job) && (
                        <p className="volt-infostand__stats-role">{[affiliations.rank, affiliations.job].filter((value) => !!value).join(' · ')}</p>
                    )}
                    {affiliations.loading || affiliations.unavailable ? (
                        <p className="volt-infostand__stats-message" role="status">
                            {affiliations.loading ? 'Loading stats' : 'Stats unavailable'}
                        </p>
                    ) : (
                        <>
                            <div className="volt-infostand__stats-toggle" role="group" aria-label="Stat group">
                                <button
                                    type="button"
                                    className="volt-infostand__stats-toggle-button"
                                    aria-pressed={statsSection === 'combat'}
                                    onClick={() => setStatsSection('combat')}
                                >
                                    Combat
                                </button>
                                <button
                                    type="button"
                                    className="volt-infostand__stats-toggle-button"
                                    aria-pressed={statsSection === 'punches'}
                                    onClick={() => setStatsSection('punches')}
                                >
                                    Punches
                                </button>
                            </div>
                            {statsSection === 'combat' ? (
                                <div className="volt-infostand__stats-grid volt-infostand__stats-grid--combat">
                                    {stat('K/D', killDeathRatio(affiliations.kills, affiliations.deaths), true, affiliations.deaths === 0 ? 'No deaths yet: K/D is the kill count' : undefined)}
                                    {stat('Kills', affiliations.kills)}
                                    {stat('Deaths', affiliations.deaths)}
                                    {stat('Jailed', affiliations.timesJailed)}
                                </div>
                            ) : (
                                <div className="volt-infostand__stats-grid volt-infostand__stats-grid--punches">
                                    {stat('Thrown', affiliations.punchesThrown)}
                                    {stat('Missed', affiliations.punchesMissed)}
                                    {stat('Received', affiliations.punchesReceived)}
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}
        </div>
    );
};
