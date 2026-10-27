import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { VoltCardView } from './VoltCardView';

beforeEach(() =>
{
    vi.stubGlobal('ResizeObserver', class
    {
        observe()
        {} unobserve()
        {} disconnect()
        {}
    });
    const host = document.createElement('div');
    host.id = 'draggable-windows-container';
    document.body.appendChild(host);
});
afterEach(() =>
{
    cleanup(); vi.unstubAllGlobals(); document.getElementById('draggable-windows-container')?.remove();
});

// Windows render through a portal into the draggable-windows container.
const shell = (element: React.ReactElement) =>
{
    cleanup(); render(element);
    return document.querySelector('.volt-card-shell');
};

describe('DistrictRP window frame', () =>
{
    it('gives native windows the shared frame while keeping their theme', () =>
    {
        const card = shell(<VoltCardView theme="primary-slim">x</VoltCardView>);
        expect(card).toHaveClass('district-frame');
        expect(card).toHaveClass('theme-primary-slim');
        expect(shell(<VoltCardView frameStyle={3}>x</VoltCardView>)).toHaveClass('district-frame');
    });

    it('leaves the full district theme and wired editors without the frame-only class', () =>
    {
        const district = shell(<VoltCardView theme="district">x</VoltCardView>);
        expect(district).toHaveClass('theme-district');
        expect(district).not.toHaveClass('district-frame');
        expect(shell(<VoltCardView className="volt-wired">x</VoltCardView>)).not.toHaveClass('district-frame');
    });
});
