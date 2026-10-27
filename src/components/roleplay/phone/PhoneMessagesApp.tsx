import { GetSessionDataManager, MessengerMessageType } from '@volt/renderer';
import { FC, KeyboardEvent, useEffect, useRef, useState } from 'react';
import { MessengerFriend, MessengerThread, MessengerThreadChat } from '../../../api';
import { useFriends, useMessenger } from '../../../hooks';
import { PhoneAvatar, PhoneHeader, phoneTime } from './PhoneShared';

const MAX_MESSAGE_LENGTH = 120;
// Thread chats store the message type as a plain number.
const HABBICON: number = MessengerMessageType.Habbicon;

const isConversation = (chat: MessengerThreadChat) =>
    chat.type === MessengerThreadChat.CHAT || chat.type === MessengerThreadChat.ROOM_INVITE || chat.type === HABBICON;

const sentAt = (chat: MessengerThreadChat) => new Date(chat.date.getTime() - chat.secondsSinceSent * 1000);

export const lastConversationChat = (thread: MessengerThread): MessengerThreadChat =>
{
    for (let group = thread.groups.length - 1; group >= 0; group--)
    {
        const chats = thread.groups[group].chats;

        for (let index = chats.length - 1; index >= 0; index--) if (isConversation(chats[index])) return chats[index];
    }

    return null;
};

/** One-line inbox and banner preview of a thread's latest message. */
export const threadPreview = (thread: MessengerThread, ownUserId: number) =>
{
    const chat = lastConversationChat(thread);

    if (!chat) return 'No messages yet';
    if (chat.type === HABBICON) return 'Sticker';
    if (chat.type === MessengerThreadChat.ROOM_INVITE) return `Room invite: ${chat.message}`;

    return `${chat.senderId === ownUserId ? 'You: ' : ''}${chat.message.trim()}`;
};

/** Messages: inbox, new-chat picker and an open conversation, all on the shared messenger threads. */
export const PhoneMessagesApp: FC<{ threadId: number; onOpenThread: (threadId: number) => void; onHome: () => void }> = ({ threadId, onOpenThread, onHome }) =>
{
    const [picking, setPicking] = useState(false);
    const { visibleThreads, getMessageThread } = useMessenger();
    const { onlineFriends, offlineFriends } = useFriends();
    const ownUserId = GetSessionDataManager().userId;
    const thread = threadId ? visibleThreads.find(candidate => candidate.threadId === threadId) : null;

    if (thread) return <PhoneThread thread={thread} ownUserId={ownUserId} onBack={() => onOpenThread(0)} />;

    const startChat = (friend: MessengerFriend) =>
    {
        const started = getMessageThread(friend.id);

        setPicking(false);
        if (started) onOpenThread(started.threadId);
    };

    if (picking) return (
        <div className="district-phone__app-screen">
            <PhoneHeader title="New message" backLabel="Cancel" onBack={() => setPicking(false)} />
            <ul className="district-phone__list">
                {[...onlineFriends, ...offlineFriends].map(friend => (
                    <li key={friend.id}>
                        <button type="button" className="district-phone__row" onClick={() => startChat(friend)}>
                            <PhoneAvatar figure={friend.figure} name={friend.name} online={friend.online} />
                            <span className="district-phone__row-text"><strong>{friend.name}</strong><small>{friend.online ? 'Online' : 'Offline'}</small></span>
                        </button>
                    </li>
                ))}
                {!onlineFriends.length && !offlineFriends.length && <li className="district-phone__empty">Add friends to start a conversation.</li>}
            </ul>
        </div>
    );

    const threads = [...visibleThreads].sort((a, b) => b.lastUpdated.getTime() - a.lastUpdated.getTime());

    return (
        <div className="district-phone__app-screen">
            <PhoneHeader title="Messages" backLabel="Home" onBack={onHome} action={<button type="button" className="district-phone__header-action" aria-label="New message" onClick={() => setPicking(true)}>✎</button>} />
            <ul className="district-phone__list">
                {threads.map(candidate =>
                {
                    const last = lastConversationChat(candidate);
                    const participant = candidate.participant;

                    return (
                        <li key={candidate.threadId}>
                            <button type="button" className={`district-phone__row ${candidate.unread ? 'is-unread' : ''}`} aria-label={`${participant.name}${candidate.unread ? ', unread' : ''}`} onClick={() => onOpenThread(candidate.threadId)}>
                                <PhoneAvatar figure={participant.figure} name={participant.name} online={participant.online} isGroup={participant.id < 0} />
                                <span className="district-phone__row-text"><strong>{participant.name}</strong><small>{threadPreview(candidate, ownUserId)}</small></span>
                                <span className="district-phone__row-meta">{last && <small>{phoneTime(sentAt(last))}</small>}{candidate.unread && <i className="district-phone__dot" />}</span>
                            </button>
                        </li>
                    );
                })}
                {!threads.length && <li className="district-phone__empty">No conversations yet. Tap ✎ to message a friend.</li>}
            </ul>
        </div>
    );
};

