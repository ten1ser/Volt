import { FC, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChatMessageTypeEnum, CreateLinkEvent, GetConfigurationValue, LocalizeText, RoomWidgetUpdateChatInputContentEvent } from '../../../../api';
import { Text } from '../../../../common';
import { useChatHelpButton, useChatInputWidget, useClientAccessLists, useRoom, useSessionInfo, useUiEvent, useUserDataSnapshot } from '../../../../hooks';
import { ChatInputHabbiconSelectorView } from './ChatInputHabbiconSelectorView';
import { ChatInputStyleSelectorView } from './ChatInputStyleSelectorView';
import { ChatStyleDefinition, getSelectableChatStyleIds } from './chatStyles';

export const ChatInputView: FC<{}> = (props) => {
    const [chatValue, setChatValue] = useState<string>('');
    const [portalTarget, setPortalTarget] = useState<HTMLElement>(null);
    const { chatStyleId = 0, updateChatStyleId = null } = useSessionInfo();
    const {
        selectedUsername = '',
        floodBlocked = false,
        floodBlockedSeconds = 0,
        setIsTyping = null,
        setIsIdle = null,
        sendChat = null
    } = useChatInputWidget();
    const { roomSession = null } = useRoom();
    const { chatStyleIds } = useClientAccessLists();
    const { clubLevel = 0, isAmbassador = false, securityLevel = 0 } = useUserDataSnapshot();
    const selectableChatStyleIds = useMemo(() => getSelectableChatStyleIds(
        GetConfigurationValue<ChatStyleDefinition[]>('chat.styles', []),
        chatStyleIds,
        GetConfigurationValue<string>('disabled.custom.chat.styles', ''),
        { hasClub: clubLevel > 0, isAmbassador, hasSecurity: securityLevel >= 4 }
    ), [ chatStyleIds, clubLevel, isAmbassador, securityLevel ]);
    const inputRef = useRef<HTMLInputElement>(null);
    const { isHelpButtonVisible, hoverRegionProps, helpButtonProps } = useChatHelpButton();

    const chatModeIdWhisper = useMemo(() => LocalizeText('widgets.chatinput.mode.whisper'), []);
    const chatModeIdShout = useMemo(() => LocalizeText('widgets.chatinput.mode.shout'), []);
    const chatModeIdSpeak = useMemo(() => LocalizeText('widgets.chatinput.mode.speak'), []);
    const maxChatLength = useMemo(() => GetConfigurationValue<number>('chat.input.maxlength', 100), []);

    const anotherControlHasFocus = useCallback(() => {
        const activeElement = document.activeElement;

        if (!activeElement) return false;

        if (inputRef && inputRef.current === activeElement) return false;

        return activeElement instanceof HTMLElement && !!activeElement.closest('input, textarea, select, button, a[href], [role="button"], [contenteditable="true"]');
    }, [inputRef]);

    const setInputFocus = useCallback(() => {
        inputRef.current.focus();

        inputRef.current.setSelectionRange(inputRef.current.value.length * 2, inputRef.current.value.length * 2);
    }, [inputRef]);

    const checkSpecialKeywordForInput = useCallback(() => {
        setChatValue((prevValue) => {
            if (prevValue !== chatModeIdWhisper || !selectedUsername.length) return prevValue;

            return `${prevValue} ${selectedUsername}`;
        });
    }, [selectedUsername, chatModeIdWhisper]);

    const sendChatValue = useCallback(
        (value: string, shiftKey: boolean = false) => {
            if (!value || value === '') return;

            let chatType = shiftKey ? ChatMessageTypeEnum.CHAT_SHOUT : ChatMessageTypeEnum.CHAT_DEFAULT;
            let text = value;

            const parts = text.split(' ');

            let recipientName = '';
            let append = '';

            switch (parts[0]) {
                case chatModeIdWhisper:
                    chatType = ChatMessageTypeEnum.CHAT_WHISPER;
                    recipientName = parts[1];
                    append = chatModeIdWhisper + ' ' + recipientName + ' ';

                    parts.shift();
                    parts.shift();
                    break;
                case chatModeIdShout:
                    chatType = ChatMessageTypeEnum.CHAT_SHOUT;

                    parts.shift();
                    break;
                case chatModeIdSpeak:
                    chatType = ChatMessageTypeEnum.CHAT_DEFAULT;

                    parts.shift();
                    break;
            }

            text = parts.join(' ');

            setIsTyping(false);
            setIsIdle(false);

            if (text.length <= maxChatLength) {
                if (/%CC%/g.test(encodeURIComponent(text))) {
                    setChatValue('');
                } else {
                    setChatValue('');
                    sendChat(text, chatType, recipientName, chatStyleId);
                }
            }

            setChatValue(append);
        },
        [chatModeIdWhisper, chatModeIdShout, chatModeIdSpeak, maxChatLength, chatStyleId, setIsTyping, setIsIdle, sendChat]
    );

    const updateChatInput = useCallback(
        (value: string) => {
            if (!value || !value.length) {
                setIsTyping(false);
            } else {
                setIsTyping(true);
                setIsIdle(true);
            }

            setChatValue(value);
        },
        [setIsTyping, setIsIdle]
    );

    const onKeyDownEvent = useCallback(
        (event: KeyboardEvent) => {
            if (event.defaultPrevented || event.key === 'Tab' || event.key === 'Escape' || floodBlocked || !inputRef.current || anotherControlHasFocus()) return;

            if (document.activeElement !== inputRef.current) setInputFocus();

            const value = (event.target as HTMLInputElement).value;

            switch (event.key) {
                case ' ':
                case 'Space':
                    checkSpecialKeywordForInput();
                    return;
                case 'NumpadEnter':
                case 'Enter':
                    sendChatValue(value, event.shiftKey);
                    return;
                case 'Backspace':
                    if (value) {
                        const parts = value.split(' ');

                        if (parts[0] === chatModeIdWhisper && parts.length === 3 && parts[2] === '') {
                            setChatValue('');
                        }
                    }
                    return;
            }
        },
        [floodBlocked, inputRef, chatModeIdWhisper, anotherControlHasFocus, setInputFocus, checkSpecialKeywordForInput, sendChatValue]
    );

    useUiEvent<RoomWidgetUpdateChatInputContentEvent>(RoomWidgetUpdateChatInputContentEvent.CHAT_INPUT_CONTENT, (event) => {
        switch (event.chatMode) {
            case RoomWidgetUpdateChatInputContentEvent.TEXT:
                setChatValue(event.userName);
                inputRef.current?.focus();
                return;
            case RoomWidgetUpdateChatInputContentEvent.WHISPER: {
                setChatValue(`${chatModeIdWhisper} ${event.userName} `);
                return;
            }
            case RoomWidgetUpdateChatInputContentEvent.SHOUT:
                return;
        }
    });


    useEffect(() => {
        document.body.addEventListener('keydown', onKeyDownEvent);

        return () => {
            document.body.removeEventListener('keydown', onKeyDownEvent);
        };
    }, [onKeyDownEvent]);

    useEffect(() => {
        if (!inputRef.current) return;

        inputRef.current.parentElement.dataset.value = chatValue;
    }, [chatValue]);

    useEffect(() => {
        if (!roomSession) return;

        if (portalTarget && portalTarget.isConnected) return;

        let frame = 0;

        const locate = () => {
            const target = document.getElementById('toolbar-chat-input-container');

            if (target) {
                setPortalTarget(target);
                return;
            }

            frame = window.requestAnimationFrame(locate);
        };

        locate();

        return () => window.cancelAnimationFrame(frame);
    }, [roomSession, portalTarget]);

    if (!roomSession || roomSession.isSpectator || !portalTarget) return null;

    return createPortal(
        // justify-start, not between: the style trigger overlaps the bubble's pointed
        // left cap via a negative margin. With justify-between, hiding an optional
        // trailing button (habbicons disabled) redistributes the slack between the
        // trigger and the bubble, exposing the cap and opening a gap.
        <div className="volt-chat-input-container swf-chat-input relative flex w-full items-center justify-start overflow-visible">
            <ChatInputStyleSelectorView chatStyleId={chatStyleId} chatStyleIds={selectableChatStyleIds} selectChatStyleId={updateChatStyleId} />
            {!floodBlocked && (
                <div className="flex-1 items-center input-sizer swf-chat-input-sizer" {...hoverRegionProps}>
                    <input
                        ref={inputRef}
                        className="swf-chat-input-field w-full border-none bg-transparent"
                        maxLength={maxChatLength}
                        placeholder={LocalizeText('widgets.chatinput.default')}
                        type="text"
                        value={chatValue}
                        onChange={(event) => updateChatInput(event.target.value)}
                        onMouseDown={(event) => setInputFocus()}
                    />
                </div>
            )}
            {floodBlocked && (
                <div className="swf-chat-flood flex min-w-0 flex-1 items-center" {...hoverRegionProps}>
                    <Text variant="danger" className="w-full truncate whitespace-nowrap text-[0.8rem] font-bold leading-none">
                        {LocalizeText('chat.input.alert.flood', ['time'], [floodBlockedSeconds.toString()])}
                    </Text>
                </div>
            )}
            {/* AIR builds `helpbutton` hidden and shows it only while the bubble or the button is hovered. */}
            {isHelpButtonVisible && (
                <button
                    aria-label={LocalizeText('chat.input.help')}
                    className="swf-chat-help-button"
                    type="button"
                    onClick={() => CreateLinkEvent('habbopages/chat/commands')}
                    {...helpButtonProps}
                />
            )}
            <ChatInputHabbiconSelectorView />
        </div>,
        portalTarget
    );
};
