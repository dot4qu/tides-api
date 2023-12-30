interface SpotCheckApiResponse {
    errorMessage?: string;
    data: any;
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
