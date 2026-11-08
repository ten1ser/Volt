import {
    AvatarAction,
    AvatarExpressionEnum,
    CreateLinkEvent,
    RoomObjectCategory,
    RoomObjectVariable,
    RoomUnitDropHandItemComposer
} from '@volt/renderer';
import { Dispatch, FC, SetStateAction, useState } from 'react';
import {
    AvatarInfoUser,
    DispatchUiEvent,
    GetCanStandUp,
    GetConfigurationValue,
    GetOwnPosture,
    GetOwnRoomObject,
    GetUserProfile,
    HasHabboClub,
    HasHabboVip,
    IsRidingHorse,
    LocalizeText,
    localizeWithFallback,
    PostureTypeEnum,
    SendMessageComposer
} from '../../../../../api';
import { HelpNameChangeEvent } from '../../../../../events';
import { useRoom, useWiredTools } from '../../../../../hooks';
import { useRpPhone } from '../../../../../hooks/roleplay/useRpPhone';
import { ContextMenuHeaderView } from '../../context-menu/ContextMenuHeaderView';
import { ContextMenuListItemView } from '../../context-menu/ContextMenuListItemView';
import { ContextMenuView } from '../../context-menu/ContextMenuView';

interface AvatarInfoWidgetOwnAvatarViewProps {
    avatarInfo: AvatarInfoUser;
    isDancing: boolean;
    setIsDecorating: Dispatch<SetStateAction<boolean>>;
    onClose: () => void;
}

interface AirSign {
    id: number;
    label?: string;
    icon?: string;
}

const MODE_NORMAL = 0;
const MODE_CLUB_DANCES = 1;
const MODE_EXPRESSIONS = 3;
const MODE_SIGNS = 4;

const AIR_SIGNS: AirSign[] = [
    { id: 1, label: '1' },
    { id: 2, label: '2' },
    { id: 3, label: '3' },
    { id: 4, label: '4' },
    { id: 5, label: '5' },
    { id: 6, label: '6' },
    { id: 7, label: '7' },
    { id: 8, label: '8' },
    { id: 9, label: '9' },
    { id: 10, label: '10' },
    { id: 11, icon: 'heart' },
    { id: 12, icon: 'skull' },
    { id: 0, label: '0' },
    { id: 13, icon: 'exclamation' },
    { id: 15, icon: 'smile' },
    { id: 14, icon: 'soccer' },
    { id: 17, icon: 'yellow' },
    { id: 16, icon: 'red' }
];

