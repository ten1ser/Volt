import { useEffect } from 'react';
import { useCityStatus } from '../../../hooks/roleplay/useCityStatus';
import { useRoom } from '../../../hooks/rooms/useRoom';

export const CityBackdrop = () =>
{
    const { city } = useCityStatus();
    const { setCityBackdropColor } = useRoom();
    useEffect(() =>
    {
        setCityBackdropColor?.(city?.backdropColor ?? null);
    }, [city?.backdropColor, setCityBackdropColor]);

    return null;
};
