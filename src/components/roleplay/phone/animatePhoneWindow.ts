/** Animate only the native window requested by this tap, without touching its drag transform. */
export const animatePhoneWindow = (key: string, origin: { x: number; y: number }): (() => void) =>
{
    const host = document.getElementById('draggable-windows-container');
    if (!host || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return () => {};

    const findWindow = () => Array.from(host.querySelectorAll<HTMLElement>('[data-window-key]'))
        .find(element => element.dataset.windowKey === key);
    // Existing visible windows retain their normal toggle/focus behavior.
    if (findWindow()?.style.visibility === 'visible') return () => {};

    let animation: Animation | undefined;
    const observer = new MutationObserver(() =>
    {
        const wrapper = findWindow();
        const content = wrapper?.firstElementChild as HTMLElement | null;
        if (!content || wrapper.style.visibility !== 'visible') return;
        observer.disconnect();
        clearTimeout(expiry);
        if (typeof content.animate !== 'function') return;
        const rect = content.getBoundingClientRect();
        const x = Math.max(-40, Math.min(40, (origin.x - rect.left - rect.width / 2) * .12));
        const y = Math.max(-30, Math.min(30, (origin.y - rect.top - rect.height / 2) * .12));
        animation = content.animate([
            { opacity: 0, transform: `translate(${x}px, ${y}px) scale(.94)` },
            { opacity: 1, transform: 'translate(0, 0) scale(1)' }
        ], { duration: 220, easing: 'cubic-bezier(.2,.8,.2,1)' });
    });
    const expiry = window.setTimeout(() => observer.disconnect(), 800);
    observer.observe(host, { childList: true, subtree: true, attributes: true, attributeFilter: ['style'] });
    return () =>
    {
        observer.disconnect();
        clearTimeout(expiry);
        animation?.cancel();
    };
};
