import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TargetHud } from './TargetHud';

const test = vi.hoisted(() => ({
    value: null
}));

vi.mock('../../../hooks/roleplay/useTargetStats', () => ({ useTargetStats: () => test.value }));
vi.mock('../../../common/layout/LayoutAvatarImageView', () => ({ LayoutAvatarImageView: ({ figure, gender }: { figure: string; gender: string }) => <div data-testid="target-avatar" data-figure={figure} data-gender={gender} /> }));
vi.mock('../../../api/utils/LocalizeText', () => ({ LocalizeText: (key: string) => key }));

const target = { userId: 22, name: 'Mara', figure: 'hr-200-45', sex: 'F' };

describe('target HUD', () =>
{
    beforeEach(() =>
    {
        test.value = { target, stats: { health: 60, energy: 40 }, clearTarget: vi.fn() };
    });

    afterEach(() =>
    {
        cleanup();
    });

    it('renders nothing without a target', () =>
    {
        test.value = { target: null, stats: null, clearTarget: vi.fn() };
        const view = render(<TargetHud />);
        expect(view.container).toBeEmptyDOMElement();
    });

    it('shows the target label, name, portrait and accessible real values', () =>
    {
        render(<TargetHud />);
        expect(screen.getByText('Target')).toBeInTheDocument();
        expect(screen.getByText('Mara')).toBeInTheDocument();
        expect(screen.getByTestId('target-avatar')).toHaveAttribute('data-figure', 'hr-200-45');
        expect(screen.getByTestId('target-avatar')).toHaveAttribute('data-gender', 'F');
        expect(screen.getByRole('progressbar', { name: 'Target health' })).toHaveAttribute('aria-valuenow', '60');
        expect(screen.getByRole('progressbar', { name: 'Target energy' })).toHaveAttribute('aria-valuenow', '40');
        expect(screen.getByText('60 / 100')).toBeInTheDocument();
        expect(screen.getByText('40 / 100')).toBeInTheDocument();
    });

    it('shows loading text and no fabricated vitals until a validated reply arrives', () =>
    {
        test.value = { target, stats: null, clearTarget: vi.fn() };
        render(<TargetHud />);
        expect(screen.getByRole('status')).toHaveTextContent('Loading…');
        expect(screen.queryByRole('progressbar')).toBeNull();
        expect(screen.queryByText('100 / 100')).toBeNull();
    });

    it('clears the target through the accessible Clear target button', () =>
    {
        const clearTarget = vi.fn();
        test.value = { target, stats: { health: 60, energy: 40 }, clearTarget };
        render(<TargetHud />);
        fireEvent.click(screen.getByRole('button', { name: 'Clear target' }));
        expect(clearTarget).toHaveBeenCalledTimes(1);
    });
});
