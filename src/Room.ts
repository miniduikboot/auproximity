import { Color, GameMap } from "@skeldjs/constant";
import { Router } from "mediasoup/lib/types";

import { BackendEvent } from "./types/enums/BackendEvents";

import { GameSettings, HostOptions } from "./types/models/ClientOptions";

import {
	BackendType,
	BackendModel,
	ImpostorBackendModel,
	PublicLobbyBackendModel,
} from "./types/models/Backends";

import { BackendAdapter } from "./backends/Backend";

import ImpostorBackend from "./backends/ImpostorBackend";
import NoOpBackend from "./backends/NoOpBackend";
import PublicLobbyBackend from "./backends/PublicLobbyBackend";

import Client, { PlayerModel, PlayerPose } from "./Client";
import { PlayerFlag } from "./types/enums/PlayerFlags";

import { state } from "./main";
import { GameState } from "./types/enums/GameState";
import { GameFlag } from "./types/enums/GameFlags";
import { sleep } from "./util/sleep";
import logger from "./util/logger";

const GameEndTimeout = 10 * 60 * 1000;

export default class Room {
	public backendModel: BackendModel;
	public backendAdapter: BackendAdapter;
	public clients: Client[] = [];
	public bans: Set<string> = new Set();
	public router?: Router;

	map: GameMap;
	hostname: string;
	flags = 0;
	state: GameState = GameState.Lobby;
	options: HostOptions = {
		falloff: 4.5,
		falloffVision: false,
		colliders: false,
		paSystems: true,
		commsSabotage: true,
		meetingsCommsSabotage: true,
	};
	settings: GameSettings = {
		crewmateVision: 1,
		map: GameMap.TheSkeld,
	};
	players = new Map<string, PlayerModel>();

	constructor(backendModel: BackendModel) {
		this.backendModel = backendModel;
		this.backendAdapter = Room.buildBackendAdapter(backendModel);
		this.initializeBackend();
		this.initializeRouter();
	}

	private static buildBackendAdapter(
		backendModel: BackendModel
	): BackendAdapter {
		if (backendModel.backendType === BackendType.PublicLobby) {
			return new PublicLobbyBackend(backendModel as PublicLobbyBackendModel);
		} else if (backendModel.backendType === BackendType.Impostor) {
			return new ImpostorBackend(backendModel as ImpostorBackendModel);
		} else {
			return new NoOpBackend();
		}
	}

	private initializeBackend() {
		this.backendAdapter.on(
			BackendEvent.PlayerPose,
			(payload: { name: string; position: PlayerPose; ventid: number }) => {
				const client = this.getClientByName(payload.name);

				if (client) {
					this.clients.forEach((c) => {
						c.setPoseOf(client.uuid, payload.position);
					});
				}
			}
		);

		this.backendAdapter.on(
			BackendEvent.PlayerVent,
			(payload: { name: string; ventid: number }) => {
				const client = this.getClientByName(payload.name);
				const player = this.getPlayerByName(payload.name);

				player.ventid = payload.ventid;

				if (client) {
					this.clients.forEach((c) => {
						c.setVentOf(client.uuid, payload.ventid);
					});
				}
			}
		);

		this.backendAdapter.on(
			BackendEvent.PlayerColor,
			(payload: { name: string; color: Color }) => {
				const client = this.getClientByName(payload.name);
				const player = this.getPlayerByName(payload.name);

				player.color = payload.color;

				if (client) {
					this.clients.forEach((c) => {
						c.setColorOf(client.uuid, payload.color);
					});
				}
			}
		);

		this.backendAdapter.on(
			BackendEvent.HostChange,
			async (payload: { name: string }) => {
				this.hostname = payload.name;

				this.clients.forEach((c) => {
					c.setHost(this.hostname);
				});
			}
		);

		this.backendAdapter.on(
			BackendEvent.GameState,
			async (payload: { state: GameState }) => {
				this.state = payload.state;
				if (this.state === GameState.Lobby) {
					this.flags = GameFlag.None;
					for (const [, player] of this.players) {
						player.flags = PlayerFlag.None;
					}
				}

				this.clients.forEach((c) => {
					c.setGameState(this.state);
					for (const [name, player] of this.players) {
						const client = this.getClientByName(name);
						if (client) {
							c.setFlagsOf(client.uuid, player.flags);
						}
					}
				});
			}
		);

		this.backendAdapter.on(
			BackendEvent.SettingsUpdate,
			async (payload: { settings: GameSettings }) => {
				this.settings = payload.settings;

				this.clients.forEach((c) => {
					c.setSettings(payload.settings);
				});
			}
		);

		this.backendAdapter.on(
			BackendEvent.PlayerFlags,
			async (payload: { name: string; flags: PlayerFlag; set: boolean }) => {
				const client = this.getClientByName(payload.name);
				const player = this.getPlayerByName(payload.name);

				if (payload.set) {
					player.flags |= payload.flags;
				} else {
					player.flags &= ~payload.flags;
				}

				if (client) {
					this.clients.forEach((c) => {
						c.setFlagsOf(client.uuid, player.flags);
					});
				}
			}
		);

		this.backendAdapter.on(
			BackendEvent.GameFlags,
			async (payload: { flags: number; set: boolean }) => {
				if (payload.set) {
					this.flags |= payload.flags;
				} else {
					this.flags &= ~payload.flags;
				}

				this.clients.forEach((c) => {
					c.setGameFlags(this.flags);
				});
			}
		);

		this.backendAdapter.on(
			BackendEvent.Error,
			async (payload: { err: string; fatal: boolean }) => {
				this.clients.forEach((c) => {
					c.sendError(payload.err, payload.fatal);
				});

				if (payload.fatal) await this.destroy();
			}
		);

		this.backendAdapter.initialize();
	}

