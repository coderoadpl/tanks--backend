import { Game, Store } from './types'

const store: Store = {
  nextGameId: 0,
  games: []
}

export const createGameRepository = () => {
  return {
    createNewGame (newGame: Omit<Game, 'id'>): Game {
      const gameId = store.nextGameId
      store.nextGameId = store.nextGameId + 1
      store.games[gameId] = { ...newGame, id: gameId }
      return store.games[gameId]
    },
    getGame (gameId: number) {
      const game = store.games[gameId]
      console.log(store.games)
      return { ...game, id: gameId }
    },
    updateGame (gameId: number, updateBody: Partial<Game>) {
      const updatedGame = {
        ...store.games[gameId],
        ...updateBody
      }
      store.games[gameId] = updatedGame
      console.log(store.games)
      return updatedGame
    },
    getGameByPlayerId (playerId: string) {
      return store.games.find((game) => game.players.includes(playerId))
    }
  }
}

export type GameRepository = ReturnType<typeof createGameRepository>
