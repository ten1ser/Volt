import { expect, it } from 'vitest';
import type { ChatBubbleMessage } from '../../../../api';
import { getNativeChatColliderHeight } from './nativeChatScroller';

const chat = (styleId: number, height: number) => ({ styleId, height }) as ChatBubbleMessage;

it('stacks DistrictRP plain bubbles 2px apart instead of tucking them under each other', () => {
    // RP action colours (4 combat, 11 items) and ordinary talk: full height, rows parted by collider + 1px.
    for (const styleId of [0, 4, 11]) expect(getNativeChatColliderHeight(chat(styleId, 28), 1) + 1).toBe(30);
    expect(getNativeChatColliderHeight(chat(4, 140), 1)).toBe(141);
});

it('keeps the native collider for the other styles', () => {
    expect(getNativeChatColliderHeight(chat(1, 28), 1)).toBe(19);
    expect(getNativeChatColliderHeight(chat(2, 140), 1)).toBe(132);
    expect(getNativeChatColliderHeight(chat(9, 140), 1)).toBe(94);
});
