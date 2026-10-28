import { CreateLinkEvent, GetRenderer, GetRoomSessionManager, RequestCameraConfigurationComposer, RoomObjectCategory, VoltLogger, VoltTexture } from '@volt/renderer';
import { FC, PointerEvent, useEffect, useRef, useState } from 'react';
import {
    blitRoomCanvasToViewfinder,
    CameraPicture,
    captureTrustedCamera,
    deleteTrustedCamera,
    getTrustedCameraViewport,
    getViewfinderRoomFrame,
    GetRoomObjectScreenLocation,
    GetRoomSession,
    loadTrustedCameraImage,
    PlaySound,
    SendMessageComposer,
    SoundNames,
    ViewfinderRect
} from '../../../api';
import { useCamera } from '../../../hooks';
import { PhoneHeader } from './PhoneShared';

const SHOT = 320; // photos are 320x320, like the native camera
const ROLL = 5;
const FRAME_INTERVAL_MS = 80;
// The shot is aimed at the player's own avatar: its feet sit this far below the top of the frame.
const AIM_FEET_FROM_TOP = 230;

type Page = 'viewfinder' | 'gallery' | 'photo';

/** Viewport rectangle of the shot: centred on the player's avatar, moved by the pan offset. */
export const aimRect = (feetX: number, feetY: number, panX: number, panY: number): ViewfinderRect => ({
    left: Math.round(feetX - SHOT / 2 - panX),
    top: Math.round(feetY - AIM_FEET_FROM_TOP - panY),
    width: SHOT,
    height: SHOT
});

const currentAim = (panX: number, panY: number): ViewfinderRect | null =>
{
    const session = GetRoomSession();
    const source = GetRenderer()?.canvas;

    if (!session || !source) return null;

    const feet = GetRoomObjectScreenLocation(session.roomId, session.ownRoomIndex, RoomObjectCategory.UNIT);
    const bounds = source.getBoundingClientRect();

    if (!feet) return aimRect(bounds.left + bounds.width / 2, bounds.top + bounds.height / 2 + 60, panX, panY);

    return aimRect(bounds.left + feet.x, bounds.top + feet.y, panX, panY);
};

