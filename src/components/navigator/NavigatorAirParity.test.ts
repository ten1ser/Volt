import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// Normalise CRLF so the contract holds on a Windows checkout too.
const read = (relative: string) => readFileSync(join(process.cwd(), relative), 'utf8').replace(/\r\n/g, '\n');

describe('AIR navigator visual contract', () => {

    it('searches only on explicit submit rather than a live debounce', () => {
        const search = read('src/components/navigator/views/search/NavigatorSearchView.tsx');

        expect(search).toContain('onSubmit');
        expect(search).not.toContain('300');
        expect(search).not.toContain('setTimeout');
    });

    it('centres the room info bubble on its real height like RoomInfoPopup.showAt', () => {
        const store = read('src/hooks/navigator/navigatorRoomInfoPopupStore.ts');
        const popup = read('src/components/navigator/views/search/NavigatorRoomInfoPopupView.tsx');

        // AIR does `new Point(x, y - _window.height / 2)` after populate() sized the window, so the
        // store may only keep the raw anchor and the view divides the measured height.
        expect(store).not.toContain('POPUP_HEIGHT');
        expect(store).toContain('y: point.y\n');
        expect(store).toContain('{ x: rect.right - 6, y: midY + 56 }');
        expect(store).toContain('{ x: rect.right + 20, y: midY }');
        expect(popup).toContain("transform: 'translateY(-50%)'");
    });

    it('lays the saved-searches pane out on AIR left_pane window coordinates', () => {
        const view = read('src/components/navigator/views/search/NavigatorSearchSavesResultView.tsx');
        const css = read('src/css/navigator/NavigatorView.css');
        const rule = (selector: string) => {
            const at = css.indexOf(selector + ' {');
            return css.slice(at, css.indexOf('}', at));
        };

        // left_hide_container: bitmap (3,3) 18x18, caption (20,2) h17 in id_heading_2.
        expect(view).not.toContain('gap={1}');
        expect(rule('.volt-navigator-search-saves-result__header-icon')).toContain('left: 3px');
        expect(rule('.volt-navigator-search-saves-result__header-icon')).toContain('top: 3px');
        expect(rule('.volt-navigator-search-saves-result__header-label')).toContain('left: 20px');
        expect(rule('.volt-navigator-search-saves-result__header-label')).toContain('top: 2px');

        // quick_link_text inherits the Ubuntu theme default u_regular: 12px, black.
        expect(rule('.saved-search-row__label')).toContain('font-size: 12px');
        expect(rule('.saved-search-row__label')).toContain('line-height: 17px');

        // remove_quick_link sits at x=115 and its bitmap is a native 10x10.
        expect(rule('.saved-search-row__delete')).toContain('left: 115px');
        expect(rule('.saved-search-row__delete')).toContain('10px 10px');
        expect(rule('.saved-search-row__delete')).not.toContain('16px 16px no-repeat');
    });
});
