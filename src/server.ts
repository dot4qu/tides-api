import express from "express";
import bodyParser from "body-parser";
import https from "https";
import http from "http";
import fs from "fs";

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

// HTTPS certs
let creds = {};
if (process.env.DEPLOY_STAGE === "PROD") {
    if (!process.env.PROD_SSL_KEY_PATH || !process.env.PROD_SSL_CERT_PATH || !process.env.PROD_SSL_CA_CERT_PATH) {
        console.log("SSL cert env variables not set. Source the setup_env.sh script");
        process.exit(1);
    }

    const key = fs.readFileSync(process.env.PROD_SSL_KEY_PATH);
    const cert = fs.readFileSync(process.env.PROD_SSL_CERT_PATH);
    const ca = fs.readFileSync(process.env.PROD_SSL_CA_CERT_PATH);
    creds = {
        key,
        cert,
        ca
    };
} else {
    console.log("Running server locally using local self-signed cert");
    const localKey = fs.readFileSync(__dirname + "/../spotcheck-selfsigned-key.pem", "utf-8");
    const localCert = fs.readFileSync(__dirname + "/../spotcheck-selfsigned-cert.pem", "utf-8");
    creds = {
        key: localKey,
        cert: localCert
    };
}

const httpsServer = https.createServer(creds, app);
const httpServer = http.createServer(app);
httpsServer.listen(9443);
httpServer.listen(9080);
