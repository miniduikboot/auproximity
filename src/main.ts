import "dotenv/config";
import socketio, { Socket } from "socket.io";

import { ExpressPeerServer } from "peer";
import { v4 } from "uuid";

import express from "express";
import http from "http";
import path from "path";
import sslRedirect from "heroku-ssl-redirect";
import * as Sentry from "@sentry/node";

import { AUProximityState } from "./types/models/AUProximityState";

import Client from "./Client";
import logger from "./util/logger";
import MediasoupManager from "./MediasoupManager";

const app = express();

if (typeof process.env.SENTRY_DSN !== "undefined") {
	logger.info("Activating Sentry error logging integration.");
	Sentry.init({ dsn: process.env.SENTRY_DSN });
	app.use(Sentry.Handlers.requestHandler());
} else {
	logger.info("Skipping Sentry error logging integration (not configured).");
}

app.use(sslRedirect());
app.use(express.static(path.join(__dirname, "dist")));

const server = http.createServer(app);

const io = new socketio.Server(
	server,
	process.env.NODE_ENV === "production"
		? {}
		: {
				cors: { origin: "http://localhost:8080" },
		  }
);

app.use(
	"/peerjs",
	ExpressPeerServer({
		// eslint-disable-next-line
		// @ts-ignore
		on(event, peerServerHandler) {
			server.on(event, (req, a, b) => {
				if (event === "upgrade" && !req.url.includes("socket.io")) {
					peerServerHandler(req, a, b);
				}
			});
		},
	})
);

export const state: AUProximityState = {
	allClients: [],
	allRooms: [],
	isClosing: false,
	mediasoupMgr: new MediasoupManager(),
};

state.mediasoupMgr.initialize();

io.on("connection", (socket: Socket) => {
	const client = new Client(socket, v4());
	state.allClients.push(client);
	logger.log("User connected, uuid:", client.uuid);
});

app.all("*", (req, res) => {
	res.sendFile(path.join(__dirname, "dist", "index.html"));
});

if (typeof process.env.SENTRY_DSN !== "undefined") {
	app.use(Sentry.Handlers.errorHandler());
}

const port = process.env.PORT || 8079;
server.listen(port, () => {
	logger.success(`Listening on port ${port}`);
});

async function gracefulShutdown() {
	if (state.isClosing) return;

	state.isClosing = true;

	logger.info("Shutting down gracefully..");
	logger.info(
		"Waiting for all rooms (" +
			state.allRooms.length +
			") currently playing to finish. Press Ctrl + C to exit immediately."
	);
	await Promise.allSettled(
		state.allRooms.map((room) => room.gracefulDestroy())
	);
	logger.success("All running games were closed, goodbye.");
	process.exit();
}

process.on("SIGINT", gracefulShutdown);

process.on("message", async (msg) => {
	logger.log(msg);
	if (msg === "shutdown") {
		await gracefulShutdown();
	}
});