	private initializeRouter() {
		state.mediasoupMgr
			.createRouter()
			.then((r) => (this.router = r))
			.catch((e) => logger.error(e));
	}

	getPlayerByName(name: string): PlayerModel {
		const found = this.players.get(name.toLowerCase().trim());

		if (found) {
			return found;
		}

		const player: PlayerModel = {
			name,
			position: { x: 0, y: 0 },
			color: -1,
			flags: PlayerFlag.None,
			ventid: -1,
		};

		this.players.set(name.toLowerCase().trim(), player);
		return player;
	}

	getClientByName(name: string): Client | undefined {
		return this.clients.find(
			(client) =>
				client.name?.toLowerCase()?.trim() === name.toLowerCase().trim()
		);
	}

	addClient(client: Client): void {
		if (this.bans.has(client.socket.handshake.address)) {
			return client.removeClient(client.uuid, true);
		}

		const player = this.getPlayerByName(client.name);

		client.syncAllClients(
			this.clients.map((c) => ({
				uuid: c.uuid,
				name: c.name,
			}))
		);

		this.clients.forEach((c) => {
			c.addClient(client.uuid, player.name, player.position, player.color);
			c.setPoseOf(client.uuid, player.position);
			c.setColorOf(client.uuid, player.color);

			const p = this.getPlayerByName(c.name);
			client.setColorOf(c.uuid, p.color);
			client.setPoseOf(c.uuid, p.position);
			client.setFlagsOf(c.uuid, p.flags);
		});

		this.clients.push(client);

		client.setPoseOf(client.uuid, player.position);
		client.setColorOf(client.uuid, player.color);
		client.setGameState(this.state);
		client.setGameFlags(this.flags);
		client.setSettings(this.settings);

		client.setHost(this.hostname);

		client.setOptions(this.options);
	}

	async removeClient(client: Client, ban: boolean): Promise<void> {
		this.clients.forEach((c) => c.removeClient(client.uuid, ban));
		this.clients = this.clients.filter((c) => c.uuid !== client.uuid);
		if (ban) {
			this.bans.add(client.socket.handshake.address);
		}
		if (this.clients.length === 0) await this.destroy();
	}

	setOptions(options: HostOptions, host = false): void {
		this.options = options;

		this.clients.forEach((c) => {
			if (c.name !== this.hostname || host) c.setOptions(options);
		});
	}

	private waitForEnd(): Promise<void> {
		return new Promise((resolve) => {
			// eslint-disable-next-line @typescript-eslint/no-this-alias
			const _this = this;
			this.backendAdapter.on(
				BackendEvent.GameState,
				async function onGameStateChange(payload: { state: GameState }) {
					if (payload.state === GameState.Lobby) {
						_this.backendAdapter.off(BackendEvent.GameState, onGameStateChange);
						resolve();
					}
				}
			);
		});
	}

	async gracefulDestroy(): Promise<void> {
		if (this.state !== GameState.Lobby) {
			this.clients.forEach((c) => {
				c.sendError(
					"AUProximity will be going into maintenance, you will not be able to start another game.",
					false
				);
			});

			await Promise.race([this.waitForEnd(), sleep(GameEndTimeout)]);
		}

		this.clients.forEach((c) => {
			c.sendError("Game closed for maintenance.", true);
		});

		await this.destroy();
	}

	async destroy(): Promise<void> {
		if (this.clients.length > 0) {
			for (const c of this.clients) {
				await c.leaveRoom();
			}
			return;
		}

		state.allRooms = state.allRooms.filter((room) => room !== this);

		if (this.router !== undefined && this.router.closed == false) {
			this.router.close();
		}

		if (this.backendAdapter.destroyed) return;

		await this.backendAdapter.destroy();
	}
}
