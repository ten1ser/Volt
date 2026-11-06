import { RelationshipStatusEnum, RelationshipStatusInfo } from '@volt/renderer';
import { FC } from 'react';
import { GetUserProfile } from '../../../../../api';

// Plain words for the native heart/smile/bobba relationship icons.
const RELATIONSHIP_LABELS: Record<string, string> = { heart: 'Partner', smile: 'Friend', bobba: 'Rival' };

interface InfoStandWidgetUserRelationshipsRelationshipItemViewProps {
    type: number;
    relationship: RelationshipStatusInfo;
}

export const InfoStandWidgetUserRelationshipsRelationshipItemView: FC<InfoStandWidgetUserRelationshipsRelationshipItemViewProps> = (props) => {
    const { type = -1, relationship = null } = props;

    if (!relationship) return null;

    const relationshipName = RelationshipStatusEnum.RELATIONSHIP_NAMES[type].toLocaleLowerCase();

    const label = RELATIONSHIP_LABELS[relationshipName];

    // One chip per relationship type: the icon and the shown friend's name, without the "and N others" count.
    return (
        <button
            type="button"
            className="volt-infostand__relationship"
            title={`${label}: ${relationship.randomFriendName}`}
            onClick={() => GetUserProfile(relationship.randomFriendId)}
        >
            <i className={`volt-friends-spritesheet icon-${relationshipName}`} role="img" aria-label={label} />
            <span>{relationship.randomFriendName}</span>
        </button>
    );
};
