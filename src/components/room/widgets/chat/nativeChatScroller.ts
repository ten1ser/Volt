import type { ChatBubbleMessage } from '../../../../api';
import { isDistrictPlainStyle } from './nativeChatSkin';

interface ChatCreation { mode: number; timestamp: number; }
const creations = new WeakMap<ChatBubbleMessage, ChatCreation>();
let previousArrival = -1;
let arrivalOffset = 0;
export const captureNativeChatCreation = (chat: ChatBubbleMessage, mode: number) => {
    const now = Date.now();
    arrivalOffset = now === previousArrival ? arrivalOffset + 1 : 0;
    previousArrival = now;
    creations.set(chat, { mode, timestamp: now + arrivalOffset });
};
export const getNativeChatCreation = (chat: ChatBubbleMessage): ChatCreation => creations.get(chat);

interface Rect { x: number; y: number; width: number; height: number; }
export interface NativeChatGeometry { overlap: Rect; unlimitedHeight: boolean; }

// v75 HabboFreeFlowChatCom/chatstyles_xml and style_*_regpoints.
const STYLE_GEOMETRY: Record<number, NativeChatGeometry> = {
    0: { overlap: { x: 0, y: -2, width: 0, height: 0 }, unlimitedHeight: false },
    1: { overlap: { x: 0, y: -1, width: 0, height: 0 }, unlimitedHeight: true },
    2: { overlap: { x: 0, y: -2, width: 0, height: 0 }, unlimitedHeight: true },
    3: { overlap: { x: 0, y: -2, width: 0, height: 0 }, unlimitedHeight: false },
    4: { overlap: { x: 0, y: -2, width: 0, height: 0 }, unlimitedHeight: false },
    5: { overlap: { x: 0, y: -2, width: 0, height: 0 }, unlimitedHeight: false },
    6: { overlap: { x: 0, y: -2, width: 0, height: 0 }, unlimitedHeight: false },
    7: { overlap: { x: 0, y: -2, width: 0, height: 0 }, unlimitedHeight: false },
    8: { overlap: { x: 0, y: 2, width: 0, height: 0 }, unlimitedHeight: true },
    9: { overlap: { x: 6, y: 4, width: 5, height: 0 }, unlimitedHeight: false },
    10: { overlap: { x: 2, y: 8, width: 3, height: 2 }, unlimitedHeight: false },
    11: { overlap: { x: 0, y: -2, width: 0, height: 0 }, unlimitedHeight: false },
    12: { overlap: { x: 0, y: -2, width: 0, height: 0 }, unlimitedHeight: false },
    13: { overlap: { x: 0, y: -2, width: 0, height: 0 }, unlimitedHeight: false },
    14: { overlap: { x: 0, y: -2, width: 0, height: 0 }, unlimitedHeight: false },
    15: { overlap: { x: 0, y: -2, width: 0, height: 0 }, unlimitedHeight: false },
    16: { overlap: { x: 1, y: 1, width: 0, height: 0 }, unlimitedHeight: false },
    17: { overlap: { x: 5, y: 5, width: 0, height: 2 }, unlimitedHeight: false },
    19: { overlap: { x: 3, y: 1, width: 0, height: 0 }, unlimitedHeight: false },
    20: { overlap: { x: 3, y: 1, width: 0, height: 0 }, unlimitedHeight: false },
    21: { overlap: { x: 0, y: 9, width: 0, height: 0 }, unlimitedHeight: false },
    22: { overlap: { x: 5, y: 4, width: 0, height: 0 }, unlimitedHeight: false },
    23: { overlap: { x: 3, y: 2, width: 0, height: 0 }, unlimitedHeight: false },
    24: { overlap: { x: 8, y: 3, width: 0, height: 0 }, unlimitedHeight: false },
    25: { overlap: { x: 0, y: -2, width: 0, height: 0 }, unlimitedHeight: false },
    26: { overlap: { x: 2, y: -1, width: 0, height: 0 }, unlimitedHeight: false },
    27: { overlap: { x: 7, y: 5, width: 0, height: 0 }, unlimitedHeight: false },
    28: { overlap: { x: 0, y: -2, width: 0, height: 0 }, unlimitedHeight: true },
    29: { overlap: { x: 2, y: -1, width: 0, height: 0 }, unlimitedHeight: false },
    30: { overlap: { x: 0, y: -2, width: 0, height: 0 }, unlimitedHeight: true },
    31: { overlap: { x: 0, y: -2, width: 0, height: 0 }, unlimitedHeight: true },
    32: { overlap: { x: 0, y: -2, width: 0, height: 0 }, unlimitedHeight: true },
    33: { overlap: { x: 0, y: -2, width: 0, height: -4 }, unlimitedHeight: true },
    34: { overlap: { x: 0, y: -2, width: 0, height: -4 }, unlimitedHeight: true },
    35: { overlap: { x: 0, y: 0, width: 0, height: 0 }, unlimitedHeight: true },
    36: { overlap: { x: 0, y: -2, width: 0, height: 0 }, unlimitedHeight: true },
    37: { overlap: { x: 3, y: 2, width: 0, height: 0 }, unlimitedHeight: false },
    38: { overlap: { x: 0, y: -2, width: 0, height: 0 }, unlimitedHeight: true },
    120: { overlap: { x: 2, y: 8, width: 3, height: 2 }, unlimitedHeight: true },
    121: { overlap: { x: 2, y: 8, width: 3, height: 2 }, unlimitedHeight: true },
    130: { overlap: { x: 2, y: 1, width: 0, height: 0 }, unlimitedHeight: true },
    131: { overlap: { x: 2, y: 1, width: 0, height: 0 }, unlimitedHeight: true },
    132: { overlap: { x: 2, y: 1, width: 0, height: 0 }, unlimitedHeight: true },
    133: { overlap: { x: 2, y: 1, width: 0, height: 0 }, unlimitedHeight: true },
    200: { overlap: { x: 0, y: -2, width: 0, height: -4 }, unlimitedHeight: true },
    201: { overlap: { x: 0, y: -2, width: 0, height: -4 }, unlimitedHeight: true },
    202: { overlap: { x: 0, y: -2, width: 0, height: -4 }, unlimitedHeight: true },
    210: { overlap: { x: 0, y: -2, width: 0, height: -4 }, unlimitedHeight: true },
    211: { overlap: { x: 0, y: -2, width: 0, height: -4 }, unlimitedHeight: true },
    212: { overlap: { x: 0, y: -2, width: 0, height: -4 }, unlimitedHeight: true },
    220: { overlap: { x: 0, y: -2, width: 0, height: -4 }, unlimitedHeight: true },
    221: { overlap: { x: 0, y: -2, width: 0, height: -4 }, unlimitedHeight: true },
    222: { overlap: { x: 0, y: -2, width: 0, height: -4 }, unlimitedHeight: true },
    223: { overlap: { x: 0, y: -2, width: 0, height: -4 }, unlimitedHeight: true },
    224: { overlap: { x: 0, y: -2, width: 0, height: -4 }, unlimitedHeight: true },
    225: { overlap: { x: 0, y: -2, width: 0, height: -4 }, unlimitedHeight: true },
    226: { overlap: { x: 0, y: -2, width: 0, height: -4 }, unlimitedHeight: true },
    227: { overlap: { x: 0, y: -2, width: 0, height: -4 }, unlimitedHeight: true },
    228: { overlap: { x: 0, y: -2, width: 0, height: -4 }, unlimitedHeight: true },
    229: { overlap: { x: 0, y: -2, width: 0, height: -4 }, unlimitedHeight: true },
    250: { overlap: { x: 0, y: -2, width: 0, height: -4 }, unlimitedHeight: true },
    251: { overlap: { x: 0, y: -2, width: 0, height: -4 }, unlimitedHeight: true },
    252: { overlap: { x: 0, y: -2, width: 0, height: -4 }, unlimitedHeight: true },
    1000: { overlap: { x: 0, y: -2, width: 0, height: 0 }, unlimitedHeight: false },
    1001: { overlap: { x: 0, y: -2, width: 0, height: 0 }, unlimitedHeight: false },
    1002: { overlap: { x: 0, y: -2, width: 0, height: 0 }, unlimitedHeight: false },
    1003: { overlap: { x: 0, y: -2, width: 0, height: 0 }, unlimitedHeight: false },
    1004: { overlap: { x: 0, y: -2, width: 0, height: 0 }, unlimitedHeight: false },
    1005: { overlap: { x: 0, y: -2, width: 0, height: 0 }, unlimitedHeight: false },
    1006: { overlap: { x: 0, y: -2, width: 0, height: 0 }, unlimitedHeight: false },
    1007: { overlap: { x: 0, y: -2, width: 0, height: 0 }, unlimitedHeight: false },
    1010: { overlap: { x: 0, y: -2, width: 0, height: 0 }, unlimitedHeight: false },
    1011: { overlap: { x: 0, y: 5, width: 3, height: 0 }, unlimitedHeight: false },
    1012: { overlap: { x: 0, y: 5, width: 3, height: 0 }, unlimitedHeight: false },
    1013: { overlap: { x: -1, y: 2, width: 1, height: 0 }, unlimitedHeight: false },
    1014: { overlap: { x: -1, y: 2, width: 1, height: 0 }, unlimitedHeight: false },
    1015: { overlap: { x: 0, y: -2, width: 0, height: 0 }, unlimitedHeight: false },
    1016: { overlap: { x: 0, y: -2, width: 0, height: 0 }, unlimitedHeight: false },
    1017: { overlap: { x: 0, y: -2, width: 0, height: 0 }, unlimitedHeight: false },
    1018: { overlap: { x: 0, y: -2, width: 0, height: 3 }, unlimitedHeight: false },
    1019: { overlap: { x: 0, y: -2, width: 0, height: 2 }, unlimitedHeight: false },
    1020: { overlap: { x: 3, y: 2, width: 5, height: 0 }, unlimitedHeight: false },
    1021: { overlap: { x: 0, y: -3, width: 0, height: 0 }, unlimitedHeight: false },
    1022: { overlap: { x: 0, y: -2, width: 0, height: 0 }, unlimitedHeight: false },
    1023: { overlap: { x: 0, y: -2, width: 0, height: 0 }, unlimitedHeight: false },
    1024: { overlap: { x: 2, y: 2, width: 3, height: 0 }, unlimitedHeight: false },
    1025: { overlap: { x: 2, y: 2, width: 3, height: 0 }, unlimitedHeight: false },
    1026: { overlap: { x: 0, y: -4, width: 0, height: 0 }, unlimitedHeight: false },
    1027: { overlap: { x: 0, y: -2, width: 0, height: 0 }, unlimitedHeight: false },
    10000: { overlap: { x: 0, y: -2, width: 0, height: 0 }, unlimitedHeight: false },
};
export const getNativeChatGeometry = (styleId: number): NativeChatGeometry => STYLE_GEOMETRY[styleId] ?? STYLE_GEOMETRY[0];
// Native collider: the measured height less 10, so stacked v75 bubbles tuck under each other. The taller DistrictRP
// plain bubble would hide 7px of the line above that way, so its collider is the full height plus a 2px gap.
const DISTRICT_PLAIN_GAP = 2;
export const getNativeChatColliderHeight = (chat: ChatBubbleMessage, fontScale: number): number => {
    // The collision pass parts rows by the collider height plus 1px.
    if (isDistrictPlainStyle(chat.styleId)) return chat.height + DISTRICT_PLAIN_GAP - 1;
    const geometry = getNativeChatGeometry(chat.styleId);
    const height = geometry.unlimitedHeight ? chat.height : Math.min(Math.trunc(108 * fontScale), chat.height);
    return height - 10 - geometry.overlap.y - geometry.overlap.height;
};
const intersects = (a: Rect, b: Rect) => a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;

