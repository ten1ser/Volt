import { CSSProperties, FC, ReactNode, useLayoutEffect, useRef, useState } from 'react';
import guildColorBottom from '../../../assets/images/groups/native/group_guild_color_btm.png';
import { NativeText } from '../../../common/native-text/NativeText';
import { NativeFontStyle } from '../../../common/native-text/NativeFont';
import { NativeTextStyleName } from '../../../common/native-text/NativeTextStyles';
import { useVoltCardContext } from '../../../common/card/VoltCardContext';

// groups_main_window client coordinates: the frame draws 33px of title above them.
export const GROUP_SURFACE = 0xe9e9e1;
export const GROUP_HEADER_SURFACE = 0xb3b099;
// The caption's field sits above the 33px frame header; its glyphs start 12px below the window top.
const TITLE_Y = 9;

interface GroupTextProps {
    text: string;
    x: number;
    y: number;
    width?: number;
    height?: number;
    textStyle?: NativeTextStyleName;
    overrides?: Partial<NativeFontStyle>;
    background?: number;
    align?: 'left' | 'center';
    leading?: number;
    /** word_wrap / multiline fields wrap at their width; auto_size fields never do. */
    wrap?: boolean;
    /** Draw the glyphs onto a skin instead of a flat surface: black text multiplies over white, white text screens over black. */
    blend?: 'multiply' | 'screen';
    className?: string;
    onClick?: () => void;
}

/** html text fields turn <br/> into line breaks; the rest of these strings carry no markup. */
const toNativeText = (text: string) => text.replace(/<br\s*\/?>/gi, '\n').replace(/\n+$/, '');

/** One v75 TextField placed at its layout rectangle (x, y, width, height). */
export const GroupText: FC<GroupTextProps> = ({
    text,
    x,
    y,
    width,
    height,
    textStyle = 'u_regular',
    overrides,
    background = GROUP_SURFACE,
    align = 'left',
    leading,
    wrap = false,
    blend,
    className = '',
    onClick
}) =>
{
    const textRef = useRef<HTMLDivElement>(null);
    const district = useVoltCardContext().theme === 'district';
    const [centerOffset, setCenterOffset] = useState(0);
    const isCentered = align === 'center' && width !== undefined;

    // auto_size center puts the field at floor((width - fieldWidth) / 2).
    useLayoutEffect(() =>
    {
        const field = textRef.current?.firstElementChild;

        if (!isCentered || !field) return;

        const center = () => setCenterOffset(Math.floor((width - field.getBoundingClientRect().width) / 2));
        const observer = new ResizeObserver(center);

        center();
        observer.observe(field);

        return () => observer.disconnect();
    }, [isCentered, width, text]);

    // A TextField keeps its 2px gutter at the bottom: rows below height - 2 are clipped.
    const style: CSSProperties = {
        mixBlendMode: district ? undefined : blend,
        left: x + (isCentered ? centerOffset : 0),
        top: y,
        width: wrap ? width : undefined,
        height: height === undefined ? undefined : height - 2
    };

    return (
        <div ref={textRef} className={`volt-group-native__text${height === undefined ? '' : ' is-clipped'} ${className}`} style={style} onClick={onClick}>
            {district ? <span className="district-group-text" style={{
                display: 'inline-block',
                fontSize: overrides?.size ?? (textStyle === 'u_frame_title' ? 13 : 12),
                fontWeight: overrides?.bold || textStyle.includes('bold') || textStyle === 'u_frame_title' ? 700 : 400,
                fontStyle: overrides?.italic ? 'italic' : undefined,
                color: overrides?.color === undefined || overrides.color === 0 || overrides.color === 0xffffff ? undefined : `#${overrides.color.toString(16).padStart(6, '0')}`,
                whiteSpace: wrap ? 'pre-wrap' : 'pre',
                maxWidth: wrap ? width : undefined,
                lineHeight: leading === undefined ? '1.25' : `${(overrides?.size ?? 12) + leading}px`
            }}>{toNativeText(text)}</span> : <NativeText
                background={blend === 'multiply' ? 0xffffff : blend === 'screen' ? 0x000000 : background}
                leading={leading}
                maxWidth={wrap ? width : undefined}
                overrides={overrides}
                text={toNativeText(text)}
                textStyle={textStyle}
            />}
        </div>
    );
};

/** Window text with the explicit font variables of the group layouts (sharpness 0, thickness 0). */
export const flatText = (size: number, extra: Partial<NativeFontStyle> = {}): Partial<NativeFontStyle> => ({ size, sharpness: 0, thickness: 0, ...extra });

interface GroupBoxProps {
    kind: 'white' | 'outline' | 'yellow' | 'red' | 'gray' | 'cc' | 'slot' | 'tan' | 'dark';
    onClick?: () => void;
    x: number;
    y: number;
    width: number;
    height: number;
    className?: string;
    children?: ReactNode;
}

/** border style 0 (white, or tinted 0xffc300 / 0xcc0000 / 0xaaaaaa), 5 (outline), or style 3 (slot) white or tinted 0xe9e9e1 / 0xbebba5. */
export const GroupBox: FC<GroupBoxProps> = ({ kind, x, y, width, height, className = '', onClick, children }) => (
    <div className={`volt-group-native__box is-${kind} ${className}`} style={{ left: x, top: y, width, height }} onClick={onClick}>
        {children}
    </div>
);

