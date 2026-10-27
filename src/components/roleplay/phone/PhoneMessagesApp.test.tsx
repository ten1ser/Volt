import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MessengerFriend } from '../../../api/friends/MessengerFriend';
import { MessengerThread } from '../../../api/friends/MessengerThread';
import { MessengerThreadChat } from '../../../api/friends/MessengerThreadChat';
import { PhoneMessagesApp } from './PhoneMessagesApp';

const test = vi.hoisted(() => ({
    threads: [] as unknown[], active: null, typing: [] as number[],
    setActive: vi.fn(), send: vi.fn(), typingStatus: vi.fn(), follow: vi.fn(), getThread: vi.fn()
}));
vi.mock('@volt/renderer', () => ({ GetSessionDataManager: () => ({ userId: 1 }), MessengerMessageType: { Habbicon: 4 } }));
vi.mock('../../../api', async () => ({
    MessengerFriend: (await import('../../../api/friends/MessengerFriend')).MessengerFriend,
    MessengerThread: (await import('../../../api/friends/MessengerThread')).MessengerThread,
    MessengerThreadChat: (await import('../../../api/friends/MessengerThreadChat')).MessengerThreadChat
}));
vi.mock('../../../hooks', () => ({
    useMessenger: () => ({ visibleThreads: test.threads, activeThread: test.active, setActiveThreadId: test.setActive, sendMessage: test.send, typingUserIds: test.typing, sendTypingStatus: test.typingStatus, getMessageThread: test.getThread }),
    useFriends: () => ({ onlineFriends: [], offlineFriends: [], getFriend: () => null, followFriend: test.follow })
}));
vi.mock('../../../common/layout/LayoutAvatarImageView', () => ({ LayoutAvatarImageView: () => null }));

const friend = (id: number, name: string, online = true) =>
{
    const value = new MessengerFriend();
    value.id = id; value.name = name; value.online = online; value.figure = '';
    return value;
};
const conversation = (participant: MessengerFriend, lines: [number, string][], unread = false) =>
{
    const thread = new MessengerThread(participant);
    for (const [sender, text] of lines) thread.addMessage(sender, text);
    if (!unread) thread.setRead();
    return thread;
};

describe('Phone Messages app', () =>
{
    beforeEach(() =>
    {
        test.threads = []; test.active = null; test.typing = [];
        [test.setActive, test.send, test.typingStatus, test.follow, test.getThread].forEach(fn => fn.mockClear());
    });
    afterEach(cleanup);

    it('lists conversations with previews and opens one', () =>
    {
        const marco = conversation(friend(2, 'Marco'), [[1, 'see you at the bank']]);
        const kim = conversation(friend(3, 'Nurse Kim'), [[3, 'Want a shift?']], true);
        test.threads = [marco, kim];
        const onOpen = vi.fn();
        render(<PhoneMessagesApp threadId={0} onOpenThread={onOpen} onHome={vi.fn()} />);
        expect(screen.getByText('You: see you at the bank')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Nurse Kim, unread' }));
        expect(onOpen).toHaveBeenCalledWith(kim.threadId);
    });

    it('shows a hint when there are no conversations', () =>
    {
        render(<PhoneMessagesApp threadId={0} onOpenThread={vi.fn()} onHome={vi.fn()} />);
        expect(screen.getByText(/No conversations yet/)).toBeInTheDocument();
    });

    it('opens a thread as the active thread, sends with Enter and reports typing', () =>
    {
        const marco = conversation(friend(2, 'Marco'), [[2, 'hey'], [1, 'hi']]);
        marco.groups[1].chats[0].setStatus(MessengerThreadChat.READ);
        test.threads = [marco]; test.typing = [2];
        render(<PhoneMessagesApp threadId={marco.threadId} onOpenThread={vi.fn()} onHome={vi.fn()} />);
        expect(test.setActive).toHaveBeenCalledWith(marco.threadId);
        expect(screen.getByText('Read')).toBeInTheDocument();
        expect(screen.getByText('typing…')).toBeInTheDocument();
        const input = screen.getByRole('textbox', { name: 'Message Marco' });
        fireEvent.change(input, { target: { value: 'on my way' } });
        expect(test.typingStatus).toHaveBeenCalledWith(2, true);
        fireEvent.keyDown(input, { key: 'Enter' });
        expect(test.send).toHaveBeenCalledWith(marco, 1, 'on my way');
        expect(test.typingStatus).toHaveBeenLastCalledWith(2, false);
    });

    it('releases the active thread on leaving only while it is still the active one', () =>
    {
        const marco = conversation(friend(2, 'Marco'), [[2, 'hey']]);
        test.threads = [marco]; test.active = marco;
        const view = render(<PhoneMessagesApp threadId={marco.threadId} onOpenThread={vi.fn()} onHome={vi.fn()} />);
        view.unmount();
        expect(test.setActive).toHaveBeenLastCalledWith(-1);
    });
});
