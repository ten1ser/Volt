import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ModToolsView } from './ModToolsView';

interface TrackerLike { linkReceived: (url: string) => void }

const test = vi.hoisted(() => ({
    tracker: null as TrackerLike | null,
    settings: { cfhPermission: true, chatlogsPermission: true } as Record<string, unknown> | null
}));

vi.mock('@volt/renderer', () => ({
    AddLinkEventTracker: (tracker: TrackerLike) => { test.tracker = tracker; },
    CreateLinkEvent: vi.fn(),
    RemoveLinkEventTracker: () => { test.tracker = null; },
    RoomEngineEvent: { INITIALIZED: 'INITIALIZED', DISPOSED: 'DISPOSED' },
    RoomId: { isRoomPreviewerId: () => false },
    RoomObjectCategory: { UNIT: 1 },
    RoomObjectType: { USER: 1 },
    UserClassificationMessageEvent: class {}
}));

vi.mock('../../api', () => ({ GetRoomSession: () => null, LocalizeText: (key: string) => key }));
vi.mock('../../api/permissions', () => ({ Permission: { ModerationTool: 'moderator' } }));
vi.mock('../../hooks', () => {
    const state = { windows: [], startPanel: { x: 10, y: 20 }, show: vi.fn(), close: vi.fn(), hide: vi.fn(), resize: vi.fn(), setStartPanel: vi.fn() };
    const store = (selector: (value: typeof state) => unknown) => selector(state);

    return {
        MOD_WINDOW_SIZE: {},
        useHasPermission: () => true,
        useIssueManager: () => ({}),
        useMessageEvent: () => undefined,
        useModTools: () => ({ settings: test.settings, cfhCategories: [] }),
        useModWindowTrackerStore: Object.assign(store, { getState: () => state }),
        useObjectSelectedEvent: () => undefined,
        useVoltEvent: () => undefined
    };
});
vi.mock('./views/StartPanelView', () => ({
    StartPanelView: ({ onClose }: { onClose: () => void }) => (
        <div data-testid="mod-tools-start-panel">
            <button onClick={onClose}>Close mod tools</button>
        </div>
    )
}));
vi.mock('./views/EvidenceChatlogView', () => ({ EvidenceChatlogView: () => null }));
vi.mock('./views/IssueBrowserView', () => ({ IssueBrowserView: () => null }));
vi.mock('./views/IssueHandlerView', () => ({ IssueHandlerView: () => null }));
vi.mock('./views/ModActionView', () => ({ ModActionView: () => null }));
vi.mock('./views/NativeAlertView', () => ({ NativeAlertView: () => null }));
vi.mock('./views/RoomToolView', () => ({ RoomToolView: () => null }));
vi.mock('./views/RoomVisitsView', () => ({ RoomVisitsView: () => null }));
vi.mock('./views/SendMessageView', () => ({ SendMessageView: () => null }));
vi.mock('./views/UserClassificationView', () => ({ UserClassificationView: () => null }));
vi.mock('./views/UserInfoView', () => ({ UserInfoView: () => null }));
const received = (url: string) => act(() => { test.tracker?.linkReceived(url); });
const panel = () => screen.queryByTestId('mod-tools-start-panel');

describe('ModToolsView start panel visibility', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        test.tracker = null;
        test.settings = { cfhPermission: true, chatlogsPermission: true };
    });
    afterEach(cleanup);

    it('stays hidden when the moderator init settings arrive', () => {
        render(<ModToolsView />);
        expect(test.tracker).not.toBeNull();
        expect(panel()).toBeNull();
    });

    it('opens on mod-tools/show and toggles with mod-tools/toggle', () => {
        render(<ModToolsView />);
        received('mod-tools/show');
        expect(panel()).toBeInTheDocument();
        received('mod-tools/toggle');
        expect(panel()).toBeNull();
        received('mod-tools/toggle');
        expect(panel()).toBeInTheDocument();
    });
    it('closes from the panel close control and reopens with show', () => {
        render(<ModToolsView />);
        received('mod-tools/show');
        fireEvent.click(screen.getByRole('button', { name: 'Close mod tools' }));
        expect(panel()).toBeNull();
        received('mod-tools/show');
        expect(panel()).toBeInTheDocument();
    });

    it('initialises from moderator settings without opening the panel', () => {
        test.settings = null;
        const { rerender } = render(<ModToolsView />);
        test.settings = { cfhPermission: true, chatlogsPermission: true };
        rerender(<ModToolsView />);
        expect(panel()).toBeNull();
        received('mod-tools/show');
        expect(panel()).toBeInTheDocument();
    });
});
