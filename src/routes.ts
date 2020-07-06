import express from "express";
import { Router } from "express";

import * as surfline from "./surfline";

export default function(): express.Router {
    const router = Router();

    router.get("/tides", async (req: express.Request, res: express.Response) => {
        const tides = await surfline.getTides();
        return res.json(tides);
    });

    return router;
}
