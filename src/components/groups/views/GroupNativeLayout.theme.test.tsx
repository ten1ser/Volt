import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { VoltCardContextProvider } from '../../../common/card/VoltCardContext';
import { GroupInput, GroupText } from './GroupNativeLayout';

vi.mock('../../../common/native-text/NativeText', () => ({ NativeText: ({ text, background }: { text: string; background: number }) => <span data-testid="native-text" data-background={background}>{text}</span> }));
beforeEach(() => vi.stubGlobal('ResizeObserver', class
{
    observe()
    {} disconnect()
    {}
}));
afterEach(() =>
{
    cleanup(); vi.unstubAllGlobals();
});
const district = (children: React.ReactNode) => <VoltCardContextProvider value={{ theme: 'district' }}>{children}</VoltCardContextProvider>;

describe('District group window lettering', () =>
{
    it('retains native rendering outside the District window theme', () =>
    {
        render(<GroupText text="Hospital" x={12} y={18} background={0xe9e9e1} />);
        expect(screen.getByTestId('native-text')).toHaveAttribute('data-background', String(0xe9e9e1));
        expect(screen.getByText('Hospital').parentElement).toHaveStyle({ left: '12px', top: '18px' });
    });
    it('uses theme-readable browser lettering without a painted light background', () =>
    {
        render(district(<GroupText text="Hospital<br/>Staff" x={12} y={18} width={150} wrap overrides={{ bold: true }} />));
        expect(screen.queryByTestId('native-text')).toBeNull();
        const text = screen.getByText(/Hospital/);
        expect(text).toHaveClass('district-group-text');
        expect(text.textContent).toBe('Hospital\nStaff');
        expect(text).toHaveStyle({ fontWeight: '700', whiteSpace: 'pre-wrap', maxWidth: '150px' });
    });
    it('preserves explicit semantic warning colors', () =>
    {
        render(district(<GroupText text="Cannot delete" x={0} y={0} overrides={{ color: 0xcc0000 }} />));
        expect(screen.getByText('Cannot delete')).toHaveStyle({ color: '#cc0000' });
    });
    it('keeps the browser input visible and editable without a raster overlay', () =>
    {
        const change = vi.fn();
        render(district(<GroupInput label="Group name" value="Hospital" maxLength={50} x={10} y={20} width={200} height={30} onChange={change} />));
        const input = screen.getByRole('textbox', { name: 'Group name' });
        expect(input).toHaveValue('Hospital');
        expect(input).not.toHaveClass('is-raster');
        expect(screen.queryByTestId('native-text')).toBeNull();
        fireEvent.change(input, { target: { value: 'Hospital staff' } });
        expect(change).toHaveBeenCalledWith('Hospital staff');
    });
    it('keeps legacy input raster behavior outside the theme', () =>
    {
        render(<GroupInput label="Legacy name" value="Hospital" maxLength={50} x={0} y={0} width={200} height={30} onChange={() =>
        {}} />);
        expect(screen.getByTestId('native-text')).toHaveTextContent('Hospital');
        expect(screen.getByRole('textbox', { name: 'Legacy name' })).toHaveValue('Hospital');
    });
});
