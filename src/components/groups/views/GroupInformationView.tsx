import { GroupConfirmMemberRemoveEvent, GroupDeleteComposer, GetSessionDataManager, GroupInformationParser, GroupRemoveMemberComposer, CreateLinkEvent } from '@volt/renderer';
import { FC, useEffect, useLayoutEffect, useRef } from 'react';
import {
    CatalogPageName,
    GetGroupManager,
    GetGroupMembers,
    GroupMembershipType,
    GroupType,
    LocalizeText,
    SendMessageComposer,
    TryJoinGroup,
    TryVisitRoom
} from '../../../api';
import decorateIcon from '../../../assets/images/groups/native/group_decorate_icon.png';
import adminIcon from '../../../assets/images/groups/native/group_icon_big_admin.png';
import memberIcon from '../../../assets/images/groups/native/group_icon_big_member.png';
import ownerIcon from '../../../assets/images/groups/native/group_icon_big_owner.png';
import typeIconRegular from '../../../assets/images/groups/native/grouptype_icon_5.png';
import typeIconExclusive from '../../../assets/images/groups/native/grouptype_icon_1.png';
import typeIconPrivate from '../../../assets/images/groups/native/grouptype_icon_2.png';
import { LayoutBadgeImageView } from '../../../common';
import { useVoltCardContext } from '../../../common/card/VoltCardContext';
import { useGroupMemberRemoval, useMessageEvent, useNotification } from '../../../hooks';
import { flatText, GroupBox, GroupButton, GroupText } from './GroupNativeLayout';

const TYPE_ICONS: string[] = [typeIconRegular, typeIconExclusive, typeIconPrivate];
const TYPE_HELP: string[] = ['regular', 'exclusive', 'private'];

// groups_info_window: group_cont is the style 0 border at (10,10) below the 33px frame margin, 343x214; every rectangle below is its layout rectangle.
const BASE_X = 10;
const BASE_Y = 43;

interface GroupInformationViewProps {
    groupInformation: GroupInformationParser;
}

