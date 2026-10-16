import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatInputView } from './ChatInputView';

const mocks = vi.hoisted(() => ({
    createLinkEvent: vi.fn(),
    floodBlocked: false,
    sendChat: vi.fn(),
    selectedUsername: 'Alice'
}));

const TEXTS: Record<string, string> = {
    'widgets.chatinput.mode.whisper': ':tell',
    'widgets.chatinput.mode.shout': ':shout',
    'widgets.chatinput.mode.speak': ':speak',
    'widgets.chatinput.default': 'Click here to chat',
    'chat.input.help': 'Chat help'
};

vi.mock('../../../../api', () => ({
    ChatMessageTypeEnum: { CHAT_DEFAULT: 0, CHAT_WHISPER: 1, CHAT_SHOUT: 2 },
    CreateLinkEvent: mocks.createLinkEvent,
    GetConfigurationValue: (_key: string, value: unknown) => value,
    LocalizeText: (key: string) => TEXTS[key] ?? key,
    RoomWidgetUpdateChatInputContentEvent: { CHAT_INPUT_CONTENT: 'RWUCICE_CHAT_INPUT_CONTENT', TEXT: 'text', WHISPER: 'whisper', SHOUT: 'shout' }
}));

vi.mock('../../../../common', () => ({
    Text: ({ children }: { children: unknown }) => <span>{children as string}</span>
}));

vi.mock('../../../../hooks', async () => {
    const { useChatHelpButton } = await vi.importActual<typeof import('../../../../hooks/rooms/widgets/useChatHelpButton')>(
        '../../../../hooks/rooms/widgets/useChatHelpButton'
    );

    return {
        useChatHelpButton,
        useChatInputWidget: () => ({
            selectedUsername: mocks.selectedUsername,
            floodBlocked: mocks.floodBlocked,
            floodBlockedSeconds: 30,
            setIsTyping: () => {},
            setIsIdle: () => {},
            sendChat: mocks.sendChat
        }),
        useClientAccessLists: () => ({ chatStyleIds: [] }),
        useRoom: () => ({ roomSession: { isSpectator: false } }),
        useSessionInfo: () => ({ chatStyleId: 0, updateChatStyleId: () => {} }),
        useUiEvent: () => {},
        useUserDataSnapshot: () => ({ clubLevel: 0, isAmbassador: false, securityLevel: 0 })
    };
});

vi.mock('./ChatInputHabbiconSelectorView', () => ({ ChatInputHabbiconSelectorView: () => null }));
vi.mock('./ChatInputStyleSelectorView', () => ({ ChatInputStyleSelectorView: () => null }));

const renderChatInput = () => {
    const target = document.createElement('div');

    target.id = 'toolbar-chat-input-container';
    document.body.appendChild(target);

    const view = render(<ChatInputView />);

    return { ...view, target };
};

const getInput = () => screen.getByPlaceholderText('Click here to chat') as HTMLInputElement;
const queryHelpButton = () => screen.queryByRole('button', { name: 'Chat help' });

beforeEach(() => {
    vi.useFakeTimers();
});

afterEach(() => {
    cleanup();
    vi.useRealTimers();
    document.getElementById('toolbar-chat-input-container')?.remove();
    mocks.createLinkEvent.mockClear();
    mocks.sendChat.mockClear();
    mocks.floodBlocked = false;
});

describe('ChatInputView help button (AIR helpbutton)', () => {
    it('is hidden until the pointer is over the input bubble', () => {
        const { target } = renderChatInput();

        expect(queryHelpButton()).toBeNull();

        fireEvent.mouseEnter(target.querySelector('.swf-chat-input-sizer'));

        expect(queryHelpButton()).toBeInTheDocument();
    });

    it('hides 400 ms after the pointer leaves the bubble', () => {
        const { target } = renderChatInput();
        const bubble = target.querySelector('.swf-chat-input-sizer');

        fireEvent.mouseEnter(bubble);
        fireEvent.mouseLeave(bubble);
        act(() => vi.advanceTimersByTime(399));

        expect(queryHelpButton()).toBeInTheDocument();

        act(() => vi.advanceTimersByTime(1));

        expect(queryHelpButton()).toBeNull();
    });

    it('stays while the pointer is on the button and opens the chat commands page on click', () => {
        const { target } = renderChatInput();
        const bubble = target.querySelector('.swf-chat-input-sizer');

        fireEvent.mouseEnter(bubble);
        fireEvent.mouseLeave(bubble);
        fireEvent.mouseEnter(queryHelpButton());
        act(() => vi.advanceTimersByTime(1000));

        expect(queryHelpButton()).toBeInTheDocument();

        fireEvent.click(queryHelpButton());

        expect(mocks.createLinkEvent).toHaveBeenCalledWith('habbopages/chat/commands');

        fireEvent.mouseLeave(queryHelpButton());
        act(() => vi.advanceTimersByTime(400));

        expect(queryHelpButton()).toBeNull();
    });

    it('uses the flood message box as the hover region while chat is blocked', () => {
        mocks.floodBlocked = true;

        const { target } = renderChatInput();

        fireEvent.mouseEnter(target.querySelector('.swf-chat-flood'));

        expect(queryHelpButton()).toBeInTheDocument();
    });
});

