import { GameRepository } from './gameRepository'
import { playerInvariantProperties, PlayerService } from './playerService'
import { Game, Player, PlayerAction } from './types'
import { Server } from 'socket.io'

export const createGameService = ({ io, gameRepository, playerService }:{ io: Server, gameRepository: GameRepository, playerService: PlayerService }) => {
  return {
    startGameClock ({ gameId }: { gameId: number }) {
      const clockId = setInterval(() => this.processGameTick({ gameId }), Number(process.env.GAME_TICK_INTERVAL) || 50)
      return clockId
    },
    processGameTick ({ gameId }: { gameId: number }) {
      const game = this.getGame(gameId)
      game.players.forEach((playerId) => {
        const nextAction = game.nextPlayersAction[playerId]
        const player = game.board.objects.find((object) => object.id === playerId)
        if (!nextAction || !player) return
        const updatedPlayer = playerService.processPlayerAction({ player, action: nextAction })
        // todo check collisions
        this.updatePlayerOnBoard({ updatedPlayer, gameId })
        this.removeNextPlayerAction({ playerId })
        this.emitBoardChangedEvent(gameId)
      })
    },
    createNewGame ({ startingPlayerConnectionId }: { startingPlayerConnectionId: string }) {
      const newGame = gameRepository.createNewGame({
        players: [startingPlayerConnectionId],
        nextPlayersAction: {},
        board: {
          dimensions: {
            x: 500,
            y: 500
          },
          objects: [playerService.makePlayer({ playerId: startingPlayerConnectionId, top: 0, left: 0 })]
        }
      })
      const clockId = this.startGameClock({ gameId: newGame.id })
      const updatedGame = this.updateGame(newGame.id, { clockId })
      return updatedGame
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
    updatePlayerOnBoard ({ updatedPlayer, gameId }: {updatedPlayer: Player, gameId: number}) {
      const game = this.getGame(gameId)
      return gameRepository.updateGame(gameId, {
        board: {
          ...game.board,
          objects: game.board.objects.map((object) => {
            if (object.type !== 'player' || object.id !== updatedPlayer.id) return object
            return updatedPlayer
          })
        }
      })
    },
    saveNextPlayerAction ({ playerId, action }: { playerId: string, action: PlayerAction }) {
      const game = gameRepository.getGameByPlayerId(playerId)
      if (!game) return
      return gameRepository.updateGame(game.id, {
        ...game,
        nextPlayersAction: {
          ...game.nextPlayersAction,
          [playerId]: action
        }
      })
    },
    removeNextPlayerAction ({ playerId }: { playerId: string }) {
      const game = gameRepository.getGameByPlayerId(playerId)
      if (!game) return
      return gameRepository.updateGame(game.id, {
        ...game,
        nextPlayersAction: {
          ...game.nextPlayersAction,
          [playerId]: null
        }
      })
    },
    emitBoardChangedEvent (gameId: number) {
      const game = this.getGame(gameId)
      game.players.forEach((playerId) => {
        const playerSocket = io.sockets.sockets.get(playerId)
        if (playerSocket) playerSocket.emit('BOARD_CHANGED', game.board)
      })
    },
    handlePlayerAction ({ playerId, action }: { playerId: string, action: PlayerAction }) {
      const game = gameRepository.getGameByPlayerId(playerId)
      if (!game) return
      if (action.eventName === 'keydown') {
        this.saveNextPlayerAction({ playerId, action })
      }
      // if (action.eventName === 'keyup') {
      //   this.removeNextPlayerAction({ playerId })
      // }
    }
  }
}

export type GameService = ReturnType<typeof createGameService>
