import { describe, expect, it } from 'vitest';
import { cityClock } from './cityClock';

const snapshot = (cycleElapsedMs = 0) => ({ cycleElapsedMs, cycleDurationMs: 1800000, dayDurationMs: 900000, onlinePlayers: 32 });
describe('shared city clock', () =>
{
    it('starts day at 06:00, night at 18:00 and wraps every 30 real minutes', () =>
    {
        expect(cityClock(snapshot(), 0)).toMatchObject({ time: '06:00', isDay: true, phaseRemainingMs: 900000 });
        expect(cityClock(snapshot(), 900000)).toMatchObject({ time: '18:00', isDay: false, phaseRemainingMs: 900000 });
        expect(cityClock(snapshot(), 1800000)).toMatchObject({ time: '06:00', isDay: true });
        expect(cityClock(snapshot(), 450000).time).toBe('12:00');
    });
    it('uses server phase plus monotonic elapsed time and preserves hotel population', () =>
    {
        expect(cityClock(snapshot(899000), 1000)).toEqual(cityClock(snapshot(900000), 0));
        expect(cityClock(snapshot(), -1000).time).toBe('06:00');
        expect(cityClock(snapshot(), 0).onlinePlayers).toBe(32);
    });
    it('interpolates the backdrop continuously through dawn, dusk and cycle wrap', () =>
    {
        const channels = (color: number) => [color >> 16, (color >> 8) & 255, color & 255];
        for(const time of [0, 150000, 450000, 750000, 900000, 1050000, 1350000, 1650000, 1800000])
        {
            const before = channels(cityClock(snapshot(), Math.max(0, time - 250)).backdropColor);
            const after = channels(cityClock(snapshot(), time + 250).backdropColor);
            expect(after.every((value, index) => Math.abs(value - before[index]) <= 2)).toBe(true);
        }
        expect(cityClock(snapshot(), 450000).backdropColor).not.toBe(cityClock(snapshot(), 1350000).backdropColor);
    });
});
