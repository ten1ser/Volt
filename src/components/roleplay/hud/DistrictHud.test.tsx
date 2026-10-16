import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DistrictHud } from './DistrictHud';

const test = vi.hoisted(() => ({ link: vi.fn(), purse: { credits: 50200, activityPoints: new Map([[5, 9], [0, 200]]) }, currencies: [0, 5] }));
vi.mock('@volt/renderer', () => ({ CreateLinkEvent: test.link }));
vi.mock('../../../api', () => ({ GetConfigurationValue: () => test.currencies, localizeWithFallback: (_key: string, fallback: string) => fallback }));
vi.mock('../../../hooks', () => ({ usePurse: () => ({ purse: test.purse }) }));
vi.mock('../stats/StatsHud', () => ({ StatsHud: () => <section aria-label="Your stats" /> }));

afterEach(() =>
{
    cleanup(); test.currencies = [0, 5]; test.link.mockClear();
});

describe('DistrictRP dashboard', () =>
{
    it('shows live purse balances without inventing bank or job balances', () =>
    {
        const view = render(<DistrictHud />);
        const wallet = within(screen.getByRole('region', { name: 'Your balances' }));
        expect(wallet.getByText('50,200')).toBeInTheDocument();
        expect(wallet.getByText('9')).toBeInTheDocument();
        test.purse = { credits: 49900, activityPoints: new Map([[5, 12], [0, 180]]) };
        view.rerender(<DistrictHud />);
        expect(wallet.getByText('49,900')).toBeInTheDocument();
        expect(wallet.getByText('12')).toBeInTheDocument();
        expect(wallet.queryByText('50,200')).toBeNull();
    });

    it('honors configured currency visibility and preserves settings access', () =>
    {
        test.currencies = [];
        render(<DistrictHud />);
        expect(screen.queryByText('Diamonds')).toBeNull();
        expect(screen.queryByText('Duckets')).toBeNull();
        fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
        expect(test.link).toHaveBeenCalledWith('user-settings/show/other');
    });
});
