import {
    AvatarFigurePartType,
    AvatarScaleType,
    AvatarSetType,
    GetAvatarRenderManager,
    GetRoomEngine,
    PetFigureData,
    TextureUtils,
    Vector3d
} from '@volt/renderer';
import { GetConfigurationValue } from '../../volt/GetConfigurationValue';

export class ChatBubbleUtilities {
    private static MAX_CACHE_SIZE: number = 1024;
    // Rows of the face icon a one-line bubble shows, in CSS pixels.
    private static FACE_WINDOW_HEIGHT: number = 28;
    // How long a bubble waits for a speaker's clothing libraries before falling back to the placeholder head.
    private static FIGURE_WAIT_MS: number = 8000;

    public static AVATAR_COLOR_CACHE: Map<string, number> = new Map();
    public static AVATAR_IMAGE_CACHE: Map<string, string> = new Map();
    public static PET_IMAGE_CACHE: Map<string, string> = new Map();
    private static AVATAR_IMAGE_PENDING_CACHE: Map<string, Promise<string>> = new Map();
    private static PET_IMAGE_PENDING_CACHE: Map<string, Promise<string>> = new Map();

    private static PLACEHOLDER_IMAGE_CACHE: Map<string, string> = new Map();

    private static pruneCache<T>(cache: Map<string, T>, maxSize: number = ChatBubbleUtilities.MAX_CACHE_SIZE): void {
        if (cache.size <= maxSize) return;

        const deleteCount = cache.size - maxSize;
        const iterator = cache.keys();

        for (let i = 0; i < deleteCount; i++) {
            cache.delete(iterator.next().value as string);
        }
    }

    public static async setFigureImage(figure: string, zoom: boolean = GetConfigurationValue<boolean>('zoom.enabled', false), highResolution: boolean = false, waitForFigure: boolean = true): Promise<string> {
        let figureReady: () => void = null;
        const ready = new Promise<boolean>(resolve => { figureReady = () => resolve(true); });
        // Low-res keeps the half-size head. High-res keeps the LARGE head and crops it 1:1 into a 2x canvas.
        const avatarImage = GetAvatarRenderManager().createAvatarImage(figure, highResolution ? AvatarScaleType.LARGE : AvatarScaleType.SMALL, null, {
            resetFigure: () => figureReady(),
            dispose: () => {},
            disposed: false
        });

        if (!avatarImage) return null;

        const isPlaceholder = avatarImage.isPlaceholder();

        // The figure's libraries are still downloading: wait for them and draw the real head for the requested figure.
        // The renderer reports readiness with its normalised figure string, so the retry keeps the original one;
        // otherwise the placeholder would stay cached under the speaker's figure and every bubble would show it.
        if (isPlaceholder && waitForFigure) {
            avatarImage.dispose();
            await Promise.race([ready, new Promise<boolean>(resolve => setTimeout(() => resolve(false), ChatBubbleUtilities.FIGURE_WAIT_MS))]);

            return this.setFigureImage(figure, zoom, highResolution, false);
        }

        const placeholderKey = this.getImageCacheVariant(zoom, highResolution);
        const placeholderImageUrl = this.PLACEHOLDER_IMAGE_CACHE.get(placeholderKey);

        if (isPlaceholder && placeholderImageUrl?.length) {
            avatarImage.dispose();
            return placeholderImageUrl;
        }

        // Chat reads the colour with the room unit's figure string, which the renderer may normalise.
        const requestedFigure = figure;
        figure = avatarImage.getFigure().getFigureString();

        avatarImage.setDirection(AvatarSetType.HEAD, 2);
        const sourceUrl = avatarImage.processAsImageUrl(AvatarSetType.HEAD);
        const color = avatarImage.getPartColor(AvatarFigurePartType.CHEST);
        if (!isPlaceholder) {
            this.AVATAR_COLOR_CACHE.set(requestedFigure, (color && color.rgb) || 16777215);
            this.pruneCache(this.AVATAR_COLOR_CACHE);
        }
        avatarImage.dispose();
        const source = await new Promise<HTMLImageElement>((resolve, reject) => {
            const image = new Image();
            image.onload = () => resolve(image);
            image.onerror = reject;
            image.src = sourceUrl;
        });
        const imageUrl = this.focusFace(source, (zoom ? 25 : 50) * (highResolution ? 2 : 1), highResolution ? 2 : 1).toDataURL('image/png');
        // A placeholder head is never stored under the speaker's figure, so the next bubble tries the real head again.
        if (isPlaceholder) this.PLACEHOLDER_IMAGE_CACHE.set(placeholderKey, imageUrl);
        else {
            this.AVATAR_IMAGE_CACHE.set(this.getAvatarImageCacheKey(requestedFigure, zoom, highResolution), imageUrl);
            this.pruneCache(this.AVATAR_IMAGE_CACHE);
        }

        return imageUrl;
    }

