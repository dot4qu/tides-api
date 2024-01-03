import express from "express";
import {Router} from "express";
import fs from 'fs';

import {versionFilepath} from "./helpers";

const fsPromises = fs.promises;

export default function(): express.Router {
    const router = Router();

    router.post("/ota/version_info", async (req: express.Request, res: express.Response) => {
        if (!req.body || !req.body.current_version) {
            console.error(
                "Received POST for version info with either no body or no 'current_version' key sending 422. Body:");
            console.error(req.body);

            // Unproccessable Entity
            return res.status(422).send();
        }

        const reqBody: VersionRequest                       = req.body as VersionRequest;
        let                                      versionStr = "";
        try {
            const versionFile = await fsPromises.readFile(`${versionFilepath}/current_version.txt`);
            versionStr        = versionFile.toString().trim();
        } catch (e) {
            console.error(
                "Error opening current_version text file! Blindly returning no update needed so we don't kick device into offline mode: ");
            console.error(e);

            // If we couldn't parse the verison file, just act like the version they sent us is the current version
            versionStr = reqBody.current_version
        }

        const retVal: VersionResponse = {
            server_version : versionStr,
            needs_update : reqBody.current_version != undefined && reqBody.current_version < versionStr,
        };

        return res.json(retVal);
    });

    // Test cURL
    // clang-format off
    // curl -k -X GET "https://localhost:9443/ota/get_binary?device_id=ff-ff-ff-ff-ff-ff"
    // clang-format on
    router.get("/ota/get_binary", async (req: express.Request, res: express.Response) => {
        let binaryPath = undefined;
        if (req.query.version) {
            const queryStr: string = req.query.version as string;
            // TODO :: regex validate this (or check from known available versions)

            const requestedVersionNumberStrs: string[] = queryStr.split(".");
            const requestedBinaryPath = `${versionFilepath}/spot-check-firmware-${requestedVersionNumberStrs[0]}-${
                requestedVersionNumberStrs[1]}-${requestedVersionNumberStrs[2]}.bin`;

            try {
                await fsPromises.access(requestedBinaryPath);
                binaryPath = requestedBinaryPath;
            } catch (e) {
                console.error(`Received request for binary version ${queryStr} but don't have matching filepath ${
                    requestedBinaryPath}, falling back to current version`);
                binaryPath = undefined;
            }
        }

        if (!binaryPath) {
            const reqBody: VersionRequest                       = req.body as VersionRequest;
            let                                      versionStr = "";
            try {
                const versionFile = await fsPromises.readFile(`${versionFilepath}/current_version.txt`);
                versionStr        = versionFile.toString().trim();
            } catch (e) {
                console.error(
                    "Error opening current_version text file! Blindly returning no update needed so we don't kick device into offline mode: ");
                console.error(e);

                // If we couldn't parse the verison file, just act like the version they sent us is the current version
                versionStr = reqBody.current_version;
            }

            const currentVersionNumberStrs: string[] = versionStr.split(".");
            const currentBinaryPath = `${versionFilepath}/spot-check-firmware-${currentVersionNumberStrs[0]}-${
                currentVersionNumberStrs[1]}-${currentVersionNumberStrs[2]}.bin`;

            try {
                // if this fails, somethings messed up on the server side and we're missing a binary
                await fsPromises.access(currentBinaryPath);
                binaryPath = currentBinaryPath;
            } catch (e) {
                // TODO :: try to find the most recent good binary we have access to here
                console.error(`Received ota binary request but don't have matching binary filepath ${
                    currentBinaryPath} in current_version file, unrecoverable.`);

                // we can send an error code because the on-device OTA logic doesn't go through the same auto-handling
                // of online/offline mode transitions, so the ota process will just abort
                return res.status(404).send();
            }
        }

        return res.sendFile(binaryPath, {root : `${__dirname}/..`});
    });

    return router;
}
