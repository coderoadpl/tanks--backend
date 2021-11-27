import { GameRepository } from './gameRepository'
import { playerInvariantProperties, PlayerService } from './playerService'
import { Game } from './types'
import { Server } from 'socket.io'

export const createGameService = ({ io, gameRepository, playerService }:{ io: Server, gameRepository: GameRepository, playerService: PlayerService }) => {
  return {
    createNewGame ({ startingPlayerConnectionId }: { startingPlayerConnectionId: string }) {
      const newGame = gameRepository.createNewGame({
        players: [startingPlayerConnectionId],
        board: {
          dimensions: {
            x: 500,
            y: 500
          },
          objects: [playerService.makePlayer({ playerId: startingPlayerConnectionId, top: 0, left: 0 })]
        }
      })
      return newGame
    },
    getGame (gameId: number) {
      return gameRepository.getGame(gameId)
    },
    updateGame (gameId: number, updateBody: Partial<Game>) {
      return gameRepository.updateGame(gameId, updateBody)
    },
    addPlayerToTheGame ({ playerId, gameId }: {playerId: string, gameId: number}) {
      const game = this.getGame(gameId)
      return gameRepository.updateGame(gameId, {
        players: game.players.concat(playerId),
        board: {
          ...game.board,
          objects: game.board.objects.concat(playerService.makePlayer({
            playerId,
            top: game.board.dimensions.y - playerInvariantProperties.height,
            left: game.board.dimensions.x - playerInvariantProperties.width
          }))
        }
      })
    },
    emitBoardChangedEvent (gameId: number) {
      const game = this.getGame(gameId)
      game.players.forEach((playerId) => {
        const playerSocket = io.sockets.sockets.get(playerId)
        if (playerSocket) playerSocket.emit('BOARD_CHANGED', game.board)
      })
    }
  }
}

export type GameService = ReturnType<typeof createGameService>
