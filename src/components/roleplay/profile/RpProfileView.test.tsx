import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RpProfileView } from './RpProfileView';

const test = vi.hoisted(() => ({ identity: null as any, card: null as any, close: vi.fn() }));
vi.mock('../../../common', () => ({ VoltCardView: ({ children }: any) => <div>{children}</div> }));
vi.mock('../../../common/layout/LayoutAvatarImageView', () => ({ LayoutAvatarImageView: () => <div data-testid="avatar" /> }));
vi.mock('../../../hooks/roleplay/useRpProfile', async () =>
{
    const actual = await vi.importActual<typeof import('../../../hooks/roleplay/useRpProfile')>('../../../hooks/roleplay/useRpProfile');
    return { ...actual, useRpProfile: () => ({ identity: test.identity, card: test.card, close: test.close }) };
});

const card = (overrides = {}) => ({ available: true, gang: '', job: 'Hospital', rank: 'Trainee', kills: 12, deaths: 4,
    punchesThrown: 248, punchesMissed: 61, punchesReceived: 190, timesJailed: 2, ...overrides });
const statValue = (label: string) => screen.getByText(label).previousElementSibling?.textContent;

describe('DistrictRP profile window', () =>
{
    beforeEach(() =>
    {
        test.identity = { userId: 5, username: 'teniser', figure: 'hd-180-1' };
        test.card = card();
        test.close.mockClear();
    });
    afterEach(cleanup);

    it('stays closed until a profile is opened', () =>
    {
        test.identity = null;
        render(<RpProfileView />);
        expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('shows the name, job and rank, and every fight counter with the K/D ratio', () =>
    {
        render(<RpProfileView />);
        expect(screen.getByRole('heading', { name: 'teniser' })).toBeInTheDocument();
        expect(screen.getByText('Hospital, Trainee')).toBeInTheDocument();
        expect(screen.getByTestId('avatar')).toBeInTheDocument();
        expect([statValue('K/D'), statValue('Kills'), statValue('Deaths'), statValue('Jailed')]).toEqual(['3.00', '12', '4', '2']);
        expect([statValue('Punches thrown'), statValue('Punches missed'), statValue('Punches received')]).toEqual(['248', '61', '190']);
    });

    it('shows the gang only when there is one, and says unemployed without a job', () =>
    {
        test.card = card({ gang: 'Southside Kings', job: '', rank: '' });
        render(<RpProfileView />);
        expect(screen.getByText('Southside Kings')).toBeInTheDocument();
        expect(screen.getByText('Unemployed')).toBeInTheDocument();
    });

    it('shows placeholders while loading and a notice when unavailable', () =>
    {
        test.card = null;
        const view = render(<RpProfileView />);
        expect(statValue('Kills')).toBe('–');
        expect(statValue('K/D')).toBe('–');
        test.card = card({ available: false });
        view.rerender(<RpProfileView />);
        expect(screen.getByRole('status')).toHaveTextContent('This profile is not available.');
    });

    it('closes with the close button and Escape', () =>
    {
        render(<RpProfileView />);
        fireEvent.click(screen.getByRole('button', { name: 'Close profile' }));
        fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
        expect(test.close).toHaveBeenCalledTimes(2);
    });
});
