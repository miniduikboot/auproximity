import { Socket } from "socket.io";
import { Transport } from "mediasoup/lib/types";
import { Color } from "@skeldjs/constant";

import {
	BackendModel,
	BackendType,
	BepInExBackendModel,
	ImpostorBackendModel,
	NodePolusBackendModel,
	PublicLobbyBackendModel,
} from "./types/models/Backends";

import { GameSettings, HostOptions } from "./types/models/ClientOptions";

import { ClientSocketEvents } from "./types/enums/ClientSocketEvents";

import { ClientBase } from "./types/ClientBase";
import Room from "./Room";
import { state } from "./main";
import { PlayerFlag } from "./types/enums/PlayerFlags";
import { GameFlag } from "./types/enums/GameFlags";
import { GameState } from "./types/enums/GameState";
import { JOIN_TIMEOUT } from "./consts";
import MediasoupManager from "./MediasoupManager";

export interface PlayerPose {
	x: number;
	y: number;
}

export interface PlayerModel {
	name: string;
	position: PlayerPose;
	color: Color;
	flags: number;
	ventid: number;
}

export default class Client implements ClientBase {
	public socket: Socket;
	public room?: Room;

	public readonly uuid: string;

	public name: string;

	consumeTransport?: Transport;
	produceTransport?: Transport;

	private connected_at: number;

	constructor(socket: Socket, uuid: string) {
		this.socket = socket;
		this.uuid = uuid;
		this.name = "";
		this.connected_at = 0;

		// Initialize socket events
		this.socket.on(
			ClientSocketEvents.RemoveClient,
			async (payload: { uuid: string; ban: boolean }) => {
				if (
					this.room &&
					this.room.clients &&
					this.name === this.room.hostname
				) {
					const client = this.room.clients.find(
						(member) => member.uuid === payload.uuid
					);
					if (client) {
						await this.room.removeClient(client, payload.ban);
					}
				}
			}
		);

		this.socket.on(ClientSocketEvents.Disconnect, async () => {
			await this.handleDisconnect();
		});

		this.socket.on(
			ClientSocketEvents.JoinRoom,
			async (payload: { name: string; backendModel: BackendModel }) => {
				// Prevent users from spamming the join button
				const current_time = Date.now();
				if (current_time - this.connected_at < JOIN_TIMEOUT) {
					this.sendError(
						"Already joining, please wait 5 seconds before pressing the join button again",
						false
					);
					return;
				}
				this.connected_at = current_time;

				await this.joinRoom(payload.name, payload.backendModel);
			}
		);

		this.socket.on(
			ClientSocketEvents.SetOptions,
			async (payload: { options: HostOptions }) => {
				if (this.room && this.name === this.room.hostname) {
					await this.room.setOptions(payload.options);
				}
			}
		);

		this.socket.emit(ClientSocketEvents.SetUuid, this.uuid);
	}

	async joinRoom(name: string, backendModel: BackendModel): Promise<void> {
		if (this.room) {
			await this.leaveRoom();
		}

		this.name = name;

		if (state.isClosing) {
			await this.sendError(
				"AUProximity is currently undergoing maintenence, please try again in a few minutes.",
				true
			);
			return;
		}

		// TODO: make this just a deepEqual on backendModel
		let room = state.allRooms.find((room) => {
			if (room.backendModel.gameCode !== backendModel.gameCode) return false;

			if (
				room.backendModel.backendType === BackendType.Impostor &&
				backendModel.backendType === BackendType.Impostor
			) {
				return (
					(room.backendModel as ImpostorBackendModel).ip ===
					(backendModel as ImpostorBackendModel).ip
				);
			} else if (
				room.backendModel.backendType === BackendType.PublicLobby &&
				backendModel.backendType === BackendType.PublicLobby
			) {
				return (
					(room.backendModel as PublicLobbyBackendModel).region ===
					(backendModel as PublicLobbyBackendModel).region
				);
			} else if (
				room.backendModel.backendType === BackendType.NodePolus &&
				backendModel.backendType === BackendType.NodePolus
			) {
				return (
					(room.backendModel as NodePolusBackendModel).ip ===
					(backendModel as NodePolusBackendModel).ip
				);
			} else if (
				room.backendModel.backendType === BackendType.BepInEx &&
				backendModel.backendType === BackendType.BepInEx
			) {
				return (
					(room.backendModel as BepInExBackendModel).token ===
					(backendModel as BepInExBackendModel).token
				);
			}
			return false;
		});

		if (!room) {
			room = new Room(backendModel);
			state.allRooms.push(room);
			await room.initializeRouter();
		}

		room.addClient(this);
		this.room = room;

		this.consumeTransport = await room.router.createWebRtcTransport(
			MediasoupManager.transport_options
		);
		this.produceTransport = await room.router.createWebRtcTransport(
			MediasoupManager.transport_options
		);
	}

	async leaveRoom(): Promise<void> {
		this.name = "";
		if (!this.room) return;

		await this.room.removeClient(this, false);
		this.room = undefined;
	}

	async handleDisconnect(): Promise<void> {
		await this.leaveRoom();
		state.allClients = state.allClients.filter(
			(client) => client.uuid !== this.uuid
		);
	}

	sendError(err: string, fatal: boolean): void {
		this.socket.emit(ClientSocketEvents.Error, { err, fatal });
	}

	syncAllClients(array: ClientBase[]): void {
		this.socket.emit(ClientSocketEvents.SyncAllClients, array);
	}

	addClient(
		uuid: string,
		name: string,
		position: PlayerPose,
		color: Color
	): void {
		this.socket.emit(ClientSocketEvents.AddClient, {
			uuid,
			name,
			position,
			color,
		});
	}

	removeClient(uuid: string, ban: boolean): void {
		this.socket.emit(ClientSocketEvents.RemoveClient, { uuid, ban });
	}

	setPoseOf(uuid: string, position: PlayerPose): void {
		this.socket.emit(ClientSocketEvents.SetPositionOf, { uuid, position });
	}

	setVentOf(uuid: string, ventid: number): void {
		this.socket.emit(ClientSocketEvents.SetVentOf, { uuid, ventid });
	}

	setColorOf(uuid: string, color: Color): void {
		this.socket.emit(ClientSocketEvents.SetColorOf, { uuid, color });
	}

	setHost(name: string): void {
		this.socket.emit(ClientSocketEvents.SetHost, { name });
	}

	setOptions(options: HostOptions): void {
		this.socket.emit(ClientSocketEvents.SetOptions, { options });
	}

	setSettings(settings: GameSettings): void {
		this.socket.emit(ClientSocketEvents.SetSettings, { settings });
	}

	setGameState(state: GameState): void {
		this.socket.emit(ClientSocketEvents.SetGameState, { state });
	}

	setGameFlags(flags: GameFlag): void {
		this.socket.emit(ClientSocketEvents.SetGameFlags, { flags });
	}

	setFlagsOf(uuid: string, flags: PlayerFlag): void {
		this.socket.emit(ClientSocketEvents.SetFlagsOf, { uuid, flags });
	}
}
