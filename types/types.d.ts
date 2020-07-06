interface TidesResponse {
    errorMessage?: string;
    data: any;
}

interface SurflineSurfObject {
    max?: number;
    min?: number;
    optimalScore?: number;
}

interface SurflineWaveResponse {
    timestamp: number;
    swells: any[];
    surf: SurflineSurfObject[];
}

interface SurflineTidesResponse {
    timestamp: number | Date;
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
