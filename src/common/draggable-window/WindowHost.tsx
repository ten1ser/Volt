import { Key, ReactNode, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { create } from 'zustand';

interface WindowDestination {
    id: string;
    element: HTMLElement;
    keys: readonly string[];
    prefixes: readonly string[];
    windows: Set<string>;
    active: boolean;
    token: object;
    present: (key: string, mounted: boolean) => void;
    escape: () => boolean;
}

const useDestinations = create<{ hosts: WindowDestination[] }>(() => ({ hosts: [] }));
let front = 0;
export const hasWindowHost = (id: string) => useDestinations.getState().hosts.some(host => host.id === id);
export const hasHostedWindow = (id: string) => useDestinations.getState().hosts.some(host => host.id === id && host.windows.size > 0);

export const useWindowDestination = (key: Key | null) => useDestinations(state =>
{
    if (key == null) return undefined;
    const matches = state.hosts.filter(host => host.keys.includes(String(key)) || host.prefixes.some(prefix => String(key).startsWith(prefix)));
    return matches.find(host => host.active) ?? matches.find(host => host.windows.has(String(key))) ?? matches[0];
});

/** Explicitly registered destinations only; unrelated desktop windows keep their own portal. */
export const WindowHost = ({ id, keys, prefixes = [], active = true, onPresent, onReady, onEscape, children }: {
    id: string; keys: readonly string[]; prefixes?: readonly string[];
    active?: boolean;
    onPresent: (key: string, mounted: boolean) => void; onReady?: () => void; onEscape?: () => void; children?: ReactNode;
}) =>
{
    const [element, setElement] = useState<HTMLDivElement | null>(null);
    const notify = useRef(onPresent);
    const ready = useRef(onReady);
    const escape = useRef(onEscape);
    notify.current = onPresent;
    ready.current = onReady;
    escape.current = onEscape;
    const signature = JSON.stringify([keys, prefixes]);
    useLayoutEffect(() =>
    {
        if (!element) return;
        const [acceptedKeys, acceptedPrefixes] = JSON.parse(signature) as [string[], string[]];
        const windows = new Set<string>();
        const token = {};
        const host: WindowDestination = { id, element, keys: acceptedKeys, prefixes: acceptedPrefixes, windows, active, token, escape: () =>
        {
            if (!escape.current) return false;
            escape.current(); return true;
        }, present: (key, mounted) =>
        {
            if (mounted) windows.add(key);
            else windows.delete(key);
            notify.current(key, mounted);
        } };
        useDestinations.setState(state => ({ hosts: [...state.hosts.filter(item => item.id !== id), host] }));
        ready.current?.();
        return () => useDestinations.setState(state => ({ hosts: state.hosts.filter(item => item.token !== token) }));
    }, [id, element, signature]);
    useLayoutEffect(() =>
    {
        useDestinations.setState(state => ({ hosts: state.hosts.map(host => host.id === id && host.active !== active ? { ...host, active } : host) }));
    }, [id, active]);
    return <div ref={setElement} className="phone-window-host">{children}</div>;
};

export const HostedWindow = ({ destination, windowKey, children }: { destination: WindowDestination; windowKey: Key; children?: ReactNode }) =>
{
    const [order, setOrder] = useState(() => ++front);
    useEffect(() =>
    {
        destination.present(String(windowKey), true);
        return () => destination.present(String(windowKey), false);
    }, [destination, windowKey]);
    return createPortal(<div className="phone-hosted-window" data-window-key={windowKey} data-primary={destination.keys[0] === String(windowKey) || undefined}
        style={{ zIndex: order }} onPointerDownCapture={() => setOrder(++front)} onKeyDown={event =>
        {
            // Portal events follow this source tree rather than the handset's React ancestry.
            if (event.key === 'Escape' && !event.defaultPrevented && destination.escape()) event.stopPropagation();
        }}>{children}</div>, destination.element);
};