export const AvatarInfoWidgetOwnAvatarView: FC<AvatarInfoWidgetOwnAvatarViewProps> = (props) =>
{
    const { avatarInfo = null, isDancing = false, setIsDecorating = null, onClose = null } = props;
    const hasClub = HasHabboClub();
    const hasVip = HasHabboVip();
    const ownPosture = GetOwnPosture();
    const ownRoomObject = GetOwnRoomObject();
    const activeEffectId = ownRoomObject?.model.getValue<number>(RoomObjectVariable.FIGURE_EFFECT) ?? 0;
    const hasActiveEffect = activeEffectId > 0;
    const isRidingHorse = IsRidingHorse();
    const isSwimming = ownPosture === AvatarAction.POSTURE_SWIM;
    const [mode, setMode] = useState(isDancing && hasClub && !hasActiveEffect ? MODE_CLUB_DANCES : MODE_NORMAL);
    const { roomSession = null } = useRoom();
    const { openInspectionForUser, showInspectButton } = useWiredTools();
    const { status: phoneStatus } = useRpPhone();

    const expressionsMenuEnabled = GetConfigurationValue('avatar.expressions_menu.enabled', true);
    const signsEnabled = GetConfigurationValue('avatar.signs.enabled', true);
    const handItemDropEnabled = GetConfigurationValue('handitem.drop.enabled', true);
    const sittingEnabled = GetConfigurationValue('avatar.sitting.enabled', true);
    const expression67Enabled = GetConfigurationValue('avatar.expression.67.enabled', false);

    const processAction = (name: string) =>
    {
        let hideMenu = true;

        if (name)
        {
            if (!hasVip && ['blow', 'expression_67', 'laugh'].includes(name))
            {
                CreateLinkEvent('habboUI/open/hccenter');
                hideMenu = false;
            }
            else if (name.startsWith('sign_'))
            {
                const sign = parseInt(name.split('_')[1]);

                roomSession.sendSignMessage(sign);
            }
            else
            {
                switch (name)
                {
                    case 'decorate':
                        setIsDecorating(true);
                        break;
                    case 'change_name':
                        DispatchUiEvent(new HelpNameChangeEvent(HelpNameChangeEvent.INIT));
                        break;
                    case 'change_looks':
                        CreateLinkEvent('avatar-editor/show');
                        break;
                    case 'badge_leaderboard':
                        CreateLinkEvent('badge-leaderboard/show');
                        break;
                    case 'expressions':
                        hideMenu = false;
                        setMode(MODE_EXPRESSIONS);
                        break;
                    case 'sit':
                        roomSession.sendPostureMessage(PostureTypeEnum.POSTURE_SIT);
                        break;
                    case 'stand':
                        roomSession.sendPostureMessage(PostureTypeEnum.POSTURE_STAND);
                        break;
                    case 'wave':
                        roomSession.sendExpressionMessage(AvatarExpressionEnum.WAVE.ordinal);
                        break;
                    case 'blow':
                        roomSession.sendExpressionMessage(AvatarExpressionEnum.BLOW.ordinal);
                        break;
                    case 'expression_67':
                        roomSession.sendExpressionMessage(67);
                        break;
                    case 'laugh':
                        roomSession.sendExpressionMessage(AvatarExpressionEnum.LAUGH.ordinal);
                        break;
                    case 'idle':
                        roomSession.sendExpressionMessage(AvatarExpressionEnum.IDLE.ordinal);
                        break;
                    case 'dance_menu':
                        hideMenu = false;
                        setMode(MODE_CLUB_DANCES);
                        break;
                    case 'dance':
                        roomSession.sendDanceMessage(1);
                        break;
                    case 'dance_stop':
                        roomSession.sendDanceMessage(0);
                        break;
                    case 'dance_1':
                    case 'dance_2':
                    case 'dance_3':
                    case 'dance_4':
                        roomSession.sendDanceMessage(parseInt(name.charAt(name.length - 1)));
                        break;
                    case 'signs':
                        hideMenu = false;
                        setMode(MODE_SIGNS);
                        break;
                    case 'back':
                        hideMenu = false;
                        setMode(MODE_NORMAL);
                        break;
                    case 'drop_carry_item':
                        SendMessageComposer(new RoomUnitDropHandItemComposer());
                        break;
                    case 'inspect':
                        openInspectionForUser(avatarInfo.roomIndex);
                        break;
                    case 'badge_leaderboard':
                        CreateLinkEvent('badge-leaderboard/show');
                        break;
                }
            }
        }

        if (hideMenu) onClose();
    };

    const canUsePremiumExpression = !hasActiveEffect && !isSwimming;
    const premiumExpressionClassNames = hasVip ? [] : ['air-avatar-menu-item--locked'];

    return (
        <ContextMenuView
            category={RoomObjectCategory.UNIT}
            classNames={['volt-avatar-action-menu', 'volt-avatar-action-menu--own', 'volt-avatar-action-menu--classic']}
            collapsable={true}
            freezePositionOnHover={true}
            maximumVerticalLeadRatio={0.05}
            objectId={avatarInfo.roomIndex}
            repositionKey={mode}
            showCaretIcon={false}
            tallAvatarOffset={25}
            userType={avatarInfo.userType}
            onClose={onClose}
        >
            <ContextMenuHeaderView className="cursor-pointer" onClick={() => GetUserProfile(avatarInfo.webID)}>
                {avatarInfo.name}
            </ContextMenuHeaderView>
            {phoneStatus && <div className="district-avatar-menu-phone" title="Your phone number">{phoneStatus.hasSim ? phoneStatus.number : 'No SIM'}</div>}
            <div className="air-avatar-menu-buttons">
                {mode === MODE_NORMAL && (
                    <>
                        <ContextMenuListItemView onClick={() => processAction('change_looks')}>
                            {localizeWithFallback('district.menu.clothing', 'Clothing')}
                        </ContextMenuListItemView>
                        {expressionsMenuEnabled ? (
                            <ContextMenuListItemView onClick={() => processAction('expressions')}>
                                {LocalizeText('infostand.link.expressions')}
                            </ContextMenuListItemView>
                        ) : (
                            <ContextMenuListItemView onClick={() => processAction('wave')}>{LocalizeText('widget.memenu.wave')}</ContextMenuListItemView>
                        )}
                        {hasClub && !isRidingHorse && (
                            <ContextMenuListItemView disabled={hasActiveEffect} onClick={() => processAction('dance_menu')}>
                                {LocalizeText('widget.memenu.dance')}
                            </ContextMenuListItemView>
                        )}
                        {!isDancing && !hasClub && !isRidingHorse && (
                            <ContextMenuListItemView disabled={hasActiveEffect} onClick={() => processAction('dance')}>
                                {LocalizeText('widget.memenu.dance')}
                            </ContextMenuListItemView>
                        )}
                        {isDancing && !hasClub && !isRidingHorse && (
                            <ContextMenuListItemView onClick={() => processAction('dance_stop')}>
                                {LocalizeText('widget.memenu.dance.stop')}
                            </ContextMenuListItemView>
                        )}
                        {signsEnabled && (
                            <ContextMenuListItemView onClick={() => processAction('signs')}>
                                {LocalizeText('infostand.show.signs')}
                            </ContextMenuListItemView>
                        )}
                        {avatarInfo.carryItem > 0 && avatarInfo.carryItem < 999999 && handItemDropEnabled && (
                            <ContextMenuListItemView onClick={() => processAction('drop_carry_item')}>
                                {LocalizeText('avatar.widget.drop_hand_item')}
                            </ContextMenuListItemView>
                        )}
                        {showInspectButton && (
                            <ContextMenuListItemView onClick={() => processAction('inspect')}>
                                {LocalizeText('infostand.button.wired_inspect')}
                            </ContextMenuListItemView>
                        )}

                    </>
                )}
                {mode === MODE_CLUB_DANCES && (
                    <>
                        <ContextMenuListItemView disabled={!isDancing} onClick={() => processAction('dance_stop')}>
                            {LocalizeText('widget.memenu.dance.stop')}
                        </ContextMenuListItemView>
                        <ContextMenuListItemView onClick={() => processAction('dance_1')}>{LocalizeText('widget.memenu.dance1')}</ContextMenuListItemView>
                        <ContextMenuListItemView onClick={() => processAction('dance_2')}>{LocalizeText('widget.memenu.dance2')}</ContextMenuListItemView>
                        <ContextMenuListItemView onClick={() => processAction('dance_3')}>{LocalizeText('widget.memenu.dance3')}</ContextMenuListItemView>
                        <ContextMenuListItemView onClick={() => processAction('dance_4')}>{LocalizeText('widget.memenu.dance4')}</ContextMenuListItemView>
                        <ContextMenuListItemView onClick={() => processAction('back')}>
                            {LocalizeText('generic.back')}
                        </ContextMenuListItemView>
                    </>
                )}
                {mode === MODE_EXPRESSIONS && (
                    <>
                        {sittingEnabled && !isSwimming && !isRidingHorse && ownPosture === AvatarAction.POSTURE_STAND && (
                            <ContextMenuListItemView onClick={() => processAction('sit')}>{LocalizeText('widget.memenu.sit')}</ContextMenuListItemView>
                        )}
                        {sittingEnabled && !isSwimming && !isRidingHorse && GetCanStandUp() && (
                            <ContextMenuListItemView onClick={() => processAction('stand')}>{LocalizeText('widget.memenu.stand')}</ContextMenuListItemView>
                        )}
                        <ContextMenuListItemView disabled={isSwimming} onClick={() => processAction('wave')}>
                            {LocalizeText('widget.memenu.wave')}
                        </ContextMenuListItemView>
                        <ContextMenuListItemView
                            classNames={premiumExpressionClassNames}
                            disabled={hasVip && !canUsePremiumExpression}
                            onClick={() => processAction('blow')}
                        >
                            {!hasVip && <i className="air-avatar-menu-vip" aria-hidden="true" />}
                            {LocalizeText('widget.memenu.blow')}
                        </ContextMenuListItemView>
                        {expression67Enabled && (
                            <ContextMenuListItemView
                                classNames={premiumExpressionClassNames}
                                disabled={hasVip && !canUsePremiumExpression}
                                onClick={() => processAction('expression_67')}
                            >
                                {!hasVip && <i className="air-avatar-menu-vip" aria-hidden="true" />}
                                {LocalizeText('widget.memenu.expression_67')}
                            </ContextMenuListItemView>
                        )}
                        <ContextMenuListItemView
                            classNames={premiumExpressionClassNames}
                            disabled={hasVip && !canUsePremiumExpression}
                            onClick={() => processAction('laugh')}
                        >
                            {!hasVip && <i className="air-avatar-menu-vip" aria-hidden="true" />}
                            {LocalizeText('widget.memenu.laugh')}
                        </ContextMenuListItemView>
                        <ContextMenuListItemView onClick={() => processAction('idle')}>{LocalizeText('widget.memenu.idle')}</ContextMenuListItemView>
                        <ContextMenuListItemView onClick={() => processAction('back')}>
                            {LocalizeText('generic.back')}
                        </ContextMenuListItemView>
                    </>
                )}
                {mode === MODE_SIGNS && (
                    <>
                        <div className="air-avatar-menu-signs-grid">
                            {AIR_SIGNS.map((sign) => (
                                <ContextMenuListItemView
                                    key={sign.id}
                                    classNames={['air-avatar-menu-sign-cell']}
                                    onClick={() => processAction(`sign_${sign.id}`)}
                                >
                                    {sign.label}
                                    {sign.icon && <i className={`air-avatar-menu-sign-icon air-avatar-menu-sign-icon--${sign.icon}`} aria-hidden="true" />}
                                </ContextMenuListItemView>
                            ))}
                        </div>
                        <ContextMenuListItemView onClick={() => processAction('back')}>
                            {LocalizeText('generic.back')}
                        </ContextMenuListItemView>
                    </>
                )}
            </div>
        </ContextMenuView>
    );
};