interface Collider {
    chat: ChatBubbleMessage | null;
    body: Rect;
    extended: Rect | null;
    overlap: Rect;
    offset: number;
    narrow: boolean;
    line: boolean;
    spacer: boolean;
    timestamp: number;
    dx: number;
    dy: number;
    clipped: boolean;
    pendingImmediate: boolean;
    writtenLeft: number;
    writtenTop: number;
    visualX: number;
    visualY: number;
    targetX: number;
    targetY: number;
    startX: number;
    startY: number;
    moveStarted: number;
    created: number;
}

// Ports v75 v2/qm/O5/w2. Collider type and visual clamp are captured at creation;
// the active mode selects the simulation branch without rebuilding older colliders.
export class NativeChatScroller {
    private bubbles: Collider[] = [];
    private clock = 0;
    private lastScroll = 0;
    private lastCleanup = 0;
    private line = false;
    private speed = 6000;
    private height = 0;
    private viewportWidth = 0;

    private fontScale = 1;

    configure(mode: number, speed: number, fontScale = 1) {
        this.line = mode === 1;
        this.speed = speed;
        if (this.fontScale !== fontScale) {
            this.fontScale = fontScale;
            for (const bubble of this.bubbles) {
                if (!bubble.chat) continue;
                bubble.body.height = getNativeChatColliderHeight(bubble.chat, fontScale);
            }
        }
    }

