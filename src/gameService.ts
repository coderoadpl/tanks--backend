import { GameRepository } from './gameRepository'
import { playerInvariantProperties, PlayerService } from './playerService'
import { Game, GameObject, Player, PlayerAction } from './types'
import { Server } from 'socket.io'
import * as geometric from 'geometric'
import type { Line, Polygon, Point } from 'geometric'
import { degToRad, round2Points } from './utils'

const transformGameObjectToPolygon = (object: GameObject): Polygon => {
  const topLeft: Point = [object.left, object.top]
  const topRight: Point = [object.left + object.width, object.top]
  const bottomLeft: Point = [object.left, object.top + object.height]
  const bottomRight: Point = [object.left + object.width, object.top + object.height]
  const diagonalLine: Line = [topLeft, bottomRight]

  const coordinates: Polygon = [
    topLeft,
    topRight,
    bottomRight,
    bottomLeft
  ]

  const midpoint = geometric.lineMidpoint(diagonalLine)
  return geometric.polygonRotate(coordinates, object.rotation, midpoint)
}

export const createGameService = ({ io, gameRepository, playerService }:{ io: Server, gameRepository: GameRepository, playerService: PlayerService }) => {
  const gameBoardSize = Number(process.env.GAME_BOARD_SIZE) || 500
  const gameTime = 0
  const gameEndTime = Number(process.env.GAME_DURATION) || 30000
  const gameTickInterval = Number(process.env.GAME_TICK_INTERVAL) || 50

  return {
    startGameClock ({ gameId }: { gameId: number }) {
      const clockId = setInterval(() => this.processGameTick({ gameId }), gameTickInterval)
      return clockId
    },
    clearGameClock ({ gameId }: { gameId: number }) {
      const game = this.getGame(gameId)
      const clockId = game.clockId
      if (clockId) clearInterval(clockId)
    },
    processGameTick ({ gameId }: { gameId: number }) {
      this.clearFiringStates(gameId)
      this.processMovements(gameId)
      const { shouldEnd: shouldEndByDamages } = this.processDamages(gameId)
      const { shouldEnd: shouldEndByTime } = this.processGameTime({ gameId })
      this.emitBoardChangedEvent({ gameId })
      if (shouldEndByDamages || shouldEndByTime) {
        this.emitGameEndedEvent({ gameId })
        this.clearGameClock({ gameId })
      }
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
          time: gameTime,
          endTime: gameEndTime,
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
    increaseGameTime ({ gameId }: { gameId: number}) {
      const game = this.getGame(gameId)
      return gameRepository.updateGame(gameId, {
        board: {
          ...game.board,
          time: game.board.time + gameTickInterval
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
    emitBoardChangedEvent ({ gameId }: { gameId: number }) {
      const game = this.getGame(gameId)
      game.players.forEach((playerId) => {
        const playerSocket = io.sockets.sockets.get(playerId)
        if (playerSocket) playerSocket.emit('BOARD_CHANGED', game.board)
      })
    },
    emitGameEndedEvent ({ gameId }: { gameId: number }) {
      const game = this.getGame(gameId)
      game.players.forEach((playerId) => {
        const playerSocket = io.sockets.sockets.get(playerId)
        if (playerSocket) playerSocket.emit('GAME_ENDED')
      })
    },
    handlePlayerAction ({ playerId, action }: { playerId: string, action: PlayerAction }) {
      const game = gameRepository.getGameByPlayerId(playerId)
      if (!game) return
      if (action.eventName === 'keydown') {
        this.saveNextPlayerAction({ playerId, action })
      }
    },
    clearFiringStates (gameId: number) {
      const game = this.getGame(gameId)
      const players = game.board.objects.filter((object) => object.type === 'player')
      const firingPlayers = players.filter((player) => player.isFiring)
      firingPlayers.forEach((player) => this.updatePlayerOnBoard({
        updatedPlayer: { ...player, isFiring: false },
        gameId
      }))
    },
    processGameTime ({ gameId }: { gameId: number }) {
      this.increaseGameTime({ gameId })
      const game = this.getGame(gameId)
      if (game.board.time >= game.board.endTime) {
        return { shouldEnd: true }
      }
      return { shouldEnd: false }
    },
    processMovements (gameId: number) {
      const game = this.getGame(gameId)
      game.players.forEach((playerId) => {
        const nextAction = game.nextPlayersAction[playerId]
        const player = game.board.objects.find((object) => object.id === playerId)
        if (!nextAction || !player) return
        const updatedPlayer = playerService.processPlayerAction({ player, action: nextAction })
        this.updatePlayerOnBoard({ updatedPlayer, gameId })
        const collisionExistAfterUpdate = this.checkIfObjectsCollisions(gameId)
        // revert if collisions exists
        if (collisionExistAfterUpdate) this.updatePlayerOnBoard({ updatedPlayer: player, gameId })
        this.removeNextPlayerAction({ playerId })
      })
    },
    processDamages (gameId: number) {
      const game = this.getGame(gameId)
      const players = game.board.objects.filter((object) => object.type === 'player')
      const firingPlayers = players.filter((player) => player.isFiring)

      const shootTrajectories = firingPlayers.map((firingPlayer): Line => {
        // longer than every dimension the board
        const shootDistance = 2 * gameBoardSize
        const firingPlayerPolygon = transformGameObjectToPolygon(firingPlayer)
        const frontLine: Line = [firingPlayerPolygon[0], firingPlayerPolygon[1]]
        const barrelPoint = geometric.lineMidpoint(frontLine)
        // we cant start at barrel as the shoot there would damage firing player itself
        const shootStartPoint: Point = [
          barrelPoint[0] + round2Points(Math.sin(degToRad(firingPlayer.rotation)) * 1),
          barrelPoint[1] - round2Points(Math.cos(degToRad(firingPlayer.rotation)) * 1)
        ]
        const shootTargetPoint: Point = [
          barrelPoint[0] + round2Points(Math.sin(degToRad(firingPlayer.rotation)) * shootDistance),
          barrelPoint[1] - round2Points(Math.cos(degToRad(firingPlayer.rotation)) * shootDistance)
        ]
        return [shootStartPoint, shootTargetPoint]
      })

      if (shootTrajectories.length === 0) return { shouldEnd: false }

      const damagedPlayers = players.reduce((r, player) => {
        const playerPolygon = transformGameObjectToPolygon(player)
        const matchedShootTrajectories = shootTrajectories.filter((shootTrajectory) => geometric.lineIntersectsPolygon(shootTrajectory, playerPolygon))
        if (matchedShootTrajectories.length === 0) return r
        return r.concat({
          ...player,
          hp: player.hp - matchedShootTrajectories.length
        })
      }, [] as Player[])

      damagedPlayers.forEach((playerAfterShoot) => this.updatePlayerOnBoard({ updatedPlayer: playerAfterShoot, gameId }))

      const deadPlayers = damagedPlayers.filter((damagedPlayer) => damagedPlayer.hp <= 0)
      const alivePlayersNumber = players.length - deadPlayers.length
      const isOnePlayerLeft = alivePlayersNumber === 1

      return { shouldEnd: isOnePlayerLeft }
    },
    checkIfObjectsCollisions (gameId: number): boolean {
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
