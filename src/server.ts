// This automagically patches all express handlers to properly pass errors in async handlers to the global error handler
// middleware that we've overriden (just like what happens out of the box from express with non-async handlers)
import "express-async-errors";

import bodyParser from "body-parser";
import express from "express";
import fs from "fs";
import http from "http";
import https from "https";
import moment from "moment-timezone";

import {authenticate} from "./auth-handler";
import {twoDigits} from "./helpers";
import otaRouter from "./ota-routes";
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

// Auth must come before router to force all routes to auth before their standard endpoint handlers
app.use((req, res, next) => authenticate(req, res, next));
app.use(router());
app.use(otaRouter());

/*
 * Global error handler since we want custom handling for non-caught exceptions (default Express handler will 500
 * everything but we don't want that behavior if, for example, the plotly image failed to generate or surfline API
 * response is malformed. 500s from the server represent no server connection at all to the embedded device and will
 * kick it into offline mode. We want to handle the situation of 'server up, support services down' here, so device can
 * happily/unknowingly render the placeholders we give it
 */
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error(`UNHANDLED EXCEPTION IN EXPRESS CODE! Type: ${err.name}, Message: ${err.message}`);
    return res.status(200).send();
});

if (!process.env.OPENWEATHERMAP_API_KEY) {
    console.log("No OpenWeatherMap API key env variable set, did you source setup_env.sh?");
    process.exit(1);
}

if (!process.env.WORLDTIDES_API_KEY) {
    console.log("No World Tides API key env variable set, did you source setup_env.sh?");
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