    resize(height: number, viewportWidth: number) {
        const delta = height - this.height;
        this.height = height;
        this.viewportWidth = viewportWidth;
        for (const bubble of this.bubbles) this.moveY(bubble, delta);
        this.publish(true);
    }

    clear() { this.bubbles = []; }

    register(chat: ChatBubbleMessage, mode: number) {
        const existing = this.bubbles.find((bubble) => bubble.chat === chat);
        const geometry = getNativeChatGeometry(chat.styleId);
        const overlap = geometry.overlap;
        const width = chat.width - overlap.x - overlap.width;
        const height = getNativeChatColliderHeight(chat, this.fontScale);
        if (existing) {
            // A remeasured bubble keeps its centred reflow without changing collider mode.
            existing.body.x += (existing.body.width - width) / 2;
            if (existing.narrow) existing.offset += (width - existing.body.width) / 2;
            existing.body.width = width;
            existing.body.height = height;
            if (existing.extended) {
                existing.extended.x = existing.body.x + existing.offset;
                existing.extended.width = existing.narrow ? 240 : width + 5000;
                existing.extended.height = height / 2;
            }
            // A custom chat-window toggle may remount the same message DOM.
            chat.left = existing.writtenLeft;
            chat.top = existing.writtenTop;
            if (chat.elementRef) chat.elementRef.style.visibility = this.clock - existing.created > 150 ? 'visible' : 'hidden';
            return;
        }
        const line = mode === 1;
        const narrow = !line && chat.width < 240;
        const body = { x: chat.location.x - width / 2, y: this.height, width, height };
        const offset = narrow ? -(240 - width) / 2 : -2500;
        const bubble: Collider = {
            chat, body, overlap, offset, narrow, line, spacer: false,
            extended: line || narrow ? { x: body.x + offset, y: body.y, width: narrow ? 240 : width + 5000, height: height / 2 } : null,
            timestamp: getNativeChatCreation(chat)?.timestamp ?? Date.now(), dx: 0, dy: 0, clipped: false, pendingImmediate: false, writtenLeft: chat.left, writtenTop: chat.top,
            visualX: body.x - overlap.x, visualY: body.y - overlap.y, targetX: body.x - overlap.x, targetY: body.y - overlap.y, startX: body.x - overlap.x, startY: body.y - overlap.y, moveStarted: this.clock, created: this.clock
        };
        let initialX = body.x - 2 * overlap.x;
        if (!line) {
            for (let iteration = 0; iteration < 10; iteration++) {
                let impulse = 0;
                for (const other of this.bubbles) impulse += this.repulsion(bubble, other, 60, 40);
                this.moveX(bubble, impulse);
            }
            const anchor = chat.location.x;
            let nextX = body.x;
            if (body.x > anchor - 15) {
                nextX = anchor - 15;
                if (bubble.extended) bubble.offset = Math.min(0, bubble.offset + body.x - nextX);
            } else if (body.x + body.width < anchor + 15) {
                nextX = anchor - body.width + 15;
                if (bubble.extended) bubble.offset = Math.max(-(bubble.extended.width - body.width), bubble.offset + body.x - nextX);
            }
            // Native final anchor constraint passes through the damped x setter.
            this.moveX(bubble, nextX - body.x);
            initialX = nextX - overlap.x;
        }
        bubble.visualX = bubble.targetX = bubble.startX = initialX;
        bubble.visualY = bubble.targetY = bubble.startY = body.y - overlap.y;
        this.bubbles.push(bubble);
        this.writeVisual(bubble, initialX, body.y - overlap.y);
        if (chat.elementRef) chat.elementRef.style.visibility = 'hidden';
        if (line) this.lastScroll = this.clock;
    }