const PhoneThread: FC<{ thread: MessengerThread; ownUserId: number; onBack: () => void }> = ({ thread, ownUserId, onBack }) =>
{
    const [text, setText] = useState('');
    const typingSent = useRef(false);
    const list = useRef<HTMLDivElement>(null);
    const { activeThread, setActiveThreadId, sendMessage, typingUserIds, sendTypingStatus } = useMessenger();
    const { getFriend, followFriend } = useFriends();
    const activeIdRef = useRef(0);
    const participant = thread.participant;
    const friend = participant.id > 0 ? getFriend(participant.id) : null;
    const online = friend?.online ?? participant.online;
    const chats = thread.groups.flatMap(group => group.chats);
    const lastOwnChat = [...chats].reverse().find(chat => chat.senderId === ownUserId && chat.type === MessengerThreadChat.CHAT);

    useEffect(() =>
    {
        activeIdRef.current = activeThread ? activeThread.threadId : -1;
    }, [activeThread]);

    // Viewing a thread makes it the messenger's active thread (marks it read); leaving releases it only if still ours.
    useEffect(() =>
    {
        setActiveThreadId(thread.threadId);

        return () =>
        {
            if (activeIdRef.current === thread.threadId) setActiveThreadId(-1);
        };
    }, [thread.threadId, setActiveThreadId]);

    useEffect(() =>
    {
        list.current?.scrollTo?.({ top: list.current.scrollHeight });
    }, [chats.length]);

    useEffect(() => () =>
    {
        if (typingSent.current) sendTypingStatus(participant.id, false);
    }, [participant.id, sendTypingStatus]);

    const updateText = (value: string) =>
    {
        setText(value);
        if (participant.id <= 0) return;
        const typing = value.length > 0;
        if (typing === typingSent.current) return;
        typingSent.current = typing;
        sendTypingStatus(participant.id, typing);
    };
    const send = () =>
    {
        const message = text.trim();
        if (!message) return;
        sendMessage(thread, ownUserId, message);
        updateText('');
    };
    const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) =>
    {
        if (event.key !== 'Enter' || event.nativeEvent.isComposing) return;
        event.preventDefault();
        send();
    };

    return (
        <div className="district-phone__app-screen is-thread">
            <header className="district-phone__header is-thread">
                <button type="button" className="district-phone__back" aria-label="Messages" onClick={onBack}>‹</button>
                <PhoneAvatar figure={participant.figure} name={participant.name} size={30} online={online} isGroup={participant.id < 0} />
                <span className="district-phone__row-text"><strong>{participant.name}</strong><small>{participant.id < 0 ? 'Group chat' : online ? 'Online' : 'Offline'}</small></span>
                {friend && online && friend.followingAllowed && <button type="button" className="district-phone__header-action" aria-label={`Go to ${participant.name}`} title="Go to" onClick={() => followFriend(friend)}>➜</button>}
            </header>
            <div className="district-phone__messages" ref={list} role="log" aria-live="polite">
                {chats.map(chat =>
                {
                    if (chat.type === MessengerThreadChat.STATUS_NOTIFICATION || chat.type === MessengerThreadChat.SECURITY_NOTIFICATION) return <p key={chat.id} className="district-phone__notice">{chat.message}</p>;
                    if (chat.type === MessengerThreadChat.ROOM_INVITE) return <div key={chat.id} className="district-phone__invite"><strong>Room invite</strong><span>{chat.message}</span></div>;

                    const own = chat.senderId === ownUserId;

                    return (
                        <div key={chat.id} className={`district-phone__bubble ${own ? 'is-own' : ''} ${chat.type === HABBICON ? 'is-sticker' : ''}`}>
                            {chat.type === HABBICON ? 'Sticker' : chat.message.trim()}
                        </div>
                    );
                })}
                {lastOwnChat?.status === MessengerThreadChat.READ && <small className="district-phone__receipt">Read</small>}
                {typingUserIds.includes(participant.id) && <small className="district-phone__typing">typing…</small>}
            </div>
            <div className="district-phone__composer">
                <input
                    value={text}
                    maxLength={MAX_MESSAGE_LENGTH}
                    placeholder="Message"
                    aria-label={`Message ${participant.name}`}
                    onChange={event => updateText(event.target.value)}
                    onKeyDown={onKeyDown} />
                <button type="button" className="district-phone__send" aria-label="Send" disabled={!text.trim()} onClick={send}>↑</button>
            </div>
        </div>
    );
};
