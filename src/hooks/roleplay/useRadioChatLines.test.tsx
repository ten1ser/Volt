import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RadioTransmission } from './useRpRadio';
import { radioChatName, useRadioChatLines } from './useRadioChatLines';

const test = vi.hoisted(() => ({ messages: [] as RadioTransmission[] }));

vi.mock('./useRpRadio', async (original) => ({
    ...(await original<typeof import('./useRpRadio')>()),
    useRpRadio: () => ({ messages: test.messages })
}));

const line = (id: number, extra: Partial<RadioTransmission> = {}): RadioTransmission => ({
    id, channel: 0, frequency: 1001, channelLabel: 'Public', senderId: 1, senderName: 'Marco', senderRank: '', text: `line ${ id }`, sentAt: 0, ...extra
});

describe('useRadioChatLines', () =>
{
    beforeEach(() => { test.messages = []; });

    it('skips traffic already in the feed and reports each new transmission once', () =>
    {
        test.messages = [ line(1), line(2) ];
        const onLine = vi.fn();
        const { rerender } = renderHook(() => useRadioChatLines(onLine));
        expect(onLine).not.toHaveBeenCalled();

        test.messages = [ line(1), line(2), line(3), line(4) ];
        rerender();
        expect(onLine.mock.calls.map(([ message ]) => message.id)).toEqual([ 3, 4 ]);

        rerender();
        expect(onLine).toHaveBeenCalledTimes(2);
    });

    it('starts again from zero when the feed resets its ids', () =>
    {
        test.messages = [ line(7) ];
        const onLine = vi.fn();
        const { rerender } = renderHook(() => useRadioChatLines(onLine));

        test.messages = [];
        rerender();
        test.messages = [ line(1) ];
        rerender();
        expect(onLine.mock.calls.map(([ message ]) => message.id)).toEqual([ 1 ]);
    });

    it('tags public lines by frequency and private channels by name, with the rank before the name', () =>
    {
        expect(radioChatName(line(1))).toBe('[100.1] Marco');
        expect(radioChatName(line(1, { channel: 1, senderRank: 'Doctor', senderName: 'Ann' }))).toBe('[Hospital] Doctor Ann');
        expect(radioChatName(line(1, { channel: 2, senderRank: 'Boss', senderName: 'teniser' }))).toBe('[Gang] Boss teniser');
    });
});
