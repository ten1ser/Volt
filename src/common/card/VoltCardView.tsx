import { FC, useMemo, useRef, useState } from 'react';
import { Column, ColumnProps } from '..';
import { DraggableWindow, DraggableWindowPosition, DraggableWindowProps } from '../draggable-window';
import { CardResizeHandle } from './CardResizeHandle';
import { NativeFrameShadow } from './NativeFrameShadow';
import { VoltCardContextProvider } from './VoltCardContext';

export interface VoltCardViewProps extends DraggableWindowProps, ColumnProps {
    theme?: string;
    isResizable?: boolean;
    /** Window chrome. Defaults to the plain title bar; pass 3 for the official frame. */
    frameStyle?: number | null;
    /** Official 17px scrollbar skin (default). Pass false for the slim native scrollbar. */
    classicScrollbar?: boolean;
    resizeAxis?: 'both' | 'vertical' | 'horizontal';
    /** Frame 3 only: draw the window shadow with the native client's Canvas2D routine instead of the CSS drop-shadow (kept as the fallback). */
    nativeShadow?: boolean;
}

export const VoltCardView: FC<VoltCardViewProps> = (props) => {
    const {
        theme = 'primary',
        uniqueKey = null,
        handleSelector = '.drag-handler',
        windowPosition = DraggableWindowPosition.CENTER,
        disableDrag = false,
        overflow,
        position = 'relative',
        gap = 0,
        classNames = [],
        isResizable = true,
        frameStyle = null,
        classicScrollbar = true,
        resizeAxis = 'both',
        nativeShadow = false,
        children,
        dragStyle,
        offsetLeft,
        offsetTop,
        initialPosition,
        constrainToViewport,
        unconstrainedPosition,
        onPositionChange,
        ...rest
    } = props;
    const elementRef = useRef<HTMLDivElement>(null);
    const [isNativeShadowDrawn, setIsNativeShadowDrawn] = useState(false);

    const isWired =
        classNames.some((name) => name === 'volt-wired' || name.startsWith('volt-wired ')) ||
        (typeof rest.className === 'string' && rest.className.split(/\s+/).includes('volt-wired'));
    const resolvedFrameStyle = isWired ? null : frameStyle;
    const resolvedOverflow = overflow ?? (resolvedFrameStyle === 3 ? 'visible' : 'hidden');
    // An explicit dragStyle filter keeps winning; the CSS shadow stays until the native one is actually drawn and returns if it cannot be.
    const hasNativeShadow = nativeShadow && resolvedFrameStyle === 3 && !dragStyle?.filter;
    const isCssShadowOff = hasNativeShadow && isNativeShadowDrawn;

    const getClassNames = useMemo(() => {
        const newClassNames: string[] = [isResizable ? 'resize' : 'resize-none', 'volt-card', 'volt-card-shell', `theme-${theme}`];

        // Every window shares the DistrictRP frame; only theme="district" also gets the dark body. Wired editors keep their own skin.
        if (theme !== 'district' && !isWired) newClassNames.push('district-frame');

        // Frame 0 is the plain title bar, so it needs no class at all.
        if (resolvedFrameStyle) newClassNames.push(`volt-card-frame-${resolvedFrameStyle}`);
        newClassNames.push(classicScrollbar ? 'has-classic-scrollbar' : 'volt-scrollbar-native');
        if (classNames.length) newClassNames.push(...classNames);

        return newClassNames;
    }, [classNames, classicScrollbar, isResizable, isWired, resolvedFrameStyle, theme]);

    return (
        <VoltCardContextProvider value={{ theme }}>
            {/* Native Canvas shadowBlur=4 maps to CSS sigma 2, with alpha 0.349. Chrome truncates fractional offsets;
                3px is nearest to native 2.828px. This approximates the measured native shadow, rather than reproducing every edge pixel. */}
            <DraggableWindow
                disableDrag={disableDrag}
                dragStyle={resolvedFrameStyle === 3 && !isCssShadowOff ? { filter: 'drop-shadow(3px 3px 2px rgba(0, 0, 0, 0.349))', ...dragStyle } : dragStyle}
                handleSelector={handleSelector}
                offsetLeft={offsetLeft}
                offsetTop={offsetTop}
                initialPosition={initialPosition}
                constrainToViewport={constrainToViewport}
                unconstrainedPosition={unconstrainedPosition}
                onPositionChange={onPositionChange}
                uniqueKey={uniqueKey}
                windowPosition={windowPosition}
            >
                {hasNativeShadow && <NativeFrameShadow targetRef={elementRef} onReadyChange={setIsNativeShadowDrawn} />}
                <Column classNames={getClassNames} gap={gap} innerRef={elementRef} overflow={resolvedOverflow} position={position} {...rest}>
                    {children}
                    {isResizable && resolvedFrameStyle === 3 && <CardResizeHandle uniqueKey={uniqueKey} elementRef={elementRef} resizeAxis={resizeAxis} />}
                </Column>
            </DraggableWindow>
        </VoltCardContextProvider>
    );
};
