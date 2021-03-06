import { ColorID } from "@skeldjs/constant";
import { EventEmitter } from "events";
import util from "util";
import chalk from "chalk";

import logger from "../util/logger";

import { Pose } from "../Client";

import { BackendModel, BackendType } from "../types/models/Backends";
import { GameSettings } from "../types/models/ClientOptions";
import { RoomGroup } from "../types/enums/RoomGroup";
import { BackendEvent } from "../types/enums/BackendEvent";
import { PlayerFlags } from "../types/enums/PlayerFlags";
import { GameState } from "../types/enums/GameState";

export type LogMode = "log" | "info" | "success" | "fatal" | "warn" | "error";

// Actual backend class
export abstract class BackendAdapter extends EventEmitter {
    abstract backendModel: BackendModel;
    destroyed: boolean;
    gameID: string;
    gameState: GameState;

    protected constructor() {
        super();
    }

    abstract initialize(): void;
    abstract destroy(): void;

    log(mode: LogMode, format: string, ...params: unknown[]): void {
        const formatted = util.format(format, ...params);

        logger[mode](chalk.grey("[" + BackendType[this.backendModel.backendType] + " " + this.gameID + "]"), formatted);
    }

    emitGameState(state: GameState): void {
        this.gameState = state;
        switch (state) {
            case GameState.Lobby:
            // fallthrough
            case GameState.InGame:
                this.emitAllPlayerJoinGroups(RoomGroup.Main);
                break;
            case GameState.Meeting:
                this.emitAllPlayerPoses({ x: 0, y: 0 });
                break;
        }
    }

    emitPlayerState(name: String, state: PlayerState): void {
        switch (state) {
            // TODO
        }
    }

    emitPlayerPose(name: string, pose: Pose): void {
        this.emit(BackendEvent.PlayerPose, { name, pose });
    }

    emitPlayerColor(name: string, color: ColorID): void {
        this.emit(BackendEvent.PlayerColor, { name, color });
    }

    /**
     * @deprecated("use emitPlayerState instead")
     */
    emitPlayerJoinGroup(name: string, group: RoomGroup): void {
        this.emit(BackendEvent.PlayerJoinGroup, { name, group });
    }

    emitAllPlayerPoses(pose: Pose): void {
        this.emit(BackendEvent.AllPlayerPoses, { pose });
    }

    /**
     * @deprecated("use emitGameState instead")
     */
    emitAllPlayerJoinGroups(group: RoomGroup): void {
        this.emit(BackendEvent.AllPlayerJoinGroups, { group });
    }

    /**
     * @deprecated("use emitGameState instead")
     */
    emitPlayerFromJoinGroup(from: RoomGroup, to: RoomGroup): void {
        this.emit(BackendEvent.PlayerFromJoinGroup, { from, to });
    }

    emitHostChange(hostname: string): void {
        this.emit(BackendEvent.HostChange, { hostname });
    }

    emitSettingsUpdate(settings: GameSettings): void {
        this.emit(BackendEvent.SettingsUpdate, { settings });
    }

    emitPlayerFlags(name: string, flags: PlayerFlags, set: boolean): void {
        this.emit(BackendEvent.PlayerFlags, { name, flags, set });
    }

    emitError(err: string, fatal: boolean): void {
        this.emit(BackendEvent.Error, { err, fatal });
    }
}
