import { GetSessionDataManager, HabboSearchComposer, RemoveFriendComposer } from '@volt/renderer';
import { FC, FormEvent, useState } from 'react';
import { MessengerFriend, SendMessageComposer } from '../../../api';
import { LayoutAvatarImageView } from '../../../common/layout/LayoutAvatarImageView';
import { useFriends } from '../../../hooks';
import { PHONE_GLYPHS, PhoneAvatar, PhoneHeader } from './PhoneShared';

type Tab = 'online' | 'all' | 'requests';

const RELATIONSHIPS = [
    { type: MessengerFriend.RELATIONSHIP_NONE, label: 'None', symbol: '–' },
    { type: MessengerFriend.RELATIONSHIP_HEART, label: 'Heart', symbol: '♥' },
    { type: MessengerFriend.RELATIONSHIP_SMILE, label: 'Smile', symbol: '☺' },
    { type: MessengerFriend.RELATIONSHIP_BOBBA, label: 'Bobba', symbol: '☠' }
];

const relationshipSymbol = (status: number) => RELATIONSHIPS.find(relationship => relationship.type === status && status > 0)?.symbol ?? '';

/** Friends: online/all/requests, a profile card per friend and people search, all on the shared friends store. */
export const PhoneFriendsApp: FC<{ onMessage: (userId: number) => void; onHome: () => void }> = ({ onMessage, onHome }) =>
{
    const [tab, setTab] = useState<Tab>('online');
    const [filter, setFilter] = useState('');
    const [profileId, setProfileId] = useState(0);
    const [finding, setFinding] = useState(false);
    const { friends, onlineFriends, offlineFriends, requests, getFriend } = useFriends();
    const profile = profileId ? getFriend(profileId) : null;

    if (profile) return <PhoneFriendProfile friend={profile} onBack={() => setProfileId(0)} onMessage={onMessage} />;
    if (finding) return <PhoneFindPeople onBack={() => setFinding(false)} onMessage={onMessage} />;

    const query = filter.trim().toLowerCase();
    const shown = (tab === 'online' ? onlineFriends : [...onlineFriends, ...offlineFriends]).filter(friend => !query || friend.name.toLowerCase().includes(query));
    const tabButton = (id: Tab, label: string, count = 0) => (
        <button type="button" role="tab" aria-selected={tab === id} className={tab === id ? 'is-active' : ''} onClick={() => setTab(id)}>
            {label}{!!count && <b>{count}</b>}
        </button>
    );

    return (
        <div className="district-phone__app-screen">
            <PhoneHeader title="Friends" backLabel="Home" onBack={onHome} action={<button type="button" className="district-phone__header-action" aria-label="Find people" onClick={() => setFinding(true)}>+</button>} />
            <div className="district-phone__segments" role="tablist" aria-label="Friends">
                {tabButton('online', `Online ${onlineFriends.length}`)}
                {tabButton('all', `All ${friends.length}`)}
                {tabButton('requests', 'Requests', requests.length)}
            </div>
            {tab !== 'requests' && <input className="district-phone__search" value={filter} placeholder="Search friends" aria-label="Search friends" onChange={event => setFilter(event.target.value)} />}
            {tab === 'requests'
                ? <PhoneRequests />
                : <ul className="district-phone__list">
                    {shown.map(friend => (
                        <li key={friend.id} className="district-phone__row-wrap">
                            <button type="button" className="district-phone__row" onClick={() => setProfileId(friend.id)}>
                                <PhoneAvatar figure={friend.figure} name={friend.name} online={friend.online} />
                                <span className="district-phone__row-text">
                                    <strong>{friend.name} {relationshipSymbol(friend.relationshipStatus) && <em>{relationshipSymbol(friend.relationshipStatus)}</em>}</strong>
                                    <small>{friend.online ? (friend.motto || 'Online') : 'Offline'}</small>
                                </span>
                            </button>
                            <button type="button" className="district-phone__row-action" aria-label={`Message ${friend.name}`} onClick={() => onMessage(friend.id)}>{PHONE_GLYPHS.messages}</button>
                        </li>
                    ))}
                    {!shown.length && <li className="district-phone__empty">{query ? 'No friends match.' : tab === 'online' ? 'None of your friends are online.' : 'Tap + to find people.'}</li>}
                </ul>}
        </div>
    );
};

const PhoneRequests: FC = () =>
{
    const { requests, requestResponse } = useFriends();

    return (
        <ul className="district-phone__list">
            {requests.map(request => (
                <li key={request.id} className="district-phone__row-wrap">
                    <span className="district-phone__row">
                        <PhoneAvatar figure={request.figureString} name={request.name} />
                        <span className="district-phone__row-text"><strong>{request.name}</strong><small>Wants to be friends</small></span>
                    </span>
                    <button type="button" className="district-phone__pill is-primary" onClick={() => requestResponse(request.id, true)}>Accept</button>
                    <button type="button" className="district-phone__pill" aria-label={`Decline ${request.name}`} onClick={() => requestResponse(request.id, false)}>✕</button>
                </li>
            ))}
            {!requests.length && <li className="district-phone__empty">No friend requests.</li>}
        </ul>
    );
};

