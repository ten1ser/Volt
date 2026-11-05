import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RoleplayFeedView } from './RoleplayFeedView';

const test = vi.hoisted(() => ({ handlers: new Map<unknown, (event: unknown) => void>() }));
vi.mock('@volt/renderer', () =>
{
    class RpFeedLineEvent {}
    class RpActionProgressEvent {}
    return { RpFeedLineEvent, RpActionProgressEvent };
});
vi.mock('../../../hooks/events/useMessageEvent', () => ({ useMessageEvent: (type: unknown, handler: (event: unknown) => void) => test.handlers.set(type, handler) }));

const renderer = await import('@volt/renderer');
const line = (kind: number, actorName: string, targetName = '', detail = '') =>
    act(() => test.handlers.get(renderer.RpFeedLineEvent)({ getParser: () => ({ kind, actorName, targetName, detail }) }));
const progress = (kind: number, durationMs: number) =>
    act(() => test.handlers.get(renderer.RpActionProgressEvent)({ getParser: () => ({ kind, durationMs }) }));
const shown = () => [...document.querySelectorAll('.district-feed li')].map(item => item.textContent);

describe('RoleplayFeedView', () =>
{
    beforeEach(() => vi.useFakeTimers());
    afterEach(() =>
    {
        cleanup(); test.handlers.clear(); vi.useRealTimers();
    });

    it('words every kind the server can send', () =>
    {
        render(<RoleplayFeedView />);
        line(0, 'UserA', 'UserB');
        line(1, 'UserA', 'UserB', 'fist');
        line(1, 'UserA', 'UserB', 'knife');
        line(2, 'UserA', '', 'armed robbery');
        line(3, 'UserA', 'UserB', '1999');
        line(4, 'UserA');
        expect(shown()).toEqual([
            'UserA just shot and killed UserB.',
            'UserA smashed and killed UserB.',
            'UserA stabbed and killed UserB.',
            'UserA is now wanted for armed robbery.',
            'UserA listed a bounty on UserB for $1,999.',
            'UserA just got arrested.'
        ]);
        expect(screen.getByRole('log', { name: 'Roleplay log' })).toBeInTheDocument();
    });

    it('keeps the newest six lines and drops each after 15 seconds', () =>
    {
        render(<RoleplayFeedView />);
        for(let index = 1; index <= 7; index++) line(0, `killer${ index }`, 'victim');
        expect(shown()).toHaveLength(6);
        expect(shown()[0]).toContain('killer2');
        act(() => vi.advanceTimersByTime(10000));
        line(4, 'late');
        act(() => vi.advanceTimersByTime(5000));
        expect(shown()).toEqual(['late just got arrested.']);
        act(() => vi.advanceTimersByTime(10000));
        expect(shown()).toEqual([]);
    });

    it('shows the action bar for its duration and hides it only for the same kind', () =>
    {
        render(<RoleplayFeedView />);
        expect(screen.queryByRole('status')).toBeNull();
        progress(0, 3000);
        expect(screen.getByRole('status')).toHaveTextContent('Reloading pistol');
        expect(screen.getByRole('status').getAttribute('style')).toContain('3000ms');
        progress(1, 0);
        expect(screen.getByRole('status')).toHaveTextContent('Reloading pistol');
        progress(0, 0);
        expect(screen.queryByRole('status')).toBeNull();

        progress(1, 2000);
        expect(screen.getByRole('status')).toHaveTextContent('Pickpocketing');
        // A hide that never arrives still clears the bar shortly after the duration.
        act(() => vi.advanceTimersByTime(2600));
        expect(screen.queryByRole('status')).toBeNull();
    });
});