    private moveX(bubble: Collider, amount: number) {
        bubble.body.x += amount * 0.9;
        if (bubble.extended) bubble.extended.x = bubble.body.x + bubble.offset;
    }
    private moveY(bubble: Collider, amount: number) {
        bubble.body.y += amount;
        if (bubble.extended) bubble.extended.y = bubble.body.y;
    }
    private repulsion(a: Collider, b: Collider, strength = 1, maximum = 100) {
        const distance = Math.abs(b.body.x + b.body.width / 2 - a.body.x - a.body.width / 2);
        return distance > 380 || distance < 1 ? 0 : (a.body.x + a.body.width / 2 <= b.body.x + b.body.width / 2 ? 1 : -1) * Math.min(distance, strength / distance, maximum);
    }
    private collision(a: Collider, b: Collider) {
        return intersects(a.body, b.body) || (a.extended ? intersects(a.extended, b.extended ?? b.body) : b.extended ? intersects(a.body, b.extended) : false);
    }
    private simulate() {
        for (let iteration = 0; iteration < 20; iteration++) {
            for (const bubble of this.bubbles) { bubble.dx = 0; bubble.dy = 0; }
            let collided = false;
            // Native contacts discard reverse pairs; i<j preserves its accepted row-major order.
            // Collider rectangles remain unchanged until the apply phase below.
            for (let firstIndex = 0; firstIndex < this.bubbles.length; firstIndex++) {
                const first = this.bubbles[firstIndex];
                for (let secondIndex = firstIndex + 1; secondIndex < this.bubbles.length; secondIndex++) {
                    const second = this.bubbles[secondIndex];
                    if (!this.collision(first, second)) continue;
                    collided = true;
                    const top = first.body.y < second.body.y ? first : second;
                    const bottom = first.body.y >= second.body.y ? first : second;
                    const older = first.timestamp < second.timestamp ? first : second;
                    const sameY = Math.trunc(first.body.y) === Math.trunc(second.body.y);
                    if (this.line) {
                        if (sameY) older.dy -= (older.extended ?? older.body).height;
                        else {
                            const bounds = intersects(first.body, second.body) ? top.body : top.extended ?? top.body;
                            top.dy -= bounds.y + bounds.height - bottom.body.y + 1;
                        }
                    } else {
                        const left = first.body.x < second.body.x ? first : second;
                        const right = first.body.x >= second.body.x ? first : second;
                        const leftX = left.body.x + (left.narrow ? left.offset : 0);
                        const rightX = right.body.x + (right.narrow ? right.offset : 0);
                        const width = left.narrow ? (left.extended ?? left.body).width : left.body.width;
                        const overlap = Math.abs(leftX + width - rightX) / 2;
                        if (overlap <= 15) { left.dx -= overlap; right.dx += overlap + 1; }
                        else if (sameY) older.dy -= older.body.height;
                        else top.dy -= top.body.y + top.body.height - bottom.body.y + 1;
                    }
                }
            }
            if (!collided) break;
            for (const bubble of this.bubbles) { this.moveX(bubble, bubble.dx); this.moveY(bubble, Math.max(bubble.dy, -8)); }
        }
    }