const PhoneFriendProfile: FC<{ friend: MessengerFriend; onBack: () => void; onMessage: (userId: number) => void }> = ({ friend, onBack, onMessage }) =>
{
    const [confirmRemove, setConfirmRemove] = useState(false);
    const { followFriend, updateRelationship } = useFriends();
    const remove = () =>
    {
        SendMessageComposer(new RemoveFriendComposer(friend.id));
        onBack();
    };

    return (
        <div className="district-phone__app-screen">
            <PhoneHeader title="" backLabel="Friends" onBack={onBack} />
            <div className="district-phone__profile">
                <span className="district-phone__figure"><LayoutAvatarImageView figure={friend.figure} direction={2} /></span>
                <h3>{friend.name}</h3>
                <small className={friend.online ? 'is-online' : ''}>{friend.online ? 'Online' : 'Offline'}</small>
                {friend.motto && <p>{friend.motto}</p>}
            </div>
            <div className="district-phone__actions">
                <button type="button" className="district-phone__pill is-primary" onClick={() => onMessage(friend.id)}>Message</button>
                {friend.online && friend.followingAllowed && <button type="button" className="district-phone__pill" onClick={() => followFriend(friend)}>Go to</button>}
            </div>
            <div className="district-phone__group">
                <span className="district-phone__group-label">Relationship</span>
                <div className="district-phone__segments" role="radiogroup" aria-label="Relationship">
                    {RELATIONSHIPS.map(relationship => (
                        <button
                            type="button"
                            role="radio"
                            key={relationship.type}
                            aria-checked={friend.relationshipStatus === relationship.type || (relationship.type === 0 && friend.relationshipStatus <= 0)}
                            aria-label={relationship.label}
                            className={friend.relationshipStatus === relationship.type || (relationship.type === 0 && friend.relationshipStatus <= 0) ? 'is-active' : ''}
                            onClick={() => updateRelationship(friend, relationship.type)}>
                            {relationship.symbol}
                        </button>
                    ))}
                </div>
            </div>
            <div className="district-phone__group">
                {confirmRemove
                    ? <div className="district-phone__confirm">
                        <span>Remove {friend.name} from your friends?</span>
                        <button type="button" className="district-phone__pill is-danger" onClick={remove}>Remove</button>
                        <button type="button" className="district-phone__pill" onClick={() => setConfirmRemove(false)}>Cancel</button>
                    </div>
                    : <button type="button" className="district-phone__link is-danger" onClick={() => setConfirmRemove(true)}>Remove friend</button>}
            </div>
        </div>
    );
};

const PhoneFindPeople: FC<{ onBack: () => void; onMessage: (userId: number) => void }> = ({ onBack, onMessage }) =>
{
    const { searchResults, searchValue, setSearchValue, sentRequests, requestFriend } = useFriends();
    const ownUserId = GetSessionDataManager().userId;
    const results = [...searchResults.friends.map(result => ({ result, friend: true })), ...searchResults.others.map(result => ({ result, friend: false }))]
        .filter(({ result }) => result.avatarId > 0);
    const submit = (event: FormEvent<HTMLFormElement>) =>
    {
        event.preventDefault();
        const value = searchValue.trim();
        if (value.length) SendMessageComposer(new HabboSearchComposer(value));
    };

    return (
        <div className="district-phone__app-screen">
            <PhoneHeader title="Find people" backLabel="Friends" onBack={onBack} />
            <form className="district-phone__search-form" onSubmit={submit}>
                <input className="district-phone__search" value={searchValue} placeholder="Name" aria-label="Search people" onChange={event => setSearchValue(event.target.value)} />
                <button type="submit" className="district-phone__pill is-primary">Search</button>
            </form>
            <ul className="district-phone__list">
                {results.map(({ result, friend }) => (
                    <li key={result.avatarId} className="district-phone__row-wrap">
                        <span className="district-phone__row">
                            <PhoneAvatar figure={result.avatarFigure} name={result.avatarName} online={result.isAvatarOnline} />
                            <span className="district-phone__row-text"><strong>{result.avatarName}</strong><small>{friend ? 'Friend' : result.isAvatarOnline ? 'Online' : 'Offline'}</small></span>
                        </span>
                        {friend && <button type="button" className="district-phone__row-action" aria-label={`Message ${result.avatarName}`} onClick={() => onMessage(result.avatarId)}>{PHONE_GLYPHS.messages}</button>}
                        {!friend && result.avatarId !== ownUserId && (sentRequests.includes(result.avatarId)
                            ? <span className="district-phone__pill is-muted">Sent</span>
                            : <button type="button" className="district-phone__pill is-primary" onClick={() => requestFriend(result.avatarId, result.avatarName)}>Add</button>)}
                    </li>
                ))}
                {!results.length && <li className="district-phone__empty">Search the hotel by name to add friends.</li>}
            </ul>
        </div>
    );
};
