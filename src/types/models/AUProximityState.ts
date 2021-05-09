import Client from "../../Client";
import MediasoupManager from "../../MediasoupManager";
import Room from "../../Room";

export interface AUProximityState {
	allClients: Client[];
	allRooms: Room[];
	isClosing: boolean;
	mediasoupMgr: MediasoupManager;
}
