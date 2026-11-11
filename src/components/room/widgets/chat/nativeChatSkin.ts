import baseUrl from '@/assets/images/chat/chatbubbles/native-default-base.png';
import tintUrl from '@/assets/images/chat/chatbubbles/native-default-tint.png';

const loadBitmap = (url: string): Promise<HTMLImageElement> => new Promise((resolve, reject) => {
    const bitmap = new Image();
    bitmap.onload = () => resolve(bitmap);
    bitmap.onerror = reject;
    bitmap.src = url;
});
let bitmaps: Promise<HTMLImageElement[]>;
const skins = new Map<string, Promise<string>>();

// v75 style_normal: copy neutral base, RGB-multiply the mask, then DARKEN.
export const getNativeDefaultSkin = (color: string): Promise<string> => {
    const tint = color || '#ffffff';
    const cached = skins.get(tint);
    if (cached) return cached;
    bitmaps ??= Promise.all([loadBitmap(baseUrl), loadBitmap(tintUrl)]);
    const skin = bitmaps.then(([base, mask]) => {
        const canvas = document.createElement('canvas');
        canvas.width = mask.width;
        canvas.height = mask.height;
        const context = canvas.getContext('2d');
        context.drawImage(mask, 0, 0);
        const pixels = context.getImageData(0, 0, mask.width, mask.height);
        const rgb = Number.parseInt(tint.substring(1), 16);
        for (let i = 0; i < pixels.data.length; i += 4) {
            pixels.data[i] = Math.round(pixels.data[i] * ((rgb >> 16) & 255) / 255);
            pixels.data[i + 1] = Math.round(pixels.data[i + 1] * ((rgb >> 8) & 255) / 255);
            pixels.data[i + 2] = Math.round(pixels.data[i + 2] * (rgb & 255) / 255);
        }
        context.putImageData(pixels, 0, 0);
        const output = document.createElement('canvas');
        output.width = base.width;
        output.height = base.height;
        const target = output.getContext('2d');
        target.drawImage(base, 0, 0);
        target.globalCompositeOperation = 'darken';
        target.drawImage(canvas, 0, 0);
        return output.toDataURL('image/png');
    });
    if (skins.size >= 200) skins.delete(skins.keys().next().value);
    skins.set(tint, skin);
    return skin;
};

// Native chatstyles_xml IDs resolved through each style_*_regpoints.
const ANONYMOUS_STYLES = new Set([1, 34, 200, 201, 202, 210, 211, 212, 220, 221, 222, 223, 224, 225, 226, 227, 228, 229, 250, 251, 252]);
const LARGE_FONT_STYLES = new Set([33, 34, 200, 201, 202, 210, 211, 212, 220, 221, 222, 223, 224, 225, 226, 227, 228, 229, 250, 251, 252]);
export const isNativeAnonymousStyle = (id: number): boolean => ANONYMOUS_STYLES.has(id);
export const getNativeChatBaseFontSize = (id: number): number => LARGE_FONT_STYLES.has(id) ? 17 : 12;
// Ordinary talk (0) and the DistrictRP action colours (server RpChat: 3 injury, 4 combat, 5 work, 6 money, 7 crime,
// 11 items, 12 medical, 13 phone) and client radio lines (900) and the RP action strips (901 shooting, 902 knockout,
// 903 medical, 904 hit, 905 rob, 906 phone, 907 money, 908 work, 909 items, 910 HP, 911 missed punch,
// 912 missed shot, 913 ended call) share the plain bold-name room text.
const DISTRICT_PLAIN_STYLES = new Set([0, 3, 4, 5, 6, 7, 11, 12, 13, 900, 901, 902, 903, 904, 905, 906, 907, 908, 909, 910, 911, 912, 913]);
export const isDistrictPlainStyle = (id: number): boolean => DISTRICT_PLAIN_STYLES.has(id);
// RP action lines put the asterisk before the actor's name, not before the action text.
export const splitRpLeadingAsterisk = (styleId: number, html: string): { prefix: string; html: string } =>
    styleId >= 901 && styleId <= 913 && html.startsWith('*') ? { prefix: '*', html: html.slice(1) } : { prefix: '', html };
