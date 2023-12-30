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
