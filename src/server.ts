import express from "express";
import bodyParser from "body-parser";
// import https from "https";
import http from "http";

import router from "./routes";
import { twoDigits } from "./helpers";

const app = express();

app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
    const now = new Date();
    console.log(`[${twoDigits(now.getHours())}:${twoDigits(now.getMinutes())}:${twoDigits(now.getSeconds())}] ${req.url}`);
    next();
});

app.use(bodyParser.json());
app.use(router());

const httpServer = http.createServer(app);
httpServer.listen(9080);