interface GroupButtonProps {
    label: string;
    x: number;
    y: number;
    width: number;
    height: number;
    disabled?: boolean;
    /** Pixels the native client sits the caption right of the centred position (the narrow Purchase button). */
    labelShift?: number;
    onClick: () => void;
}

/** button_thick, style 3 (habbo_skin_button_shiny_thick). */
export const GroupButton: FC<GroupButtonProps> = ({ label, x, y, width, height, disabled = false, labelShift = 0, onClick }) => (
    <button
        className="volt-group-native__button"
        disabled={disabled}
        style={{ left: x, top: y, width, height, paddingLeft: labelShift * 2 }}
        type="button"
        onClick={onClick}
    >
        <GroupText blend="multiply" className="is-static" text={label} textStyle="u_bold" x={0} y={0} />
    </button>
);

/** group_guild_color_btm tinted with the guild colour, group_guild_color_top drawn over it. */
export const GroupSwatch: FC<{ color: string; x: number; y: number }> = ({ color, x, y }) => (
    <div className="volt-group-native__swatch" style={{ left: x, top: y, '--group-color': '#' + color } as CSSProperties}>
        <img alt="" draggable={false} src={guildColorBottom} />
        <span className="volt-group-native__swatch-fill" />
    </div>
);

interface GroupInputProps {
    label: string;
    value: string;
    maxLength: number;
    x: number;
    y: number;
    width: number;
    height: number;
    multiline?: boolean;
    /** The forum compose fields have no border, a larger face and their own text margin. */
    plain?: boolean;
    fontSize?: number;
    inset?: number;
    onChange: (value: string) => void;
}

/**
 * An editable input TextField. The browser input keeps its own visible text while it has focus or whenever the v75 raster would not
 * sit inside the field (overflow, unsupported glyphs), so caret, selection, scrolling and IME stay the browser's; at rest the
 * v75 raster is drawn over the input.
 */
export const GroupInput: FC<GroupInputProps> = ({ label, value, maxLength, x, y, width, height, multiline = false, plain = false, fontSize = 13, inset = 1, onChange }) =>
{
    const district = useVoltCardContext().theme === 'district';
    const overlayRef = useRef<HTMLDivElement>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [rasterFits, setRasterFits] = useState(false);

    // The raster fits when it was drawn natively (no glyph fallback) and stays inside the bordered field.
    useLayoutEffect(() =>
    {
        const overlay = overlayRef.current;
        const field = overlay?.firstElementChild as HTMLElement | null;

        if (!field) return;

        const measure = () =>
        {
            const isNative = field.dataset.nativeText !== 'fallback';

            setRasterFits(isNative && field.offsetWidth <= width - 2 && field.offsetHeight <= height - 2);
        };
        const observer = new ResizeObserver(measure);
        const mutations = new MutationObserver(measure);

        measure();
        observer.observe(field);
        mutations.observe(field, { attributes: true, attributeFilter: ['data-native-text'] });

        return () =>
        {
            observer.disconnect();
            mutations.disconnect();
        };
    }, [value, width, height, multiline]);

    const showRaster = !district && !isEditing && rasterFits && value.length > 0;
    const inputProps = {
        'aria-label': label,
        className: 'volt-group-native__input' + (showRaster ? ' is-raster' : ''),
        maxLength,
        style: plain ? { fontSize, lineHeight: Math.round(fontSize * 1.25) + 'px', paddingLeft: inset, paddingRight: inset } : undefined,
        value,
        onBlur: () => setIsEditing(false),
        onFocus: () => setIsEditing(true)
    };

    return (
        <div className={`volt-group-native__field${multiline ? ' is-multiline' : ''}${plain ? ' is-plain' : ''}${plain && value.length === 0 ? ' is-empty' : ''}`} style={{ left: x, top: y, width, height }}>
            {multiline ? (
                <textarea {...inputProps} onChange={(event) => onChange(event.target.value)} />
            ) : (
                <input {...inputProps} type="text" onChange={(event) => onChange(event.target.value)} />
            )}
            {!district && <div ref={overlayRef} aria-hidden="true" className={`volt-group-native__field-text${showRaster ? '' : ' is-hidden'}`} style={plain ? { top: 0, left: inset - 1 } : undefined}>
                <NativeText background={0xffffff} maxWidth={multiline ? width - (plain ? 2 * (inset - 1) : 0) : undefined} overrides={flatText(fontSize)} text={value} textStyle="u_regular" />
            </div>}
        </div>
    );
};

/** The frame caption: u_frame_title drawn with the v75 raster, centred across the whole window. */
export const GroupWindowTitle: FC<{ title: string; width: number }> = ({ title, width }) => (
    <GroupText
        align="center"
        blend="screen"
        className="is-title"
        overrides={{ color: 0xffffff }}
        text={title}
        textStyle="u_frame_title"
        width={width}
        x={0}
        y={TITLE_Y}
    />
);