    advance(elapsed: number, chats: readonly ChatBubbleMessage[]): number[] {
        this.clock += elapsed;
        const live = new Set(chats);
        this.bubbles = this.bubbles.filter((bubble) => !bubble.chat || live.has(bubble.chat));
        for (const bubble of this.bubbles) {
            // Room drag mutates message coordinates outside the scroller.
            if (!bubble.chat) continue;
            const deltaX = bubble.chat.left - bubble.writtenLeft;
            bubble.body.x += deltaX;
            if (bubble.extended) bubble.extended.x += deltaX;
            if (deltaX) {
                bubble.visualX += deltaX;
                // v75 v2 retains this flag until the post-simulation target is published.
                bubble.pendingImmediate = true;
            } else {
                if (bubble.visualX !== bubble.targetX || bubble.visualY !== bubble.targetY) {
                    const elapsedMove = this.clock - bubble.moveStarted;
                    if (elapsedMove > 0 && elapsedMove < 150) {
                        bubble.visualX = Math.trunc(bubble.startX + elapsedMove * (bubble.targetX - bubble.startX) / 150);
                        bubble.visualY = Math.trunc(bubble.startY + elapsedMove * (bubble.targetY - bubble.startY) / 150);
                    } else {
                        bubble.visualX = bubble.targetX;
                        bubble.visualY = bubble.targetY;
                    }
                }
                this.writeVisual(bubble, bubble.visualX, bubble.visualY);
            }
            if (this.clock - bubble.created > 150 && bubble.chat.elementRef && bubble.chat.elementRef.style.visibility !== 'visible') bubble.chat.elementRef.style.visibility = 'visible';
        }
        this.simulate();
        if (this.lastScroll + this.speed < this.clock) {
            for (const bubble of this.bubbles) {
                if (!this.line) for (const other of this.bubbles) if (bubble !== other) this.moveX(bubble, this.repulsion(bubble, other));
                this.moveY(bubble, -19);
            }
            if (this.line) {
                const body = { x: -10, y: this.height, width: 20, height: 19 };
                this.bubbles.push({ chat: null, body, extended: { x: -2510, y: this.height, width: 5020, height: 19 }, overlap: { x: 0, y: 0, width: 0, height: 0 }, offset: -2500, narrow: false, line: true, spacer: true, timestamp: Date.now(), dx: 0, dy: 0, clipped: false, pendingImmediate: false, writtenLeft: 0, writtenTop: 0, visualX: 0, visualY: 0, targetX: 0, targetY: 0, startX: 0, startY: 0, moveStarted: this.clock, created: this.clock });
            }
            this.simulate();
            this.lastScroll = this.clock;
        }
        this.publish();
        const removed: number[] = [];
        if (this.lastCleanup + 5000 < this.clock) {
            this.bubbles = this.bubbles.filter((bubble) => {
                if (bubble.body.y + bubble.body.height >= -10) return true;
                if (bubble.chat) removed.push(bubble.chat.id);
                return false;
            });
            this.lastCleanup = this.clock;
        }
        return removed;
    }

