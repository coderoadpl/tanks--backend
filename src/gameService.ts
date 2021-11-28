import { GameRepository } from './gameRepository'
import { playerInvariantProperties, PlayerService } from './playerService'
import { Game, GameObject, Player, PlayerAction } from './types'
import { Server } from 'socket.io'
import * as geometric from 'geometric'
import type { Line, Polygon, Point } from 'geometric'

const gameBoardSize = Number(process.env.GAME_BOARD_SIZE) || 500

const transformGameObjectToPolygon = (object: GameObject): Polygon => {
  const topLeft: Point = [object.top, object.left]
  const bottomLeft: Point = [object.top + object.height, object.left]
  const topRight: Point = [object.top, object.left + object.width]
  const bottomRight: Point = [object.top + object.height, object.left + object.width]
  const diagonalLine: Line = [topLeft, bottomRight]

  const coordinates: Polygon = [
    topLeft,
    bottomLeft,
    topRight,
    bottomRight
  ]

  const midpoint = geometric.lineMidpoint(diagonalLine)
  return geometric.polygonRotate(coordinates, object.rotation, midpoint)
}

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
        this.updatePlayerOnBoard({ updatedPlayer, gameId })
        const collisionExistAfterUpdate = this.checkIfObjectsCollide(gameId)
        // revert if collisions exists
        if (collisionExistAfterUpdate) this.updatePlayerOnBoard({ updatedPlayer: player, gameId })
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
            x: gameBoardSize,
            y: gameBoardSize
          },
          objects: [playerService.makePlayer({
            playerId: startingPlayerConnectionId,
            top: playerInvariantProperties.width / 2,
            left: playerInvariantProperties.height / 2,
            rotation: 180
          })]
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
            rotation: 0,
            top: game.board.dimensions.y - playerInvariantProperties.height - playerInvariantProperties.width / 2,
            left: game.board.dimensions.x - playerInvariantProperties.width - playerInvariantProperties.height / 2
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
    },
    checkIfObjectsCollide (gameId: number): boolean {
      const game = this.getGame(gameId)

      // lines are moved 1px to not provide intersections when object is on the edge of board
      const borderLeft: Line = [[-1, -1], [-1, gameBoardSize + 1]]
      const borderTop: Line = [[-1, -1], [gameBoardSize + 1, -1]]
      const borderRight: Line = [[gameBoardSize + 1, -1], [gameBoardSize + 1, gameBoardSize + 1]]
      const borderBottom: Line = [[-1, gameBoardSize + 1], [gameBoardSize + 1, gameBoardSize + 1]]

      const players = game.board.objects.filter((object) => object.type === 'player')
      const playersPolygons = players.map(transformGameObjectToPolygon)

      let isIntersecting = false

      for (let i = 0; i < players.length; i++) {
        // first intersection found do the trick
        if (isIntersecting) break

        const player = players[i]
        const otherPlayers = players.filter((otherPlayer) => otherPlayer.id !== player.id)
        const otherPlayersPolygons = otherPlayers.map(transformGameObjectToPolygon)
        const playerPolygon = playersPolygons[i]
        if (
          geometric.lineIntersectsPolygon(borderLeft, playerPolygon) ||
          geometric.lineIntersectsPolygon(borderTop, playerPolygon) ||
          geometric.lineIntersectsPolygon(borderRight, playerPolygon) ||
          geometric.lineIntersectsPolygon(borderBottom, playerPolygon)
        ) {
          isIntersecting = true
          break
        }

        otherPlayersPolygons.forEach((otherPlayerPolygon) => {
          if (geometric.polygonIntersectsPolygon(playerPolygon, otherPlayerPolygon)) {
            isIntersecting = true
          }
        })
      }

      return isIntersecting
    }
  }
}

export type GameService = ReturnType<typeof createGameService>
