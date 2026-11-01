import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DraggableWindow } from './DraggableWindow';
import { hasHostedWindow, WindowHost } from './WindowHost';

vi.mock('../../api', () => ({ GetLocalStorage: vi.fn(), SetLocalStorage: vi.fn() }));

const StatefulContent = () =>
{
    const [count, setCount] = useState(0);
    return <button type="button" onClick={() => setCount(count + 1)}>Use {count}</button>;
};

describe('Explicit native window destinations', () =>
{
    beforeEach(() =>
    {
        const desktop = document.createElement('div');
        desktop.id = 'draggable-windows-container'; document.body.append(desktop);
    });
    afterEach(() => { cleanup(); document.getElementById('draggable-windows-container')?.remove(); });

    it('hosts the actual window content while unrelated windows remain on the desktop', () =>
    {
        const present = vi.fn();
        render(<><WindowHost id="phone-test" keys={['inventory']} onPresent={present} />
            <DraggableWindow uniqueKey="inventory"><StatefulContent /></DraggableWindow>
            <DraggableWindow uniqueKey="unrelated"><span>Other window</span></DraggableWindow></>);
        const host = document.querySelector('.phone-window-host') as HTMLElement;
        expect(within(host).getByRole('button', { name: 'Use 0' })).toBeInTheDocument();
        expect(document.getElementById('draggable-windows-container')).not.toContainElement(screen.getByRole('button', { name: 'Use 0' }));
        expect(document.getElementById('draggable-windows-container')).toContainElement(screen.getByText('Other window'));
        expect(present).toHaveBeenCalledWith('inventory', true);
        expect(hasHostedWindow('phone-test')).toBe(true);
        expect(document.querySelector('.phone-hosted-window')).not.toHaveStyle({ transform: expect.any(String) });
    });

    it('parks hidden apps without losing local state or producing a desktop copy', () =>
    {
        const Fixture = ({ hidden }: { hidden: boolean }) => <>
            <div hidden={hidden}><WindowHost id="parked" keys={['district-backpack']} onPresent={() => {}} /></div>
            <DraggableWindow uniqueKey="district-backpack"><StatefulContent /></DraggableWindow></>;
        const view = render(<Fixture hidden={false} />);
        fireEvent.click(screen.getByRole('button', { name: 'Use 0' }));
        view.rerender(<Fixture hidden />);
        expect(screen.queryByRole('button', { name: 'Use 1' })).toBeNull();
        expect(document.getElementById('draggable-windows-container')).toBeEmptyDOMElement();
        view.rerender(<Fixture hidden={false} />);
        expect(screen.getByRole('button', { name: 'Use 1' })).toBeInTheDocument();
    });

    it('keeps child tool windows inside the app and reports their native close', () =>
    {
        const present = vi.fn();
        const Fixture = ({ child }: { child: boolean }) => <>
            <WindowHost id="moderation" keys={['phone-mod-start']} prefixes={['phone-mod-']} onPresent={present} />
            <DraggableWindow uniqueKey="phone-mod-start"><span>Moderation root</span></DraggableWindow>
            {child && <DraggableWindow uniqueKey="phone-mod-roomTool-4"><button>Close room tool</button></DraggableWindow>}
        </>;
        const view = render(<Fixture child />);
        const windows = document.querySelectorAll<HTMLElement>('.phone-hosted-window');
        expect(windows).toHaveLength(2);
        expect(windows[0]).toHaveAttribute('data-primary', 'true');
        expect(windows[1]).not.toHaveAttribute('data-primary');
        expect(Number(windows[1].style.zIndex)).toBeGreaterThan(Number(windows[0].style.zIndex));
        view.rerender(<Fixture child={false} />);
        expect(screen.queryByRole('button', { name: 'Close room tool' })).toBeNull();
        expect(present).toHaveBeenCalledWith('phone-mod-roomTool-4', false);
        expect(hasHostedWindow('moderation')).toBe(true);
    });

    it('registers the destination before launching and removes it on unmount', () =>
    {
        const launch = vi.fn();
        const Fixture = () =>
        {
            const [open, setOpen] = useState(false);
            return <><WindowHost id="ready" keys={['catalog']} onPresent={() => {}} onReady={() => { launch(); setOpen(true); }} />
                {open && <DraggableWindow uniqueKey="catalog"><span>Catalog content</span></DraggableWindow>}</>;
        };
        const view = render(<Fixture />);
        expect(launch).toHaveBeenCalledOnce();
        expect(document.getElementById('draggable-windows-container')).toBeEmptyDOMElement();
        expect(screen.getByText('Catalog content').closest('.phone-hosted-window')).not.toBeNull();
        act(() => view.unmount());
        expect(hasHostedWindow('ready')).toBe(false);
    });

    it('places shared purchase/sale dialogs in the currently active app', () =>
    {
        const Fixture = ({ shop, paused = false }: { shop: boolean; paused?: boolean }) => <>
            <section data-testid="inventory"><WindowHost id="inventory" keys={['inventory', 'sale']} active={!shop && !paused} onPresent={() => {}} /></section>
            <section data-testid="shop"><WindowHost id="shop" keys={['catalog', 'sale']} active={shop && !paused} onPresent={() => {}} /></section>
            <DraggableWindow uniqueKey="sale"><span>Sale confirmation</span></DraggableWindow>
        </>;
        const view = render(<Fixture shop />);
        expect(screen.getByTestId('shop')).toContainElement(screen.getByText('Sale confirmation'));
        view.rerender(<Fixture shop paused />);
        expect(screen.getByTestId('shop')).toContainElement(screen.getByText('Sale confirmation'));
        view.rerender(<Fixture shop={false} />);
        expect(screen.getByTestId('inventory')).toContainElement(screen.getByText('Sale confirmation'));
        expect(screen.getAllByText('Sale confirmation')).toHaveLength(1);
        view.unmount();
        expect(hasHostedWindow('inventory')).toBe(false);
        expect(hasHostedWindow('shop')).toBe(false);
    });

    it('bridges unhandled Escape from portal content while respecting native cancellation', () =>
    {
        const home = vi.fn();
        render(<><WindowHost id="escape" keys={['test']} onPresent={() => {}} onEscape={home} />
            <DraggableWindow uniqueKey="test"><button>Normal action</button><input aria-label="Editing" onKeyDown={event => event.preventDefault()} /></DraggableWindow></>);
        fireEvent.keyDown(screen.getByRole('textbox', { name: 'Editing' }), { key: 'Escape' });
        expect(home).not.toHaveBeenCalled();
        fireEvent.keyDown(screen.getByRole('button', { name: 'Normal action' }), { key: 'Escape' });
        expect(home).toHaveBeenCalledOnce();
    });
});
