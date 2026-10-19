import {
    AddLinkEventTracker,
    GetSessionDataManager,
    GroupAdminGiveComposer,
    GroupAdminTakeComposer,
    GroupConfirmMemberRemoveEvent,
    GroupInformationComposer,
    GroupInformationEvent,
    GroupMemberParser,
    GroupMembersComposer,
    GroupMembersEvent,
    GroupMembershipAcceptComposer,
    GroupMembershipDeclineComposer,
    GroupMembersParser,
    GroupMembersRefreshEvent,
    GroupMemberUpdateEvent,
    GroupRank,
    GroupRemoveMemberComposer,
    HabboGroupDeactivatedMessageEvent,
    ILinkEventTracker,
    RemoveLinkEventTracker
} from '@volt/renderer';
import { FC, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { FaChevronLeft, FaChevronRight } from 'react-icons/fa';
import { GetUserProfile, LocalizeText, SendMessageComposer } from '../../../api';
import {
    Button,
    Column,
    Flex,
    Grid,
    LayoutAvatarImageView,
    LayoutBadgeImageView,
    VoltCardContentView,
    VoltCardHeaderView,
    VoltCardView,
    Text
} from '../../../common';
import { useGroupMemberRemoval, useMessageEvent, useNotification } from '../../../hooks';
import { classNames } from '../../../layout';

export const GroupMembersView: FC = () =>
{
    const [groupId, setGroupId] = useState<number>(-1);
    const [levelId, setLevelId] = useState<number>(-1);
    const [membersData, setMembersData] = useState<GroupMembersParser>(null);
    const [pageId, setPageId] = useState<number>(-1);
    const [totalPages, setTotalPages] = useState<number>(0);
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [isOwner, setIsOwner] = useState(false);
    const pendingRemoval = useRef<{ groupId: number; userId: number; name: string }>(null);
    const { showConfirm = null } = useNotification();
    const { request: requestMemberRemoval, claimReply, isCurrentSession } = useGroupMemberRemoval();
    const groupIdRef = useRef<number>(-1);

    // Read by the removal confirmation callback; refreshed before it can run.
    useLayoutEffect(() =>
    {
        groupIdRef.current = groupId;
    });

    const pendingActionsRef = useRef<Set<string>>(new Set());

    const getRankDescription = (member: GroupMemberParser) =>
    {
        if (member.rank === GroupRank.OWNER) return 'group.members.owner';

        if (isOwner)
        {
            if (member.rank === GroupRank.ADMIN) return 'group.members.removerights';

            if (member.rank === GroupRank.MEMBER) return 'group.members.giverights';
        }

        return '';
    };

    const refreshMembers = useCallback(() =>
    {
        if (groupId === -1 || levelId === -1 || pageId === -1) return;

        SendMessageComposer(new GroupMembersComposer(groupId, pageId, searchQuery, levelId));
    }, [groupId, levelId, pageId, searchQuery]);

    const toggleAdmin = (member: GroupMemberParser) =>
    {
        if (!isOwner || member.rank === GroupRank.OWNER) return;

        const key = `admin_${member.id}`;
        if (pendingActionsRef.current.has(key)) return;
        pendingActionsRef.current.add(key);
        setTimeout(() => pendingActionsRef.current.delete(key), 2000);

        if (member.rank !== GroupRank.ADMIN) SendMessageComposer(new GroupAdminGiveComposer(membersData.groupId, member.id));
        else SendMessageComposer(new GroupAdminTakeComposer(membersData.groupId, member.id));
    };

    const acceptMembership = (member: GroupMemberParser) =>
    {
        if (!membersData.admin || member.rank !== GroupRank.REQUESTED) return;

        const key = `accept_${member.id}`;
        if (pendingActionsRef.current.has(key)) return;
        pendingActionsRef.current.add(key);
        setTimeout(() => pendingActionsRef.current.delete(key), 2000);

        SendMessageComposer(new GroupMembershipAcceptComposer(membersData.groupId, member.id));
    };

    // The server answers a removal request only for these members: never the owner or oneself, and an administrator only when the owner asks.
    const canRemoveMember = (member: GroupMemberParser) => !!membersData?.admin && member.rank !== GroupRank.OWNER && member.id !== GetSessionDataManager().userId && (member.rank !== GroupRank.ADMIN || isOwner);

    const removeMemberOrDeclineMembership = (member: GroupMemberParser) =>
    {
        if (!canRemoveMember(member)) return;

        const key = `remove_${member.id}`;
        if (pendingActionsRef.current.has(key)) return;
        pendingActionsRef.current.add(key);
        setTimeout(() => pendingActionsRef.current.delete(key), 2000);

        if (member.rank === GroupRank.REQUESTED)
        {
            SendMessageComposer(new GroupMembershipDeclineComposer(membersData.groupId, member.id));

            return;
        }

        // One outstanding GroupConfirmRemoveMember for all group windows; when another is still unresolved nothing is sent.
        if (requestMemberRemoval(membersData.groupId, member.id)) pendingRemoval.current = { groupId: membersData.groupId, userId: member.id, name: member.name };
    };

    useMessageEvent<GroupMembersEvent>(GroupMembersEvent, (event) =>
    {
        const parser = event.getParser();
        const normalizedLevel = !parser.admin && levelId >= 2 && parser.level === 0;

        if (parser.groupId !== groupId || parser.query !== searchQuery || parser.pageIndex !== pageId) return;
        if (parser.level !== levelId && !normalizedLevel) return;

        setMembersData(parser);
        setLevelId(parser.level);
        setTotalPages(Math.ceil(parser.totalMembersCount / parser.pageSize));
    });

    useMessageEvent<GroupInformationEvent>(GroupInformationEvent, (event) =>
    {
        const parser = event.getParser();
        if (parser.id === groupId) setIsOwner(parser.isOwner);
    });

    useMessageEvent<GroupMemberUpdateEvent>(GroupMemberUpdateEvent, (event) =>
    {
        if (event.getParser().groupId !== groupId) return;

        refreshMembers();
    });

    useMessageEvent<GroupMembersRefreshEvent>(GroupMembersRefreshEvent, (event) =>
    {
        if (event.getParser().groupId !== groupId) return;

        refreshMembers();
    });

    useMessageEvent<GroupConfirmMemberRemoveEvent>(GroupConfirmMemberRemoveEvent, (event) =>
    {
        const parser = event.getParser();
        const owned = claimReply(parser.userId);
        const removal = pendingRemoval.current;

        if (!owned || !removal || removal.groupId !== owned.groupId || removal.groupId !== groupId || removal.userId !== owned.userId) return;

        pendingRemoval.current = null;

        let isSent = false;

        showConfirm(
            LocalizeText(
                parser.furnitureCount > 0 ? 'group.kickconfirm.desc' : 'group.kickconfirm_nofurni.desc',
                ['user', 'amount'],
                [removal.name, parser.furnitureCount.toString()]
            ),
            () =>
            {
                // Valid only while this window still shows that group for the same signed-in user.
                if (isSent || removal.groupId !== groupIdRef.current || !isCurrentSession(owned)) return;

                isSent = true;
                SendMessageComposer(new GroupRemoveMemberComposer(removal.groupId, removal.userId));
            },
            null
        );
    });

    useMessageEvent<HabboGroupDeactivatedMessageEvent>(HabboGroupDeactivatedMessageEvent, (event) =>
    {
        if (event.getParser().groupId === groupId) setGroupId(-1);
    });

    useEffect(() =>
    {
        const linkTracker: ILinkEventTracker = {
            linkReceived: (url: string) =>
            {
                const parts = url.split('/');

                if (parts.length < 2) return;

                const groupId = parseInt(parts[1]) || -1;
                const levelId = Number.isInteger(parseInt(parts[2])) ? parseInt(parts[2]) : 0;

                setGroupId(groupId);
                setLevelId(levelId);
                setPageId(0);
            },
            eventUrlPrefix: 'group-members/'
        };

        AddLinkEventTracker(linkTracker);

        return () => RemoveLinkEventTracker(linkTracker);
    }, []);

    useEffect(() =>
    {
        setPageId(0);
    }, [groupId, levelId, searchQuery]);

    useEffect(() =>
    {
        if (groupId === -1 || levelId === -1 || pageId === -1) return;

        SendMessageComposer(new GroupMembersComposer(groupId, pageId, searchQuery, levelId));
    }, [groupId, levelId, pageId, searchQuery]);

    useEffect(() =>
    {
        pendingRemoval.current = null;

        if (groupId === -1) return;

        setMembersData(null);
        setTotalPages(0);
        setSearchQuery('');
        setIsOwner(false);
        SendMessageComposer(new GroupInformationComposer(groupId, false));
    }, [groupId]);

    if (groupId === -1 || !membersData) return null;

    return (
        <VoltCardView className="volt-groups-window volt-group-members" theme="district" isResizable={false}>
            <VoltCardHeaderView
                headerText={LocalizeText('group.members.title', ['groupName'], [membersData ? membersData.groupTitle : ''])}
                onCloseClick={(event) => setGroupId(-1)}
            />
            <VoltCardContentView className="volt-groups-content" overflow="hidden">
                <div className="district-members-summary">
                    <LayoutBadgeImageView badgeCode={membersData.badge} isGroup={true} />
                    <div><h2>{membersData.groupTitle}</h2><p>{membersData.totalMembersCount} members</p></div>
                </div>
                <div className="volt-group-members-search flex gap-2">
                    <input
                        className="district-member-search"
                        aria-label="Search group members"
                        placeholder={LocalizeText('group.members.searchinfo')}
                        type="text"
                        value={searchQuery}
                        onChange={(event) => setSearchQuery(event.target.value)}
                    />
                    <select aria-label="Filter group members" className="district-member-filter" value={levelId} onChange={(event) => setLevelId(parseInt(event.target.value))}>
                        <option value="0">{LocalizeText('group.members.search.all')}</option>
                        <option value="1">{LocalizeText('group.members.search.admins')}</option>
                        {membersData.admin && <option value="2">{LocalizeText('group.members.search.pending')}</option>}
                    </select>
                </div>
                <Grid className="volt-group-members-list-grid" columnCount={2} overflow="auto">
                    {!membersData.result.length && <p className="district-members-empty">No matching members. Try another name or filter.</p>}
                    {membersData.result.map((member, index) =>
                    {
                        return (
                            <Flex key={index} alignItems="center" className="volt-group-member-row" gap={0} overflow="hidden">
                                <div className="volt-group-member-row__avatar cursor-pointer" onClick={() => GetUserProfile(member.id)}>
                                    <LayoutAvatarImageView
                                        className="volt-group-member-row__head"
                                        direction={2}
                                        figure={member.figure}
                                        headOnly={true}
                                        compactHead
                                        compactHeadSize={40}
                                        compactHeadPadding={0}
                                    />
                                </div>
                                <Column className="volt-group-member-row__copy" grow gap={0}>
                                    <Text bold pointer small className="volt-group-member-row__name" onClick={(event) => GetUserProfile(member.id)}>
                                        {member.name}
                                    </Text>
                                    <span className="district-member-rank">{member.rank === GroupRank.OWNER ? 'Owner' : member.rank === GroupRank.ADMIN ? 'Administrator' : member.rank === GroupRank.REQUESTED ? 'Membership requested' : 'Member'}</span>
                                    {member.rank !== GroupRank.REQUESTED && (
                                        <Text italics small variant="muted" className="volt-group-member-row__since">
                                            {LocalizeText('group.members.since', ['date'], [member.joinedAt])}
                                        </Text>
                                    )}
                                </Column>
                                <div className="volt-group-member-row__actions">
                                    {member.rank !== GroupRank.REQUESTED && (
                                        <div className="flex items-center justify-center">
                                            <div
                                                className={classNames(
                                                    `volt-icon icon-group-small-${member.rank === GroupRank.OWNER ? 'owner' : member.rank === GroupRank.ADMIN ? 'admin' : isOwner && member.rank === GroupRank.MEMBER ? 'not-admin' : ''}`,
                                                    isOwner && 'cursor-pointer'
                                                )}
                                                title={LocalizeText(getRankDescription(member))}
                                                onClick={(event) => toggleAdmin(member)}
                                            />
                                        </div>
                                    )}
                                    {membersData.admin && member.rank === GroupRank.REQUESTED && (
                                        <Flex alignItems="center">
                                            <div
                                                className="cursor-pointer volt-friends-spritesheet icon-accept"
                                                title={LocalizeText('group.members.accept')}
                                                onClick={(event) => acceptMembership(member)}
                                            />
                                        </Flex>
                                    )}
                                    {canRemoveMember(member) && (
                                        <Flex alignItems="center">
                                            <div
                                                className="cursor-pointer volt-friends-spritesheet icon-deny"
                                                title={LocalizeText(member.rank === GroupRank.REQUESTED ? 'group.members.reject' : 'group.members.kick')}
                                                onClick={(event) => removeMemberOrDeclineMembership(member)}
                                            />
                                        </Flex>
                                    )}
                                </div>
                            </Flex>
                        );
                    })}
                </Grid>
                <Flex alignItems="center" gap={1} justifyContent="between" className="volt-groups-footer volt-group-members-footer">
                    <Button className="volt-groups-button volt-groups-button--pager" disabled={pageId <= 0} onClick={(event) => setPageId((prevValue) => Math.max(0, prevValue - 1))}>
                        <FaChevronLeft className="fa-icon" />
                    </Button>
                    <div className="volt-group-members-footer__page">
                        <Text small className="volt-group-members-footer__label">
                            Page
                        </Text>
                        <input
                            className="volt-group-members-footer__input"
                            type="number"
                            min={1}
                            max={Math.max(1, totalPages)}
                            value={membersData.pageIndex + 1}
                            onChange={(event) =>
                            {
                                const value = Math.min(Math.max(parseInt(event.target.value) || 1, 1), Math.max(1, totalPages));
                                setPageId(value - 1);
                            }}
                        />
                        <Text small className="volt-group-members-footer__total">
                            / {Math.max(1, totalPages)}
                        </Text>
                    </div>
                    <Button
                        className="volt-groups-button volt-groups-button--pager"
                        disabled={totalPages === 0 || pageId >= totalPages - 1}
                        onClick={(event) => setPageId((prevValue) => Math.min(totalPages - 1, prevValue + 1))}
                    >
                        <FaChevronRight className="fa-icon" />
                    </Button>
                </Flex>
            </VoltCardContentView>
        </VoltCardView>
    );
};