    private writeVisual(bubble: Collider, x: number, y: number) {
        if (!bubble.chat) return;
        let left = x;
        bubble.clipped = false;
        if (bubble.line) {
            const maximum = this.viewportWidth - 190 - bubble.chat.width;
            if (left > maximum) { left = maximum; bubble.clipped = true; }
            if (left < 85) { left = 85; bubble.clipped = true; }
        }
        if (bubble.chat.left !== left) bubble.chat.left = left;
        if (bubble.chat.top !== y) bubble.chat.top = y;
        // Default style regpoints use native fallback margins 28/15; other skins retain their CSS.
        if (bubble.chat.styleId === 0 && bubble.chat.elementRef) {
            const pointerX = `${Math.max(28, Math.min(bubble.chat.width - 15, bubble.chat.location.x - left))}px`;
            const style = bubble.chat.elementRef.style;
            if (style.getPropertyValue('--chat-pointer-x') !== pointerX) style.setProperty('--chat-pointer-x', pointerX);
        }
        bubble.writtenLeft = left;
        bubble.writtenTop = y;
    }

    private publish(immediate = false) {
        for (let index = 0; index < this.bubbles.length; index++) {
            const bubble = this.bubbles[index];
            if (bubble.chat) {
                const x = Math.trunc(bubble.body.x - bubble.overlap.x);
                const y = Math.trunc(bubble.body.y - bubble.overlap.y);
                if (immediate || bubble.pendingImmediate) {
                    bubble.targetX = x; bubble.targetY = y;
                    bubble.visualX = x; bubble.visualY = y;
                    this.writeVisual(bubble, x, y);
                } else if (x !== bubble.targetX || y !== bubble.targetY) {
                    bubble.startX = bubble.visualX; bubble.startY = bubble.visualY;
                    bubble.targetX = x; bubble.targetY = y;
                    bubble.moveStarted = this.clock;
                }
            }
            bubble.pendingImmediate = false;
            if (!bubble.spacer && bubble.extended) bubble.extended.height = bubble.body.height / 2;
            if (!bubble.spacer && index > 0 && bubble.clipped) {
                if (bubble.extended) bubble.extended.height = bubble.body.height;
                const previous = this.bubbles[index - 1];
                if (previous.extended) previous.extended.height = previous.body.height;
            }
        }
    }
}
