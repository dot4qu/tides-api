import express from "express";
import bodyParser from "body-parser";
// import https from "https";
import http from "http";

import router from "./routes"

const app = express();
app.use(bodyParser.json());

app.use(router());

const httpServer = http.createServer(app);
httpServer.listen(9000);
