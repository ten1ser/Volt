import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GroupInformationStandaloneView } from './GroupInformationStandaloneView';

const events = vi.hoisted(() => ({ reply: null, tracker: null, link: vi.fn() }));
vi.mock('@volt/renderer', () => ({ GroupInformationEvent: class
{}, CreateLinkEvent: events.link, AddLinkEventTracker: (tracker: unknown) =>
{
    events.tracker = tracker;
}, RemoveLinkEventTracker: vi.fn() }));
vi.mock('../../../hooks', () => ({ useMessageEvent: (_type: unknown, handler: (event: unknown) => void) =>
{
    events.reply = handler;
} }));
vi.mock('../../roleplay/jobs/BusinessView', () => ({ BusinessView: ({ groupInformation, onClose }: { groupInformation: { id: number; title: string }; onClose: () => void }) => <div role="dialog" aria-label="Business/Corporation"><span>{groupInformation.id}: {groupInformation.title}</span><button onClick={onClose}>Close</button></div> }));
const reply = (id: number, flag: boolean, title = 'Hospital') => act(() => events.reply?.({ getParser: () => ({ id, flag, title }) }));
afterEach(cleanup);
describe('Group information opens the corporation surface', () =>
{
    it('waits for an explicit open response and passes the actual identity', () =>
    {
        render(<GroupInformationStandaloneView />);
        reply(1, false);
        expect(screen.queryByRole('dialog')).toBeNull();
        reply(1, true);
        expect(events.link).toHaveBeenCalledWith('businesses/hide');
        expect(screen.getByRole('dialog', { name: 'Business/Corporation' })).toBeInTheDocument();
        expect(screen.getByText('1: Hospital')).toBeInTheDocument();
        reply(99, false, 'Other');
        expect(screen.getByText('1: Hospital')).toBeInTheDocument();
        reply(1, false, 'Hospital updated');
        expect(screen.getByText('1: Hospital updated')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Close' }));
        expect(screen.queryByRole('dialog')).toBeNull();
        reply(1, true);
        act(() => events.tracker?.linkReceived('businesses/show'));
        expect(screen.queryByRole('dialog')).toBeNull();
    });
});
