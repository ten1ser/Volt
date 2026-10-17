export type CitySnapshot = { cycleElapsedMs: number; cycleDurationMs: number; dayDurationMs: number; onlinePlayers: number };

const SKY: [number, number][] = [
    [0, 0x111c34], [4, 0x202c49], [6, 0xc99d98], [8, 0x9fc9e2],
    [12, 0xabd5e9], [16, 0x91b5d0], [18, 0xbf8e88], [20, 0x353a58], [24, 0x111c34]
];

export const cityClock = (snapshot: CitySnapshot, elapsedSinceSample: number) =>
{
    const elapsed = ((snapshot.cycleElapsedMs + Math.max(0, elapsedSinceSample)) % snapshot.cycleDurationMs);
    const hour = (6 + elapsed / snapshot.cycleDurationMs * 24) % 24;
    const minute = Math.floor(hour * 60);
    const index = SKY.findIndex(([end]) => end > hour);
    const [start, first] = SKY[index - 1];
    const [end, last] = SKY[index];
    const mix = (hour - start) / (end - start);
    const channel = (shift: number) => Math.round(((first >> shift) & 255) * (1 - mix) + ((last >> shift) & 255) * mix);
    return {
        time: `${Math.floor(minute / 60).toString().padStart(2, '0')}:${(minute % 60).toString().padStart(2, '0')}`,
        isDay: elapsed < snapshot.dayDurationMs,
        phaseRemainingMs: elapsed < snapshot.dayDurationMs ? snapshot.dayDurationMs - elapsed : snapshot.cycleDurationMs - elapsed,
        backdropColor: (channel(16) << 16) | (channel(8) << 8) | channel(0),
        onlinePlayers: snapshot.onlinePlayers
    };
};
