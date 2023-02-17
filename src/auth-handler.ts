import {NextFunction, Request, Response} from "express";

export async function authenticate(req: Request, res: Response, next: NextFunction) {
    // No auth needed for healhcheck
    if (req.path == "/health") {
        return next();
    }

    let deviceId = null;
    if (req.method == "GET") {
        deviceId = req.query["device_id"];
    } else if (req.method == "POST") {
        deviceId = req.body["device_id"];
    } else {
        return res.status(405).send("Unsupported request type");
    }

    if (!deviceId || deviceId == null) {
        return res.status(403).send("'device_id' field not found");
    }

    // Matches single hex byte, i.e. ab, AB, a9, etc.
    const hexByteRegexStr = "[a-fA-F0-9]{2}";

    // Matches 5 repetitions of previous hex byte regex plus '-' char, with another sixth byte regex appended with no
    // '-' char
    const validDeviceIdRegex = new RegExp("^((" + hexByteRegexStr + "-){5})" + hexByteRegexStr + "$");
    // console.log(validDeviceIdRegex);

    if (!validDeviceIdRegex.test(deviceId)) {
        return res.status(403).send("'device_id' field not valid");
    }

    next();
}