/** The phone camera: a live viewfinder of the room around the player, a shutter and the shared five-photo roll. */
export const PhoneCameraApp: FC<{ onHome: () => void }> = ({ onHome }) =>
{
    const [page, setPage] = useState<Page>('viewfinder');
    const [photoIndex, setPhotoIndex] = useState(-1);
    const [notice, setNotice] = useState('');
    const [flash, setFlash] = useState(0);
    const [busy, setBusy] = useState(false);
    const canvas = useRef<HTMLCanvasElement>(null);
    const pan = useRef({ x: 0, y: 0 });
    const drag = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
    const mounted = useRef(true);
    const prepared = useRef(false);
    const { cameraRoll, cameraRollRef, setCameraRoll } = useCamera();

    useEffect(() =>
    {
        mounted.current = true;

        return () =>
        {
            mounted.current = false;
        };
    }, []);

    // Live viewfinder: copy the aimed room frame into the screen canvas.
    useEffect(() =>
    {
        if (page !== 'viewfinder') return;

        let frame = 0;
        const tick = (now: number) =>
        {
            const rect = currentAim(pan.current.x, pan.current.y);

            if (rect && canvas.current)
            {
                blitRoomCanvasToViewfinder(canvas.current, SHOT, SHOT, FRAME_INTERVAL_MS, now, rect);

                if (!prepared.current)
                {
                    try
                    {
                        const roomFrame = getViewfinderRoomFrame(canvas.current, SHOT, SHOT, rect);

                        if (roomFrame)
                        {
                            // Best-effort warm-up with the same geometry the shutter will send.
                            SendMessageComposer(new RequestCameraConfigurationComposer(JSON.stringify(getTrustedCameraViewport(roomFrame))));
                            prepared.current = true;
                        }
                    }
                    catch
                    {
                        // Room geometry can be unavailable on the first frames, or outside the standard zoom.
                    }
                }
            }

            frame = window.requestAnimationFrame(tick);
        };

        frame = window.requestAnimationFrame(tick);

        return () => window.cancelAnimationFrame(frame);
    }, [page]);

    const startDrag = (event: PointerEvent<HTMLCanvasElement>) =>
    {
        drag.current = { x: event.clientX, y: event.clientY, panX: pan.current.x, panY: pan.current.y };
        event.currentTarget.setPointerCapture?.(event.pointerId);
    };
    const moveDrag = (event: PointerEvent<HTMLCanvasElement>) =>
    {
        if (!drag.current) return;

        // The screen shows the 320px shot at a smaller size; scale pointer movement back up to room pixels.
        const scale = SHOT / event.currentTarget.getBoundingClientRect().width;

        pan.current = {
            x: Math.max(-400, Math.min(400, drag.current.panX + (event.clientX - drag.current.x) * scale)),
            y: Math.max(-300, Math.min(300, drag.current.panY + (event.clientY - drag.current.y) * scale))
        };
    };
    const endDrag = () =>
    {
        drag.current = null;
    };

    const shoot = async () =>
    {
        if (busy) return;

        const rect = currentAim(pan.current.x, pan.current.y);
        const roomFrame = rect && getViewfinderRoomFrame(canvas.current, SHOT, SHOT, rect);
        const slot = cameraRollRef.current.findIndex(picture => !picture);

        if (!roomFrame)
        {
            setNotice('The camera needs a room to point at.');
            return;
        }
        if (slot < 0)
        {
            setNotice('Your camera roll is full. Delete a photo first.');
            return;
        }

        let viewport;

        try
        {
            viewport = getTrustedCameraViewport(roomFrame);
        }
        catch
        {
            setNotice('Zoom the room back to normal to take photos.');
            return;
        }

        setBusy(true);
        setNotice('');
        setFlash(value => value + 1);
        PlaySound(SoundNames.CAMERA_SHUTTER);

        const session = GetRoomSessionManager().getSession(-1);
        let draftId: string = null;

        try
        {
            const capture = await captureTrustedCamera(viewport);

            draftId = capture.draftId;
            const image = await loadTrustedCameraImage(capture);

            // The capture can finish after leaving the room or filling that slot some other way.
            if (cameraRollRef.current[slot] || GetRoomSessionManager().getSession(-1) !== session)
            {
                deleteTrustedCamera(capture.draftId);
                return;
            }

            const picture = new CameraPicture(VoltTexture.from(image), capture.url, capture.draftId, image.src);
            const next = cameraRollRef.current.map((existing, index) => (index === slot ? picture : existing));

            draftId = null;
            cameraRollRef.current = next;
            setCameraRoll(next);
        }
        catch (error)
        {
            VoltLogger.error('Phone camera capture failed', error);
            if (draftId) deleteTrustedCamera(draftId);
            if (mounted.current) setNotice('The photo could not be taken. Try again.');
        }
        finally
        {
            if (mounted.current) setBusy(false);
        }
    };

    const remove = (index: number) =>
    {
        const picture = cameraRollRef.current[index];

        if (!picture) return;

        deleteTrustedCamera(picture.draftId);
        picture.texture?.destroy?.(true);
        const next = cameraRollRef.current.map((existing, i) => (i === index ? null : existing));

        cameraRollRef.current = next;
        setCameraRoll(next);
        setPhotoIndex(-1);
        setPage('gallery');
    };

    const photos = cameraRoll.map((picture, index) => ({ picture, index })).filter(entry => entry.picture);
    const latest = photos.at(-1);

    if (page === 'gallery') return (
        <div className="district-phone__app-screen">
            <PhoneHeader title="Photos" backLabel="Camera" onBack={() => setPage('viewfinder')} />
            <div className="district-phone__photos">
                {photos.map(({ picture, index }) => (
                    <button key={index} type="button" className="district-phone__photo-tile" aria-label={`Photo ${index + 1}`} onClick={() =>
                    {
                        setPhotoIndex(index); setPage('photo');
                    }}>
                        <img src={picture.displayUrl} alt="" />
                    </button>
                ))}
                {!photos.length && <p className="district-phone__empty">No photos yet.</p>}
            </div>
            <p className="district-phone__hint">{photos.length} of {ROLL} photos</p>
        </div>
    );

    if (page === 'photo' && cameraRoll[photoIndex]) return (
        <div className="district-phone__app-screen">
            <PhoneHeader title="Photo" backLabel="Photos" onBack={() => setPage('gallery')} />
            <img className="district-phone__photo-full" src={cameraRoll[photoIndex].displayUrl} alt={`Photo ${photoIndex + 1}`} />
            <div className="district-phone__actions">
                <button type="button" className="district-phone__pill is-primary" disabled={!cameraRoll[photoIndex].draftId} onClick={() => CreateLinkEvent(`camera/edit/${photoIndex}`)}>Develop</button>
                <button type="button" className="district-phone__pill is-danger" onClick={() => remove(photoIndex)}>Delete</button>
            </div>
            <p className="district-phone__hint">Develop adds effects, then prints or publishes the photo.</p>
        </div>
    );

    return (
        <div className="district-phone__app-screen is-camera">
            <PhoneHeader title="Camera" backLabel="Home" onBack={onHome} />
            <div className="district-phone__viewfinder">
                <canvas
                    ref={canvas}
                    width={SHOT}
                    height={SHOT}
                    aria-label="Camera viewfinder; drag to aim"
                    onPointerDown={startDrag}
                    onPointerMove={moveDrag}
                    onPointerUp={endDrag}
                    onPointerCancel={endDrag} />
                <span className="district-phone__thirds" aria-hidden="true" />
                {!!flash && <span key={flash} className="district-phone__flash" aria-hidden="true" />}
            </div>
            <p className="district-phone__mode">PHOTO</p>
            {notice && <p className="district-phone__notice" role="status">{notice}</p>}
            <div className="district-phone__camera-bar">
                <button type="button" className="district-phone__last-photo" aria-label="Photos" onClick={() => setPage('gallery')}>
                    {latest && <img src={latest.picture.displayUrl} alt="" />}
                </button>
                <button type="button" className="district-phone__shutter" aria-label="Take photo" disabled={busy} onClick={() => void shoot()} />
                <button type="button" className="district-phone__recenter" aria-label="Aim at me" onClick={() =>
                {
                    pan.current = { x: 0, y: 0 };
                }}>⌖</button>
            </div>
        </div>
    );
};
