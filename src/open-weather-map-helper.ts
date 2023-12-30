/*
export async function getWeather(latitude: number, longitude: number): Promise<Weather> {
    const weatherReq = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${latitude}&lon=${
        longitude}&appid=${process.env.OPENWEATHERMAP_API_KEY}&units=imperial`)
    const weatherResponse: OpenWeatherMapWeatherResponse = await weatherReq.json();
    if (weatherResponse.cod as number >= 400) {
        throw new Error(`Recieved ${weatherResponse.cod} from external weather api`);
    }

    return {temperature : weatherResponse.main.temp, wind : weatherResponse.wind};
}
*/

export async function getCurrentWeather(latitude: number, longitude: number): Promise<Weather> {
    // TODO :: imperial is hardcoded here, should match user request unit type
    const weatherReq = await fetch(`https://api.openweathermap.org/data/3.0/onecall?lat=${latitude}&lon=${
        longitude}&exclude=minutely,daily,hourly,alerts&units=imperial&appid=${
        process.env.OPENWEATHERMAP_API_KEY}&units=imperial`)
    const weatherResponse: OpenWeatherMapOneCallResponse = await weatherReq.json();
    // TODO :: handle any fetch issues here with a thrown Error

    const wind = {speed : weatherResponse.current.wind_speed, deg : weatherResponse.current.wind_deg};
    return {temperature : weatherResponse.current.temp, wind};
}

export async function getWeatherForecast(latitude: number, longitude: number): Promise<OpenWeatherMapOneCallResponse> {
    // TODO :: imperial is hardcoded here, should match user request unit type
    const weatherReq = await fetch(`https://api.openweathermap.org/data/3.0/onecall?lat=${latitude}&lon=${
        longitude}&exclude=minutely,daily,alerts&units=imperial&appid=${
        process.env.OPENWEATHERMAP_API_KEY}&units=imperial`)
    // TODO :: handle any fetch issues here with a thrown Error

    return await weatherReq.json();
}
