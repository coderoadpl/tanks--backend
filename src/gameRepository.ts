export type Game = {
  players: string[]
}

const store = {
  nextGameId: 0,
  games: [] as Game[]
}

export const createGameRepository = () => {
  return {
    createNewGame (newGame: Game) {
      const gameId = store.nextGameId
      store.nextGameId = store.nextGameId + 1
      store.games[gameId] = newGame
      console.log(store.games)
      return gameId
    },
    getGame (gameId: number) {
      const game = store.games[gameId]
      console.log(store.games)
      return game
    },
    updateGame: (gameId: number, updateBody: Partial<Game>) => {
      const updatedGame = {
        ...store.games[gameId],
        ...updateBody
      }
      store.games[gameId] = updatedGame
      console.log(store.games)
      return updatedGame
    }
  }
}
