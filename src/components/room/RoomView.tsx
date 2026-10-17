import { GetEventDispatcher, GetRenderer, RoomObjectMouseEvent, RoomObjectTileMouseEvent, RoomSession } from '@volt/renderer';
import { AnimatePresence, motion } from 'framer-motion';
import { FC, useEffect, useRef } from 'react';
import { DispatchMouseEvent, DispatchTouchEvent, DispatchWheelEvent } from '../../api';
import { useRoom, useRoomKeyboardMovement } from '../../hooks';
import { classNames } from '../../layout';
import { RoomSpectatorView } from './spectator/RoomSpectatorView';
import { RoomWidgetsView } from './widgets/RoomWidgetsView';
import { WiredVariableFxOverlayView } from './widgets/wired-fx/WiredVariableFxOverlayView';
import { CityBackdrop } from '../roleplay/hud/CityBackdrop';

export const RoomView: FC<{}> = (props) => {
    const { roomSession = null } = useRoom();
    const elementRef = useRef<HTMLDivElement>(null);

    useRoomKeyboardMovement();

    useEffect(() => {
        if (!roomSession) return;

        const canvas = GetRenderer().canvas;

        if (!canvas) return;

        // AIR forwards a release over another window as a mouse up of the room (WME_UP_OUTSIDE).
        // Without it a room drag released over the UI never ends, and the next click is swallowed.
        let isPressed = false;
        let lastPointer = { clientX: 0, clientY: 0 };

        const rememberPointer = (event: MouseEvent) => (lastPointer = { clientX: event.clientX, clientY: event.clientY });

        canvas.onclick = (event) => DispatchMouseEvent(event);
        canvas.ondblclick = (event) => DispatchMouseEvent(event);
        canvas.onmousemove = (event) => {
            rememberPointer(event);
            DispatchMouseEvent(event);
        };
        canvas.onmousedown = (event) => {
            rememberPointer(event);
            isPressed = true;
            DispatchMouseEvent(event);
        };
        canvas.onmouseup = (event) => {
            isPressed = false;
            DispatchMouseEvent(event);
        };

        const onWindowMouseUp = (event: MouseEvent) => {
            if (!isPressed || event.target === canvas) return;

            isPressed = false;
            DispatchMouseEvent(event);
        };

        const onWindowBlur = () => {
            if (!isPressed) return;

            isPressed = false;
            DispatchMouseEvent(new MouseEvent('mouseup', lastPointer));
        };

        const onWheel = (event: WheelEvent) => DispatchWheelEvent(event, roomSession.roomId);

        window.addEventListener('mouseup', onWindowMouseUp, true);
        window.addEventListener('blur', onWindowBlur);
        canvas.addEventListener('wheel', onWheel, { passive: false });

        canvas.ontouchstart = (event) => DispatchTouchEvent(event);
        canvas.ontouchmove = (event) => DispatchTouchEvent(event);
        canvas.ontouchend = (event) => DispatchTouchEvent(event);
        canvas.ontouchcancel = (event) => DispatchTouchEvent(event);

        let touchStartX = 0;
        let touchStartY = 0;
        let touchMoved = false;
        let lastTileTap: { x: number; y: number; time: number } = null;

        const isMobileTouch = () => window.matchMedia('(pointer: coarse), (hover: none)').matches;

        const onTouchStart = (event: TouchEvent) => {
            const touch = event.touches[0];

            if (!touch || !isMobileTouch()) return;

            touchStartX = touch.clientX;
            touchStartY = touch.clientY;
            touchMoved = false;
        };

        const onTouchMove = (event: TouchEvent) => {
            const touch = event.touches[0];

            if (!touch || !isMobileTouch()) return;

            if (Math.abs(touch.clientX - touchStartX) > 8 || Math.abs(touch.clientY - touchStartY) > 8) touchMoved = true;
        };

        const onTouchEnd = (event: TouchEvent) => {
            const touch = event.changedTouches[0];

            if (!touch || touchMoved || !isMobileTouch()) return;

            lastTileTap = { x: touch.clientX, y: touch.clientY, time: Date.now() };
        };

        const showTouchFeedback = () => {
            if (!lastTileTap || Date.now() - lastTileTap.time > 250) return;

            const feedback = document.createElement('div');

            feedback.className = 'volt-room-touch-feedback';
            feedback.style.left = `${lastTileTap.x}px`;
            feedback.style.top = `${lastTileTap.y}px`;

            document.body.appendChild(feedback);
            window.setTimeout(() => feedback.remove(), 420);

            lastTileTap = null;
        };

        const onTileClick = (event: RoomObjectMouseEvent) => {
            if (event instanceof RoomObjectTileMouseEvent) window.setTimeout(showTouchFeedback, 0);
        };

        canvas.addEventListener('touchstart', onTouchStart, { passive: true });
        canvas.addEventListener('touchmove', onTouchMove, { passive: true });
        canvas.addEventListener('touchend', onTouchEnd, { passive: true });
        GetEventDispatcher().addEventListener(RoomObjectMouseEvent.CLICK, onTileClick);

        const element = elementRef.current;

        if (element) {
            canvas.classList.add('bg-black');

            element.appendChild(canvas);
        }

        return () => {
            window.removeEventListener('mouseup', onWindowMouseUp, true);
            window.removeEventListener('blur', onWindowBlur);
            canvas.removeEventListener('wheel', onWheel);
            canvas.removeEventListener('touchstart', onTouchStart);
            canvas.removeEventListener('touchmove', onTouchMove);
            canvas.removeEventListener('touchend', onTouchEnd);
            GetEventDispatcher().removeEventListener(RoomObjectMouseEvent.CLICK, onTileClick);
        };
    }, [roomSession]);

    return (
        <AnimatePresence>
            {
                <motion.div className="w-full h-full" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <div ref={elementRef} className="w-full h-full">
                        <CityBackdrop />
                        <WiredVariableFxOverlayView />
                        {roomSession instanceof RoomSession && (
                            <>
                                <RoomWidgetsView />
                                {roomSession.isSpectator && <RoomSpectatorView />}
                            </>
                        )}
                    </div>
                </motion.div>
            }
        </AnimatePresence>
    );
};
