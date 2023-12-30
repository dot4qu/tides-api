interface SpotCheckApiResponse {
    errorMessage?: string;
    data: any;
}

interface SurflineSurfObject {
    max?: number;
    min?: number;
    optimalScore?: number;
}

interface SurflineWaveResponse {
    timestamp: number|import("moment").Moment;
    utcOffset: number;
    swells: any[];
    surf: SurflineSurfObject;
}

interface SurflineTidesResponse {
    timestamp: number|import("moment").Moment;
    utcOffset: number;
    type: string;
    height: number;
}

// One of the two will be null depending on which URL is requested
interface SurflineBaseDataObject {
    wave?: SurflineWaveResponse[];
    tides?: SurflineTidesResponse[];
}

interface SurflineBaseApiResponse {
    associated: any;
    data: SurflineBaseDataObject
}

interface OpenWeatherMapWeatherObject {
    id: number;
    main: string;
    description: string;
    icon: string;
}

interface OpenWeatherMapForecastObject {
    dt: number;       // epoch
    sunrise: number;  // epoch
    sunset: number;   // epoch
    temp: number;
    feels_like: number;
    pressure: number;
    humidity: number;
    dew_point: number;
    uvi: number;
    clouds: number;
    visibility: number;  // meters?
    wind_speed: number;
    wind_deg: number;
    weather: OpenWeatherMapWeatherObject[];
}

interface OpenWeatherMapOneCallResponse {
    lat: number;
    lon: number;
    timezone: string;
    timezone_offset: number;  // seconds
    current: OpenWeatherMapForecastObject;
    hourly: OpenWeatherMapForecastObject[];
}

interface Wind {
    speed: number;
    deg: number;
}

interface Weather {
    temperature: number;
    wind: Wind;
}

interface VersionRequest {
    current_version: string;
    device_id: string;
}

interface VersionResponse {
    server_version: string;
    needs_update: bool;
}

interface CurrentTide {
    height: number;
    rising: boolean;
}

interface DailySwellValues {
    dayString: string;
    max: number;
    min: number;
}
