import { PlayerPose } from "@/models/ClientModel";
import { GameMap } from "@skeldjs/constant";

export const CameraPositions = {
	[GameMap.TheSkeld]: [
		{
			x: -17.8,
			y: -4.8,
		},
		{
			x: 13.3,
			y: -4.2,
		},
		{
			x: -7.2,
			y: 1.8,
		},
		{
			x: 0.6,
			y: -6.5,
		},
	],
	[GameMap.MiraHQ]: [],
	[GameMap.Polus]: [
		{
			x: 4.8,
			y: -22.6,
		},
		{
			x: 24.4,
			y: -8.6,
		},
		{
			x: 29.1,
			y: -15.5,
		},
		{
			x: 11.6,
			y: -8.3,
		},
		{
			x: 15.5,
			y: -15.6,
		},
	],
	[GameMap.AprilFoolsTheSkeld]: [],
	[GameMap.Airship]: [
		{
			// Engine Room
			x: -8.42,
			y: 0.007,
		},
		{
			// Vault
			x: -3.91,
			y: 9.56,
		},
		{
			// Records Left
			x: 16.61,
			y: 10.31,
		},
		{
			// Records Right
			x: 23.75,
			y: 10.3,
		},
		{
			// Security
			x: 4.74,
			y: -11.15,
		},
		{
			// Cargo Bay
			x: 30.04,
			y: -0.38,
		},
		{
			// Meeting Room
			x: 3.09,
			y: 16.7,
		},
	],
};

export function getClosestCamera(position: PlayerPose, map: GameMap) {
	const cameras = CameraPositions[map];

	if (cameras.length) {
		let closest = cameras[0];
		let closestDist = Math.hypot(
			position.x - closest.x,
			position.y - closest.y
		);
		for (let i = 1; i < cameras.length; i++) {
			const pos = cameras[i];
			const dist = Math.hypot(position.x - pos.x, position.y - pos.y);

			if (dist < closestDist) {
				closest = pos;
				closestDist = dist;
			}
		}

		return closest;
	}

	return null;
}
