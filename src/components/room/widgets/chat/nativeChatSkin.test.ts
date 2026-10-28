import { describe, expect, it } from 'vitest';
import { isDistrictPlainStyle, isNativeAnonymousStyle } from './nativeChatSkin';

describe('DistrictRP plain chat styles', () =>
{
    it('draws ordinary talk and every RP action colour as plain text', () =>
    {
        expect([0, 3, 4, 5, 6, 7, 11, 12, 13].every(isDistrictPlainStyle)).toBe(true);
    });

    it('leaves system, bot and decorated bubbles native', () =>
    {
        expect([1, 2, 8, 9, 10, 14, 15, 16, 31, 33].some(isDistrictPlainStyle)).toBe(false);
        expect(isNativeAnonymousStyle(1)).toBe(true);
    });
});
