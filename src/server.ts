import bodyParser from "body-parser";
import express from "express";
import fs from "fs";
import http from "http";
import https from "https";
import moment from "moment";

import {authenticate} from "./auth-handler";
import {twoDigits} from "./helpers";
import router from "./routes";

const app  = express();
const port = 9443;

app.use(bodyParser.json());

// Logging must go after bodyparser in order to log post data
app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
    const now      = moment();
    let   postData = "";
    if (req.method == "POST") {
        postData = "- " + JSON.stringify(req.body);
    }

    console.log(`[${twoDigits(now.date())}.${twoDigits(now.month())}.${now.year()} ${twoDigits(now.hour())}:${
        twoDigits(now.minute())}:${twoDigits(now.second())}] ${req.method} ${req.url} ${postData}`);
    next();
});

// Must come before router to force all routes through function
app.use((req, res, next) => authenticate(req, res, next));
app.use(router());

if (!process.env.OPENWEATHERMAP_API_KEY) {
    console.log("No OpenWeatherMap API key env variable set, did you source setup_env.sh?");
    process.exit(1);
}

// HTTPS certs
let creds = {};
if (process.env.DEPLOY_STAGE === "PROD") {
    if (!process.env.PROD_SSL_KEY_PATH || !process.env.PROD_SSL_CERT_PATH || !process.env.PROD_SSL_CA_CERT_PATH) {
        console.log("SSL cert env variables not set. Source the setup_env.sh script");
        process.exit(1);
    }

    const key  = fs.readFileSync(process.env.PROD_SSL_KEY_PATH);
    const cert = fs.readFileSync(process.env.PROD_SSL_CERT_PATH);
    const ca   = fs.readFileSync(process.env.PROD_SSL_CA_CERT_PATH);
    creds      = {
        key,
        cert,
        ca,
    };
} else {
    console.log("Running server locally using local self-signed cert");
    const localKey  = fs.readFileSync(__dirname + "/../spotcheck-selfsigned-key.pem", "utf-8");
    const localCert = fs.readFileSync(__dirname + "/../spotcheck-selfsigned-cert.pem", "utf-8");
    creds           = {
        key : localKey,
        cert : localCert,
    };
}

if (process.env.DEPLOY_STAGE !== "PROD") {
    const httpServer = http.createServer(app);
    httpServer.listen(9080);
    console.log(`Dev http server running on port ${9080}`);
}

const httpsServer = https.createServer(creds, app);
httpsServer.listen(port);
console.log(`HTTPS-only server running on port ${port}`);
