import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RoleplayFeedView } from './RoleplayFeedView';

const test = vi.hoisted(() => ({ handlers: new Map<unknown, (event: unknown) => void>(), treatment: null as { phase: number; progress: number; remainingMs: number } | null }));
vi.mock('@volt/renderer', () =>
{
    class RpFeedLineEvent {}
    class RpActionProgressEvent {}
    return { RpFeedLineEvent, RpActionProgressEvent };
});
vi.mock('../../../hooks/events/useMessageEvent', () => ({ useMessageEvent: (type: unknown, handler: (event: unknown) => void) => test.handlers.set(type, handler) }));
vi.mock('../../../hooks/roleplay/useRpHospitalTreatment', () => ({ useRpHospitalTreatment: () => test.treatment }));
vi.mock('../../../api/utils/LocalizeText', () => ({ LocalizeText: (key: string) => key }));

const renderer = await import('@volt/renderer');
const line = (kind: number, actorName: string, targetName = '', detail = '') =>
    act(() => test.handlers.get(renderer.RpFeedLineEvent)({ getParser: () => ({ kind, actorName, targetName, detail }) }));
const progress = (kind: number, durationMs: number) =>
    act(() => test.handlers.get(renderer.RpActionProgressEvent)({ getParser: () => ({ kind, durationMs }) }));
const shown = () => [...document.querySelectorAll('.district-feed li')].map(item => item.textContent);

describe('RoleplayFeedView', () =>
{
    beforeEach(() =>
    {
        test.treatment = null;
        vi.useFakeTimers();
    });
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

    it('shows the hospital transfer countdown without a progressbar', () =>
    {
        test.treatment = { phase: 1, progress: 0, remainingMs: 7000 };
        render(<RoleplayFeedView />);
        expect(screen.getByRole('status')).toHaveTextContent('Hospital transfer');
        expect(screen.getByText('7s')).toBeInTheDocument();
        expect(screen.queryByRole('progressbar')).toBeNull();
    });

    it('shows authoritative hospital treatment progress', () =>
    {
        test.treatment = { phase: 2, progress: 20, remainingMs: 63000 };
        render(<RoleplayFeedView />);
        expect(screen.getByRole('status')).toHaveTextContent('Hospital treatment');
        expect(screen.getByText('20%')).toBeInTheDocument();
        expect(screen.getByRole('progressbar', { name: 'Hospital treatment' })).toHaveAttribute('aria-valuenow', '20');
    });

    it('shows no treatment bar for phase 0 or no treatment', () =>
    {
        const view = render(<RoleplayFeedView />);
        expect(screen.queryByRole('status')).toBeNull();
        test.treatment = { phase: 0, progress: 0, remainingMs: 0 };
        view.rerender(<RoleplayFeedView />);
        expect(screen.queryByRole('status')).toBeNull();
    });

    it('shows the action progress instead of the treatment bar when both exist', () =>
    {
        test.treatment = { phase: 2, progress: 20, remainingMs: 63000 };
        render(<RoleplayFeedView />);
        progress(0, 3000);
        expect(screen.getByRole('status')).toHaveTextContent('Reloading pistol');
        expect(screen.queryByText('Hospital treatment')).toBeNull();
    });
});