export const GroupInformationView: FC<GroupInformationViewProps> = (props) =>
{
    const { groupInformation = null } = props;
    const district = useVoltCardContext().theme === 'district';
    const { showConfirm = null } = useNotification();
    const userId = GetSessionDataManager().userId;
    const shownGroupId = groupInformation?.id ?? 0;
    const shownGroupIdRef = useRef<number>(shownGroupId);
    const confirmOpenRef = useRef<boolean>(false);

    // Read by the confirmation callbacks; refreshed before any of them can run.
    useLayoutEffect(() =>
    {
        shownGroupIdRef.current = shownGroupId;
    });

    // A confirmation belongs to the group it was asked for: showing another group (or closing the window) retires it.
    useEffect(() =>
    {
        confirmOpenRef.current = false;
    }, [shownGroupId]);

    useEffect(() => () =>
    {
        shownGroupIdRef.current = 0;
    }, []);

    const { request: requestMemberRemoval, claimReply, isCurrentSession } = useGroupMemberRemoval();

    // The reply names no group (see useGroupMemberRemoval): it is shown only when this window owns the one outstanding request for the group still on screen.
    useMessageEvent<GroupConfirmMemberRemoveEvent>(GroupConfirmMemberRemoveEvent, (event) =>
    {
        const parser = event.getParser();
        const removal = claimReply(parser.userId);

        if (!removal || removal.groupId !== shownGroupIdRef.current) return;

        let isSent = false;

        confirmOpenRef.current = true;
        showConfirm(
            LocalizeText(parser.furnitureCount > 0 ? 'group.leaveconfirm.desc' : 'group.leaveconfirm_nofurni.desc', ['amount'], [parser.furnitureCount.toString()]),
            () =>
            {
                confirmOpenRef.current = false;

                // One removal per confirmation, whatever re-renders or repeated callback invocations happen, and only while that group is shown and the same user is signed in.
                if (isSent || removal.groupId !== shownGroupIdRef.current || !isCurrentSession(removal)) return;

                isSent = true;
                SendMessageComposer(new GroupRemoveMemberComposer(removal.groupId, removal.userId));
            },
            () =>
            {
                confirmOpenRef.current = false;
            },
            LocalizeText('generic.ok'),
            LocalizeText('generic.cancel'),
            LocalizeText('group.leaveconfirm.title')
        );
    });

    if (!groupInformation) return null;

    const isRealOwner = groupInformation.isOwner;
    const isMember = groupInformation.membershipType === GroupMembershipType.MEMBER;
    const isPending = groupInformation.membershipType === GroupMembershipType.REQUEST_PENDING;
    const isNotMember = groupInformation.membershipType === GroupMembershipType.NOT_MEMBER;
    const nameX = BASE_X + 125 + (groupInformation.canMembersDecorate ? 15 : 0);

    const leaveGroup = () =>
    {
        if (confirmOpenRef.current) return;

        requestMemberRemoval(groupInformation.id, userId);
    };

    // Below the Members line the owner's Manage and Delete links follow, one line lower while a Pending line is shown.
    const hasPendingLine = groupInformation.pendingRequestsCount > 0 && (groupInformation.isOwner || groupInformation.isAdmin);
    const leftLinksY = hasPendingLine ? 137 : 121;

    const deleteGroup = () =>
    {
        let isSent = false;

        showConfirm(
            LocalizeText('group.deleteconfirm.desc'),
            () =>
            {
                // One deletion per confirmation, and only while that group is the one shown.
                if (isSent || groupInformation.id !== shownGroupIdRef.current) return;

                isSent = true;
                SendMessageComposer(new GroupDeleteComposer(groupInformation.id));
            },
            null,
            null,
            null,
            LocalizeText('group.deleteconfirm.title')
        );
    };

    const handleAction = (action: string) =>
    {
        switch (action)
        {
            case 'members':
                GetGroupMembers(groupInformation.id, 0);
                break;
            case 'members_pending':
                GetGroupMembers(groupInformation.id, 2);
                break;
            case 'manage':
                GetGroupManager(groupInformation.id);
                break;
            case 'homeroom':
                TryVisitRoom(groupInformation.roomId);
                break;
            case 'furniture':
                CreateLinkEvent('catalog/open/' + CatalogPageName.GUILD_CUSTOM_FURNI);
                break;
            case 'popular_groups':
                CreateLinkEvent('navigator/search/hotel_view/group:');
                break;
            case 'forum':
                CreateLinkEvent('groupforum/' + groupInformation.id);
                break;
        }
    };

    if (district) return (
        <div className="district-group-details">
            <section className="district-group-identity">
                <div className="district-group-badge"><LayoutBadgeImageView badgeCode={groupInformation.badge} isGroup scale={2} /></div>
                <div>
                    <h2>{groupInformation.title}</h2>
                    <p>{groupInformation.description}</p>
                    <img alt="" src={TYPE_ICONS[groupInformation.type]} title={LocalizeText(`group.edit.settings.type.${TYPE_HELP[groupInformation.type]}.help`)} />
                    {groupInformation.canMembersDecorate && <img alt="" src={decorateIcon} title={LocalizeText('group.memberscandecorate')} />}
                </div>
            </section>
            <div className="district-group-metadata">
                <span>{LocalizeText('group.membercount', ['totalMembers'], [groupInformation.membersCount.toString()])}</span>
                <span>{LocalizeText('group.created', ['date', 'owner'], [groupInformation.createdAt, groupInformation.ownerName])}</span>
            </div>
            <div className="district-group-actions">
                <button type="button" onClick={() => handleAction('members')}>{LocalizeText('group.membercount', ['totalMembers'], [groupInformation.membersCount.toString()])}</button>
                <button type="button" onClick={() => handleAction('homeroom')}>{LocalizeText('group.linktobase')}</button>
                {hasPendingLine && <button type="button" onClick={() => handleAction('members_pending')}>{LocalizeText('group.pendingmembercount', ['amount'], [groupInformation.pendingRequestsCount.toString()])}</button>}
                <button type="button" onClick={() => handleAction('furniture')}>{LocalizeText('group.buyfurni')}</button>
                <button type="button" onClick={() => handleAction('popular_groups')}>{LocalizeText('group.showgroups')}</button>
                {groupInformation.hasForum && <button type="button" onClick={() => handleAction('forum')}>{LocalizeText('group.showforum')}</button>}
                {isRealOwner && <>
                    <button type="button" onClick={() => handleAction('manage')}>{LocalizeText('group.manage')}</button>
                    <button className="district-danger" type="button" onClick={deleteGroup}>{LocalizeText('group.delete')}</button>
                </>}
                {isMember && !isRealOwner && <button className="district-danger" type="button" onClick={leaveGroup}>{LocalizeText('group.leave')}</button>}
                {isNotMember && groupInformation.type === GroupType.REGULAR && <button type="button" onClick={() => TryJoinGroup(groupInformation.id)}>{LocalizeText('group.join')}</button>}
                {isNotMember && groupInformation.type === GroupType.EXCLUSIVE && <button type="button" onClick={() => TryJoinGroup(groupInformation.id)}>{LocalizeText('group.requestmembership')}</button>}
            </div>
            {(isRealOwner || isMember || isPending) && <div className="district-group-status">
                {!isPending && <img alt="" src={isRealOwner ? ownerIcon : groupInformation.isAdmin ? adminIcon : memberIcon} />}
                <span>{LocalizeText(isPending ? 'group.membershippending' : isRealOwner ? 'group.youareowner' : groupInformation.isAdmin ? 'group.youareadmin' : 'group.youaremember')}</span>
            </div>}
        </div>
    );

    return (
        <>
            <GroupBox height={214} kind="cc" width={343} x={BASE_X} y={BASE_Y} />
            <div className="volt-group-info__badge" style={{ left: BASE_X + 11, top: BASE_Y + 14 }}>
                <LayoutBadgeImageView badgeCode={groupInformation.badge} isGroup={true} scale={2} />
            </div>
            <img alt="" className="volt-group-info__icon" draggable={false} src={TYPE_ICONS[groupInformation.type]} style={{ left: BASE_X + 107, top: BASE_Y + 10 }} title={LocalizeText(`group.edit.settings.type.${TYPE_HELP[groupInformation.type]}.help`)} />
            {groupInformation.canMembersDecorate && (
                <img alt="" className="volt-group-info__icon" draggable={false} src={decorateIcon} style={{ left: BASE_X + 125, top: BASE_Y + 10 }} title={LocalizeText('group.memberscandecorate')} />
            )}
            <GroupText background={0xcccccc} height={17} overrides={flatText(12, { bold: true })} text={groupInformation.title} width={206} x={nameX} y={BASE_Y + 9} />
            <GroupText
                background={0xcccccc}
                text={LocalizeText('group.created', ['date', 'owner'], [groupInformation.createdAt, groupInformation.ownerName])}
                textStyle="u_small"
                x={BASE_X + 103}
                y={BASE_Y + 27}
            />
            <GroupText background={0xcccccc} height={55} overrides={flatText(12)} text={groupInformation.description} width={215} wrap x={BASE_X + 103} y={BASE_Y + 42} />
            <GroupText
                align="center"
                background={0xcccccc}
                className="is-link"
                overrides={flatText(12, { bold: true, underline: true })}
                text={LocalizeText('group.membercount', ['totalMembers'], [groupInformation.membersCount.toString()])}
                width={97}
                x={BASE_X + 4}
                y={BASE_Y + 103}
                onClick={() => handleAction('members')}
            />
            {hasPendingLine && (
                <GroupText
                    align="center"
                    background={0xcccccc}
                    className="is-link"
                    overrides={{ underline: true }}
                    text={LocalizeText('group.pendingmembercount', ['amount'], [groupInformation.pendingRequestsCount.toString()])}
                    textStyle="u_bold"
                    width={97}
                    x={BASE_X + 4}
                    y={BASE_Y + 121}
                    onClick={() => handleAction('members_pending')}
                />
            )}
            <GroupText background={0xcccccc} className="is-link" overrides={flatText(12, { underline: true })} text={LocalizeText('group.linktobase')} x={BASE_X + 103} y={BASE_Y + 103} onClick={() => handleAction('homeroom')} />
            <GroupText background={0xcccccc} className="is-link" overrides={flatText(12, { underline: true })} text={LocalizeText('group.buyfurni')} x={BASE_X + 103} y={BASE_Y + 121} onClick={() => handleAction('furniture')} />
            <GroupText background={0xcccccc} className="is-link" overrides={flatText(12, { underline: true })} text={LocalizeText('group.showgroups')} x={BASE_X + 103} y={BASE_Y + 139} onClick={() => handleAction('popular_groups')} />
            {groupInformation.hasForum && (
                <GroupText background={0xcccccc} className="is-link" overrides={flatText(12, { underline: true })} text={LocalizeText('group.showforum')} x={BASE_X + 103} y={BASE_Y + 157} onClick={() => handleAction('forum')} />
            )}
            {groupInformation.isOwner && (
                <>
                    <GroupText align="center" background={0xcccccc} className="is-link" overrides={flatText(12, { underline: true })} text={LocalizeText('group.manage')} width={97} x={BASE_X - 1} y={BASE_Y + leftLinksY} onClick={() => handleAction('manage')} />
                    <GroupText align="center" background={0xcccccc} className="is-link" overrides={flatText(12, { underline: true })} text={LocalizeText('group.delete')} width={97} x={BASE_X - 1} y={BASE_Y + leftLinksY + 16} onClick={deleteGroup} />
                </>
            )}
            {isMember && !isRealOwner && (
                <>
                    <img
                        alt=""
                        className="volt-group-info__icon"
                        draggable={false}
                        src={groupInformation.isAdmin ? adminIcon : memberIcon}
                        style={{ left: BASE_X + 40, top: BASE_Y + 183 }}
                        title={LocalizeText(groupInformation.isAdmin ? 'group.youareadmin' : 'group.youaremember')}
                    />
                    <GroupButton height={29} label={LocalizeText('group.leave')} width={160} x={BASE_X + 99} y={BASE_Y + 179} onClick={leaveGroup} />
                </>
            )}
            {isRealOwner && (
                <img alt="" className="volt-group-info__icon" draggable={false} src={ownerIcon} style={{ left: BASE_X + 40, top: BASE_Y + 183 }} title={LocalizeText('group.youareowner')} />
            )}
            {isNotMember && groupInformation.type === GroupType.REGULAR && (
                <GroupButton height={29} label={LocalizeText('group.join')} width={160} x={BASE_X + 99} y={BASE_Y + 179} onClick={() => TryJoinGroup(groupInformation.id)} />
            )}
            {isNotMember && groupInformation.type === GroupType.EXCLUSIVE && (
                <GroupButton height={29} label={LocalizeText('group.requestmembership')} width={260} x={BASE_X + 49} y={BASE_Y + 179} onClick={() => TryJoinGroup(groupInformation.id)} />
            )}
            {isPending && (
                <GroupText align="center" background={0xcccccc} overrides={flatText(13, { bold: true })} text={LocalizeText('group.membershippending')} width={175} x={BASE_X + 84} y={BASE_Y + 184} />
            )}
        </>
    );
};
