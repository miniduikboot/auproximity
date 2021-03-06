/**
 * This enum contains the possible states a game can be in.
 */
export enum GameState {
    /**
     * All players are currently in the lobby. New players can join the game
     */
    Lobby,
    /**
     * Players are currently playing the game.
     */
    InGame,
    /**
     * Players are currently holding a meeting
     */
    Meeting,
}
