import { describe, expect, it } from 'vitest';
import { isDistrictPlainStyle, isNativeAnonymousStyle, splitRpLeadingAsterisk } from './nativeChatSkin';

describe('DistrictRP plain chat styles', () =>
{
    it('draws ordinary talk and every RP action colour as plain text', () =>
    {
        expect([0, 3, 4, 5, 6, 7, 11, 12, 13, 900, 901, 902, 903, 904, 905, 906, 907, 908, 909, 910, 911, 912, 913].every(isDistrictPlainStyle)).toBe(true);
    });

    it('leaves system, bot and decorated bubbles native', () =>
    {
        expect([1, 2, 8, 9, 10, 14, 15, 16, 31, 33].some(isDistrictPlainStyle)).toBe(false);
        expect(isNativeAnonymousStyle(1)).toBe(true);
    });
});

describe('splitRpLeadingAsterisk', () =>
{
    it('moves the leading asterisk of an RP action line in front of the name', () =>
    {
        expect(splitRpLeadingAsterisk(904, '*Punches bob*')).toEqual({ prefix: '*', html: 'Punches bob*' });
    });

    it('leaves an RP action line without a leading asterisk unchanged', () =>
    {
        expect(splitRpLeadingAsterisk(904, 'hello')).toEqual({ prefix: '', html: 'hello' });
    });

    it('leaves ordinary chat unchanged', () =>
    {
        expect(splitRpLeadingAsterisk(0, '*waves*')).toEqual({ prefix: '', html: '*waves*' });
    });

    it('moves the leading asterisk on the last RP action style', () =>
    {
        expect(splitRpLeadingAsterisk(913, '*Hangs up*').prefix).toBe('*');
    });

    it('leaves the radio style outside the RP action range unchanged', () =>
    {
        expect(splitRpLeadingAsterisk(900, '*x*')).toEqual({ prefix: '', html: '*x*' });
    });
});
