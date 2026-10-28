import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { aimRect, PhoneCameraApp } from './PhoneCameraApp';

type Picture = { draftId: string; displayUrl: string; texture?: { destroy: () => void } };

const test = vi.hoisted(() => ({
    roll: [null, null, null, null, null] as (Picture | null)[],
    rollRef: { current: [null, null, null, null, null] as (Picture | null)[] },
    setRoll: vi.fn(), capture: vi.fn(), remove: vi.fn(), link: vi.fn(), sound: vi.fn(), viewportFails: false
}));
vi.mock('@volt/renderer', () => ({
    CreateLinkEvent: test.link,
    GetRenderer: () => ({ canvas: { getBoundingClientRect: () => ({ left: 0, top: 0, width: 1000, height: 800 }) } }),
    GetRoomSessionManager: () => ({ getSession: () => 'session' }),
    RequestCameraConfigurationComposer: class
    {},
    RoomObjectCategory: { UNIT: 100 },
    VoltLogger: { error: vi.fn() },
    VoltTexture: { from: () => ({ destroy: vi.fn() }) }
}));
vi.mock('../../../api', () => ({
    blitRoomCanvasToViewfinder: vi.fn(),
    CameraPicture: class
    {
        constructor(public texture: unknown, public imageUrl: string, public draftId: string, public displayUrl: string)
        {}
    },
    captureTrustedCamera: test.capture,
    deleteTrustedCamera: test.remove,
    getTrustedCameraViewport: () =>
    {
        if (test.viewportFails) throw new Error('zoomed');
        return { width: 1 };
    },
    getViewfinderRoomFrame: () => ({ x: 0, y: 0, width: 320, height: 320 }),
    GetRoomObjectScreenLocation: () => ({ x: 500, y: 600 }),
    GetRoomSession: () => ({ roomId: 1, ownRoomIndex: 3 }),
    loadTrustedCameraImage: async () => ({ src: 'blob:shot' }),
    PlaySound: test.sound,
    SendMessageComposer: vi.fn(),
    SoundNames: { CAMERA_SHUTTER: 'shutter' }
}));
vi.mock('../../../hooks', () => ({ useCamera: () => ({ cameraRoll: test.roll, cameraRollRef: test.rollRef, setCameraRoll: test.setRoll }) }));

const photo = (id: string): Picture => ({ draftId: id, displayUrl: `blob:${id}`, texture: { destroy: vi.fn() } });

describe('Phone camera', () =>
{
    beforeEach(() =>
    {
        test.roll = [null, null, null, null, null];
        test.rollRef.current = test.roll;
        test.viewportFails = false;
        [test.setRoll, test.capture, test.remove, test.link, test.sound].forEach(fn => fn.mockClear());
        test.capture.mockResolvedValue({ draftId: 'd1', url: 'u1' });
    });
    afterEach(cleanup);

    it('aims a 320px shot at the avatar and moves it with the pan', () =>
    {
        expect(aimRect(500, 600, 0, 0)).toEqual({ left: 340, top: 370, width: 320, height: 320 });
        expect(aimRect(500, 600, 40, -20)).toEqual({ left: 300, top: 390, width: 320, height: 320 });
    });

    it('takes a photo into the first free slot with the shutter sound', async () =>
    {
        test.roll = [photo('a'), null, null, null, null];
        test.rollRef.current = test.roll;
        render(<PhoneCameraApp onHome={vi.fn()} />);
        await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Take photo' })));
        expect(test.sound).toHaveBeenCalledWith('shutter');
        const next = test.setRoll.mock.calls.at(-1)[0];
        expect(next[0].draftId).toBe('a');
        expect(next[1].draftId).toBe('d1');
    });

    it('refuses to shoot when the roll is full or the room is zoomed', async () =>
    {
        test.roll = ['a', 'b', 'c', 'd', 'e'].map(photo);
        test.rollRef.current = test.roll;
        const view = render(<PhoneCameraApp onHome={vi.fn()} />);
        await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Take photo' })));
        expect(screen.getByText(/camera roll is full/)).toBeInTheDocument();
        test.roll = [null, null, null, null, null];
        test.rollRef.current = test.roll;
        test.viewportFails = true;
        view.rerender(<PhoneCameraApp onHome={vi.fn()} />);
        await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Take photo' })));
        expect(screen.getByText(/Zoom the room back/)).toBeInTheDocument();
        expect(test.capture).not.toHaveBeenCalled();
    });

    it('opens a photo from the gallery to develop or delete it', () =>
    {
        test.roll = [null, photo('b'), null, null, null];
        test.rollRef.current = test.roll;
        render(<PhoneCameraApp onHome={vi.fn()} />);
        fireEvent.click(screen.getByRole('button', { name: 'Photos' }));
        fireEvent.click(screen.getByRole('button', { name: 'Photo 2' }));
        fireEvent.click(screen.getByRole('button', { name: 'Develop' }));
        expect(test.link).toHaveBeenCalledWith('camera/edit/1');
        fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
        expect(test.remove).toHaveBeenCalledWith('b');
        expect(test.setRoll.mock.calls.at(-1)[0][1]).toBeNull();
    });
});
