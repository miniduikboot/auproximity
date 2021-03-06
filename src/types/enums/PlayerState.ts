/**
 * This enum contains the possible states each player can be in.
 */
export enum PlayerState {
    /**
     * This player is in the lobby.
     */
    InLobby,
    /**
     * This player is in an active game.
     */
    InGame,
    /**
     * This player has been killed or exiled.
     */
    Dead,
    /**
     * This player is no longer connected to the server.
     */
    Disconnected,
}
