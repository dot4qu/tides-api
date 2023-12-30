interface WorldTidesHeight {
    dt: number;      // epoch
    date: string;    // ISO8601 string with timezone of station where tides came from
    height: number;  // meters always, no option for imperial
}

interface WorldTidesResponse {
    status: number;
    error: string?;  // Error text if status != 200, otherwise not present
    callCount: number;
    copyright: string;
    requestLat: number;
    requestLon: number;
    responseLat: number;
    responseLon: number;
    atlas: string;  // "NOAA" for US reqs
    station: string;
    requestDatum: string;
    responseDatum: string;
    heights: WorldTidesHeight[];
}
