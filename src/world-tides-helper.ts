import moment from "moment";

export async function getTides(latitude: number, longitude: number): Promise<WorldTidesHeight[]> {
    // https://www.worldtides.info/api/v3?heights&date=2023-12-29&days=1&datum=MLLW&key=17328bc9-62f6-4860-a31e-516e1d820ec8&lat=33.5930302087&lon=-117.8819918632&step=3600
    // date needs to be YYYY-MM-dd
    // const formattedDate: string = date.format("YYYY-MM-DD");

    // TODO :: handle any fetch or json parse issues here with a thrown Error
    const tidesReq = await fetch(`https://www.worldtides.info/api/v3?heights&lat=${latitude}&lon=${
        longitude}&date=today&days=1&datum=MLLW&step=3600&key=${process.env.WORLDTIDES_API_KEY}`)
    const tidesResponse: WorldTidesResponse = await tidesReq.json();

    return tidesResponse.heights;
}
