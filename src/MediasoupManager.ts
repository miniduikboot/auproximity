import { createWorker } from "mediasoup";
import {
	Worker,
	WorkerSettings,
	RouterOptions,
	WebRtcTransportOptions,
	Router,
} from "mediasoup/lib/types";

export default class MediasoupManager {
	static worker_settings: WorkerSettings = {
		logLevel: "warn",
	};

	// Only enable Opus as an audio codec
	// For supported values check https://github.com/versatica/mediasoup/blob/v3/src/supportedRtpCapabilities.ts
	static router_options: RouterOptions = {
		mediaCodecs: [
			{
				kind: "audio",
				mimeType: "audio/opus",
				clockRate: 48000,
				channels: 2,
			},
		],
	};

	// Configure the options for WebRTC transports
	// https://mediasoup.org/documentation/v3/mediasoup/api/#WebRtcTransportOptions
	static transport_options: WebRtcTransportOptions = {
		listenIps: ["127.0.0.1"], //TODO read in from config
		enableUdp: true,
		enableTcp: true,
		preferUdp: true,
	};

	// Workers are mediasoup processes
	// NOTE: you need to manually manage mediasoup objects! See https://mediasoup.org/documentation/v3/mediasoup/garbage-collection/ for details
	worker: Worker;

	async initialize(): Promise<void> {
		if (this.worker === undefined) {
			this.worker = await createWorker(MediasoupManager.worker_settings);
		}
	}

	async destroy(): Promise<void> {
		if (this.worker !== undefined) {
			this.worker.close();
		}
	}

	async createRouter(): Promise<Router> {
		if (this.worker === undefined) {
			this.initialize();
		}
		return this.worker.createRouter(MediasoupManager.router_options);
	}
}
