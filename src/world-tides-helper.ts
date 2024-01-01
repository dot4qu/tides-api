import moment from "moment-timezone";

export async function getTides(latitude: number, longitude: number): Promise<WorldTidesResponse> {
    // TODO :: handle any fetch or json parse issues here with a thrown Error
    const tidesReq = await fetch(`https://www.worldtides.info/api/v3?heights&lat=${latitude}&lon=${
        longitude}&date=today&days=1&datum=MLLW&step=3600&timezone&key=${process.env.WORLDTIDES_API_KEY}`)
    const tidesResponse: WorldTidesResponse = await tidesReq.json();

    return tidesResponse;
}
