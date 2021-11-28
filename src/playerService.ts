import { Player, PlayerAction } from './types'
import { degToRad, round2Points } from './utils'

export const playerInvariantProperties = {
  type: 'player' as const,
  width: 20,
  height: 40,
  hp: 1
}

export const createPlayerService = () => {
  return {
    makePlayer ({ playerId, top, left, rotation }: {playerId: string, top: number, left: number, rotation: number }): Player {
      return {
        id: playerId,
        top: top,
        left: left,
        rotation: rotation,
        isFiring: false,
        ...playerInvariantProperties
      }
    },
    processPlayerAction ({ player, action }: { player: Player, action: PlayerAction }) {
      // keyup do not move player
      if (action.eventName !== 'keydown') return player

      const moveVelocity = Number(process.env.MOVE_VELOCITY_PER_TICK) || 10
      const rotationVelocity = Number(process.env.ROTATION_VELOCITY_PER_TICK) || 10
      const xMoveVelocity = round2Points(Math.sin(degToRad(player.rotation)) * moveVelocity)
      const yMoveVelocity = round2Points(Math.cos(degToRad(player.rotation)) * moveVelocity)

      switch (action && action.key) {
        case 'ArrowDown':
          return {
            ...player,
            top: player.top + yMoveVelocity,
            left: player.left - xMoveVelocity
          }
        case 'ArrowUp':
          return {
            ...player,
            top: player.top - yMoveVelocity,
            left: player.left + xMoveVelocity
          }
        case 'ArrowLeft':
          return {
            ...player,
            rotation: player.rotation - rotationVelocity
          }
        case 'ArrowRight':
          return {
            ...player,
            rotation: player.rotation + rotationVelocity
          }
        case 'Space':
          return {
            ...player,
            isFiring: true
          }
        default:
          return player
      }
    }
  }
}

export type PlayerService = ReturnType<typeof createPlayerService>