    /**
     * The face icon the official client builds with HabboFaceFocuser. The official fixed crop assumes its own
     * avatar canvas, which Volt's head image does not share, so the head is placed by its visible pixels instead.
     * A bubble shows only the icon's bottom rows (about 28 px for one line of text), so the head is centred in
     * that window, like the pet heads beside it. A head too tall for the window (big hats) keeps its chin near
     * the bottom instead.
     */
    private static focusFace(head: HTMLCanvasElement | HTMLImageElement, size: number, scale: number): HTMLCanvasElement {
        const width = head.width;
        const height = head.height;
        const source = document.createElement('canvas');
        source.width = width;
        source.height = height;
        const sourceContext = source.getContext('2d');
        sourceContext.drawImage(head, 0, 0);

        const alpha = sourceContext.getImageData(0, 0, width, height).data;
        let left = width, top = height, right = -1, bottom = -1;

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                if (alpha[(y * width + x) * 4 + 3] === 0) continue;
                if (x < left) left = x;
                if (x > right) right = x;
                if (y < top) top = y;
                if (y > bottom) bottom = y;
            }
        }

        const face = document.createElement('canvas');
        face.width = size;
        face.height = size;

        if (right < 0) return face;

        const context = face.getContext('2d');
        context.imageSmoothingEnabled = false;
        const headHeight = bottom + 1 - top;
        const faceWindow = Math.min(size, ChatBubbleUtilities.FACE_WINDOW_HEIGHT * scale);
        const faceY = headHeight <= faceWindow ? size - (faceWindow + headHeight) / 2 - top : size * 0.94 - (bottom + 1);

        context.drawImage(source, Math.round(size / 2 - (left + right + 1) / 2), Math.round(faceY));

        return face;
    }

    public static async getUserImage(figure: string, highResolution: boolean = false): Promise<string> {
        const zoom = GetConfigurationValue<boolean>('zoom.enabled', false);
        const key = this.getAvatarImageCacheKey(figure, zoom, highResolution);
        const existing = this.AVATAR_IMAGE_CACHE.get(key);
        if (existing) {
            // Reading a hot speaker must keep their head and colour near the end of the LRU.
            this.AVATAR_IMAGE_CACHE.delete(key);
            this.AVATAR_IMAGE_CACHE.set(key, existing);
            const color = this.AVATAR_COLOR_CACHE.get(figure);
            if (color !== undefined) {
                this.AVATAR_COLOR_CACHE.delete(figure);
                this.AVATAR_COLOR_CACHE.set(figure, color);
            }
            return existing;
        }
        const pending = this.AVATAR_IMAGE_PENDING_CACHE.get(key);
        if (pending) return pending;
        const request = this.setFigureImage(figure, zoom, highResolution);
        this.AVATAR_IMAGE_PENDING_CACHE.set(key, request);
        try {
            return await request;
        } finally {
            if (this.AVATAR_IMAGE_PENDING_CACHE.get(key) === request) this.AVATAR_IMAGE_PENDING_CACHE.delete(key);
        }
    }

    public static async getPetImage(figure: string, direction: number, headOnly: boolean, scale: number = 64, posture: string = null) {
        const cacheKey = `${figure}-${posture || 'std'}-${direction}-${scale}-${headOnly ? 'head' : 'full'}`;
        let existing = this.PET_IMAGE_CACHE.get(cacheKey);

        if (existing) {
            this.PET_IMAGE_CACHE.delete(cacheKey);
            this.PET_IMAGE_CACHE.set(cacheKey, existing);
            return existing;
        }

        const pending = this.PET_IMAGE_PENDING_CACHE.get(cacheKey);

        if (pending) return pending;

        const resultPromise = (async () => {
            const figureData = new PetFigureData(figure);
            const typeId = figureData.typeId;

            const getImageUrl = async (imageResult) => {
                if (!imageResult) return null;

                const image = await imageResult.getImage();

                if (image) return image.src;
                if (imageResult.data) return TextureUtils.generateImageUrl(imageResult.data);

                return null;
            };

            let listenerResolve = null;

            const listenerPromise = new Promise<string>((resolve) => {
                listenerResolve = resolve;
            });

            // Pet bundles only carry 64 sprites, so a smaller scale is rendered at 64 and shrunk afterwards.
            const imageResult = GetRoomEngine().getRoomObjectPetImage(
                typeId,
                figureData.paletteId,
                figureData.color,
                new Vector3d(direction * 45),
                64,
                {
                    imageReady: async (result) => listenerResolve(await getImageUrl(result)),
                    imageFailed: () => listenerResolve(null)
                },
                headOnly || typeId === 35,
                0,
                figureData.customParts,
                posture
            );

            let resolvedImage: string = null;

            if (imageResult?.id > 0) {
                resolvedImage = await Promise.race([listenerPromise, new Promise<string>((resolve) => setTimeout(() => resolve(null), 2500))]);
            }

            if (!resolvedImage) resolvedImage = await getImageUrl(imageResult);

            if (resolvedImage && scale < 64) resolvedImage = await this.scaleImage(resolvedImage, scale / 64);

            if (resolvedImage) {
                this.PET_IMAGE_CACHE.set(cacheKey, resolvedImage);
                this.pruneCache(this.PET_IMAGE_CACHE);
            }

            return resolvedImage;
        })();

        this.PET_IMAGE_PENDING_CACHE.set(cacheKey, resultPromise);

        try {
            existing = await resultPromise;
        } finally {
            this.PET_IMAGE_PENDING_CACHE.delete(cacheKey);
        }

        return existing;
    }

    private static async scaleImage(sourceUrl: string, ratio: number): Promise<string> {
        const source = await new Promise<HTMLImageElement>((resolve, reject) => {
            const image = new Image();
            image.onload = () => resolve(image);
            image.onerror = reject;
            image.src = sourceUrl;
        });
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(source.width * ratio));
        canvas.height = Math.max(1, Math.round(source.height * ratio));
        const context = canvas.getContext('2d');
        context.imageSmoothingEnabled = true;
        context.drawImage(source, 0, 0, canvas.width, canvas.height);

        return canvas.toDataURL('image/png');
    }

    private static getImageCacheVariant(zoom: boolean, highResolution: boolean): string {
        return `${highResolution ? 'high' : 'low'}:${zoom ? 'zoom' : 'normal'}`;
    }

    private static getAvatarImageCacheKey(figure: string, zoom: boolean, highResolution: boolean): string {
        return `${this.getImageCacheVariant(zoom, highResolution)}:${figure}`;
    }
}
