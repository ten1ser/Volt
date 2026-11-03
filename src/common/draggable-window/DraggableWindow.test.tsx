import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DraggableWindow } from './DraggableWindow';

vi.mock('../../api', () => ({ GetLocalStorage: vi.fn(), SetLocalStorage: vi.fn() }));

const windows = () => [...document.querySelectorAll<HTMLElement>('#draggable-windows-container > .draggable-window')];

describe('DraggableWindow stacking', () =>
{
    beforeEach(() =>
    {
        const desktop = document.createElement('div');
        desktop.id = 'draggable-windows-container'; document.body.append(desktop);
    });
    afterEach(() => { cleanup(); document.getElementById('draggable-windows-container')?.remove(); });

    it('staggers cascading windows from each other but leaves ordinary windows centred', () =>
    {
        render(<>
            <DraggableWindow uniqueKey="a" cascade><span>A</span></DraggableWindow>
            <DraggableWindow uniqueKey="b" cascade><span>B</span></DraggableWindow>
            <DraggableWindow uniqueKey="c"><span>C</span></DraggableWindow>
        </>);
        const [a, b, c] = windows();
        const offset = (element: HTMLElement) => element.style.transform.match(/translate3d\((-?\d+)px, (-?\d+)px/).slice(1).map(Number);
        const [ax, ay] = offset(a);

        expect(offset(b)).toEqual([ax + 28, ay + 28]);
        expect(offset(c)).toEqual([ax, ay]);
    });

    it('marks only the window in front as active, and passes it on when that window closes', () =>
    {
        const view = render(<>
            <DraggableWindow uniqueKey="a"><span>A</span></DraggableWindow>
            <DraggableWindow uniqueKey="b"><span>B</span></DraggableWindow>
        </>);
        let [a, b] = windows();

        expect(b).toHaveClass('is-active-window');
        expect(a).not.toHaveClass('is-active-window');

        view.rerender(<DraggableWindow uniqueKey="a"><span>A</span></DraggableWindow>);
        [a] = windows();
        expect(a).toHaveClass('is-active-window');
    });
});