describe('ChatInputView keyboard (AIR RoomChatInputView, no command lister)', () => {
    it('leaves focused HUD buttons and their keyboard actions alone', () =>
    {
        renderChatInput();
        const controls = render(<button type="button">Tools</button>);
        const button = screen.getByRole('button', { name: 'Tools' });
        button.focus();
        fireEvent.keyDown(button, { key: 'Enter' });
        expect(button).toHaveFocus();
        fireEvent.keyDown(button, { key: ' ' });
        expect(button).toHaveFocus();
        expect(mocks.sendChat).not.toHaveBeenCalled();
        controls.unmount();
    });

    it('does not redirect Tab or Escape from the page into chat', () =>
    {
        renderChatInput();
        getInput().blur();
        fireEvent.keyDown(document.body, { key: 'Tab' });
        expect(getInput()).not.toHaveFocus();
        fireEvent.keyDown(document.body, { key: 'Escape' });
        expect(getInput()).not.toHaveFocus();
    });

    it('shows no command popup when typing ":" and lets Enter send it as chat', () => {
        const { target } = renderChatInput();
        const input = getInput();

        fireEvent.change(input, { target: { value: ':' } });

        expect(input.value).toBe(':');
        expect(screen.queryByText(': Command')).toBeNull();
        expect(target.querySelector('.chat-input-command-popover')).toBeNull();

        const arrowDown = fireEvent.keyDown(input, { key: 'ArrowDown' });
        const tab = fireEvent.keyDown(input, { key: 'Tab' });

        expect(arrowDown).toBe(true);
        expect(tab).toBe(true);

        fireEvent.keyDown(input, { key: 'Enter' });

        expect(mocks.sendChat).toHaveBeenCalledWith(':', 0, '', 0);
    });

    it('sends on Enter and shouts on Shift+Enter', () => {
        renderChatInput();
        const input = getInput();

        fireEvent.change(input, { target: { value: 'hello' } });
        fireEvent.keyDown(input, { key: 'Enter' });

        expect(mocks.sendChat).toHaveBeenLastCalledWith('hello', 0, '', 0);
        expect(input.value).toBe('');

        fireEvent.change(input, { target: { value: 'loud' } });
        fireEvent.keyDown(input, { key: 'Enter', shiftKey: true });

        expect(mocks.sendChat).toHaveBeenLastCalledWith('loud', 2, '', 0);
    });

    it('appends the selected user after exactly ":tell" on Space', () => {
        renderChatInput();
        const input = getInput();

        fireEvent.change(input, { target: { value: ':tell' } });
        fireEvent.keyDown(input, { key: ' ' });

        expect(input.value).toBe(':tell Alice');

        fireEvent.change(input, { target: { value: ':tellx' } });
        fireEvent.keyDown(input, { key: ' ' });

        expect(input.value).toBe(':tellx');
    });

    it('clears ":tell name " on Backspace when nothing follows the name', () => {
        renderChatInput();
        const input = getInput();

        fireEvent.change(input, { target: { value: ':tell Alice ' } });
        fireEvent.keyDown(input, { key: 'Backspace' });

        expect(input.value).toBe('');

        fireEvent.change(input, { target: { value: ':tell Alice hi' } });
        fireEvent.keyDown(input, { key: 'Backspace' });

        expect(input.value).toBe(':tell Alice hi');
    });
});
