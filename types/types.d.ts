interface TidesResponse {
    error?: string;
    message: string;
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
    timestamp: number;
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
