import { GetRoomEngine, RoomChatSettings, RoomObjectCategory } from '@volt/renderer';
import { CSSProperties, FC, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ChatBubbleMessage, GetConfigurationValue } from '../../../../api';
import { useOnClickChat } from '../../../../hooks';
import { useSessionInfo } from '../../../../hooks/session/useSessionInfo';
import { ChatTextSize, getChatFontScale, getChatTextSize } from '../chat-input/chatTextSize';
import { measureBubbleVisualOffsets } from './chatBubbleMetrics';
import { getNativeChatCreation, getNativeChatGeometry } from './nativeChatScroller';
import { getNativeChatBaseFontSize, getNativeDefaultSkin, isDistrictPlainStyle, isNativeAnonymousStyle } from './nativeChatSkin';
import { NativeChatText } from './NativeChatText';

interface ChatWidgetMessageViewProps {
    chat: ChatBubbleMessage;
    makeRoom: (chat: ChatBubbleMessage, creationMode: number) => void;
    mode?: number;
    bubbleWidth?: number;
    showPointer?: boolean;
    layout?: 'room' | 'history';
}

export const ChatWidgetMessageView: FC<ChatWidgetMessageViewProps> = ({
    chat = null,
    makeRoom = null,
    mode = RoomChatSettings.CHAT_MODE_FREE_FLOW,
    bubbleWidth = RoomChatSettings.CHAT_BUBBLE_WIDTH_NORMAL,
    showPointer = true,
    layout = 'room'
}) => {
    const [creationMode] = useState(() => getNativeChatCreation(chat)?.mode ?? mode);
    const [isVisible, setIsVisible] = useState(false);
    const [isReady, setIsReady] = useState(false);
    const { chatFontScale } = useSessionInfo();
    const [chatTextSize] = useState<ChatTextSize>(() => chat.textSize ?? getChatTextSize(chatFontScale));
    useLayoutEffect(() => {
        chat.textSize ??= chatTextSize;
    }, [chat, chatTextSize]);
    const [faceSize, setFaceSize] = useState(() => {
        const size = GetConfigurationValue<boolean>('zoom.enabled', false) ? 25 : 50;

        return { width: size, height: size };
    });
    const [defaultSkin, setDefaultSkin] = useState<string>(null);
    const fontScale = getChatFontScale(chatTextSize);
    const anonymous = isNativeAnonymousStyle(chat.styleId);
    const plainRoomChat = layout === 'room' && isDistrictPlainStyle(chat.styleId);
    const elementRef = useRef<HTMLDivElement>(null);
    const makeRoomRef = useRef(makeRoom);
    const { onClickChat } = useOnClickChat();
    const formattedText = useMemo(() => `${chat.formattedText}`, [chat.formattedText]);

    const getBubbleWidth = useMemo(() => {
        // AIR's history factory always requests NORMAL (350), and ChatBubble
        // reserves 15 pixels before laying out its TextField and background.
        if (layout === 'history') return 'max-w-[335px]';
        switch (bubbleWidth) {
            case RoomChatSettings.CHAT_BUBBLE_WIDTH_NORMAL:
                return plainRoomChat ? 'max-w-[min(700px,calc(100vw_-_24px))]' : 'max-w-[350px]';
            case RoomChatSettings.CHAT_BUBBLE_WIDTH_THIN:
                return 'max-w-[240px]';
            case RoomChatSettings.CHAT_BUBBLE_WIDTH_WIDE:
                return 'max-w-[2000px]';
            default:
                return 'max-w-[350px]';
        }
    }, [bubbleWidth, layout, plainRoomChat]);

    useEffect(() => {
        const element = elementRef.current;
        if (!element) return;

        const { offsetWidth: width, offsetHeight: height } = element;
        const visualOffsets = measureBubbleVisualOffsets(element);

        chat.width = width;
        chat.height = height;
        chat.visualOffsetTop = visualOffsets.top;
        chat.visualOffsetBottom = visualOffsets.bottom;
        chat.elementRef = element;

        setIsReady(true);

        makeRoomRef.current?.(chat, creationMode);
    }, [
        chat,
        chat.formattedText,
        chatTextSize,
        isVisible,
        showPointer,
        creationMode
    ]);

    useEffect(() => {
        if (chat.styleId !== 0) return;
        let disposed = false;
        getNativeDefaultSkin(chat.color).then((skin) => {
            if (!disposed) setDefaultSkin(skin);
        });
        return () => { disposed = true; };
    }, [chat.styleId, chat.color]);

    useEffect(() => {
        makeRoomRef.current = makeRoom;
    }, [makeRoom]);

    useEffect(() => {
        const element = elementRef.current;

        if (!element || typeof ResizeObserver === 'undefined') return;

        const observer = new ResizeObserver(() => {
            const { offsetWidth: width, offsetHeight: height } = element;

            if (width === chat.width && height === chat.height) return;

            const visualOffsets = measureBubbleVisualOffsets(element);

            chat.width = width;
            chat.height = height;
            chat.visualOffsetTop = visualOffsets.top;
            chat.visualOffsetBottom = visualOffsets.bottom;

            if (makeRoomRef.current) makeRoomRef.current(chat, creationMode);
        });

        observer.observe(element);

        return () => observer.disconnect();
    }, [chat, creationMode]);

    useEffect(() => {
        return () => {
            chat.elementRef = null;
        };
    }, [chat]);

    useEffect(() => {
        if (!isReady || !chat || isVisible) return;

        makeRoomRef.current?.(chat, creationMode);
        setIsVisible(true);
    }, [chat, isReady, isVisible, creationMode]);

    const messageClassName = `message [overflow-wrap:anywhere] break-words${chat.type === 2 ? ' font-bold' : ''}`;
    const nativeTextWidth = layout === 'history' ? 291 : bubbleWidth === RoomChatSettings.CHAT_BUBBLE_WIDTH_THIN ? 196 : bubbleWidth === RoomChatSettings.CHAT_BUBBLE_WIDTH_WIDE ? 1956 : 306;
    // style_normal's tint mask ends before the 2px TextField gutter; shirt colour cannot alter the text surface.
    const nativeTextEnabled = !plainRoomChat && chat.styleId === 0 && fontScale === 1;

    return (
        <div
            ref={elementRef}
            className={`bubble-container native-room-bubble chat-text-size${plainRoomChat ? ' district-plain-chat' : ''} ${layout === 'history' ? 'native-history-bubble relative' : 'newbubblehe absolute'} ${isVisible ? 'visible' : 'invisible'} w-max select-none pointer-events-auto`}
            style={{ '--chat-text-size': `${getNativeChatBaseFontSize(chat.styleId) * fontScale}px`, transition: 'none' } as CSSProperties}
            onClick={() => {
                if (!anonymous) GetRoomEngine().selectRoomObject(chat.roomId, chat.senderId, RoomObjectCategory.UNIT);
            }}
        >
            <div
                className={`chat-bubble bubble-${chat.styleId} type-${chat.type} ${getBubbleWidth}${chat.type === 1 && !anonymous ? ' native-whisper' : ''} relative z-1 wrap-break-word`}
                style={chat.styleId === 0 && defaultSkin ? { borderImageSource: `url(${defaultSkin})` } : undefined}
            >
                <div className="user-container absolute overflow-hidden" style={{
                    left: Math.trunc(13 - faceSize.width / 2),
                    width: faceSize.width,
                    height: `min(${faceSize.height}px, 100%)`,
                    top: `max(1px, calc(12px - min(${faceSize.height}px, 100%) / 2))`
                }}>
                    {!anonymous && chat.imageUrl && chat.imageUrl.length > 0 && (
                        <img
                            alt=""
                            src={chat.imageUrl}
                            className="user-image absolute bottom-0 left-0 max-w-none"
                            style={{ width: faceSize.width, height: faceSize.height }}
                            onLoad={(event) => {
                                const imageScale = chat.imageScale || 1;

                                setFaceSize({
                                    width: event.currentTarget.naturalWidth / imageScale,
                                    height: event.currentTarget.naturalHeight / imageScale
                                });
                            }}
                        />
                    )}
                </div>
                <div className="chat-content" style={layout === 'history' && !getNativeChatGeometry(chat.styleId).unlimitedHeight
                    ? { maxHeight: Math.trunc(108 * fontScale), overflow: 'hidden' }
                    : undefined}>
                    {nativeTextEnabled && (
                        <NativeChatText
                            username={chat.hideUsername ? '' : chat.username}
                            html={formattedText}
                            type={chat.type}
                            anonymous={anonymous}
                            maxWidth={nativeTextWidth}
                            className={messageClassName}
                            onClick={onClickChat}
                        />
                    )}
                    {!nativeTextEnabled && (
                        <>
                            {!anonymous && !chat.hideUsername && <b className="username">{chat.username}: </b>}
                            <span className={messageClassName} dangerouslySetInnerHTML={{ __html: formattedText }} onClick={onClickChat} />
                        </>
                    )}
                </div>
                {showPointer && !anonymous && (
                    <div
                        className="pointer absolute w-[9px] h-[6px] bottom-[-5px]"
                        style={{ left: chat.styleId === 0 ? 'var(--chat-pointer-x, 28px)' : '50%' }}
                    />
                )}
            </div>
        </div>
    );
};
