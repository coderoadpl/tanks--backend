import { Game, Store } from './types'

export const createGameRepository = ({ store }: { store: Store }) => {
  return {
    createNewGame ({ newGameData }: { newGameData: Omit<Game, 'id'> }): Game {
      const gameId = store.nextGameId
      store.nextGameId = store.nextGameId + 1
      const newGame = { ...newGameData, id: gameId }
      store.games = store.games.concat(newGame)
      console.log('createNewGame', store.games)
      return newGame
    },
    getGame ({ gameId } : {gameId: number}) {
      const game = store.games.find((game) => game.id === gameId)
      return game
    },
    updateGame ({ gameId, updateBody }: {gameId: number, updateBody: Partial<Game>}) {
      store.games = store.games.map((game) => {
        if (game.id !== gameId) return game
        return {
          ...game,
          ...updateBody
        }
      })
      return this.getGame({ gameId })
    },
    getGameByPlayerId ({ playerId }: { playerId: string }) {
      return store.games.find((game) => game.players.includes(playerId))
    },
    deleteGame ({ gameId }: {gameId: number}) {
      const gamesWithoutDeletedOne = store.games.filter((game) => game.id !== gameId)
      store.games = gamesWithoutDeletedOne
      console.log('deleteGame', store.games)
      return gamesWithoutDeletedOne
    }
  }
}

export type GameRepository = ReturnType<typeof createGameRepository>
