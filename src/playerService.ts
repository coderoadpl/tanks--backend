import { Player, PlayerAction } from './types'

export const playerInvariantProperties = {
  type: 'player' as const,
  width: 20,
  height: 40,
  hp: 1
}

const degToRad = (deg: number): number => deg * Math.PI / 180
const round2Points = (num: number) => Math.round(num * 100) / 100

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
            isFiring: false,
            top: player.top + yMoveVelocity,
            left: player.left - xMoveVelocity
          }
        case 'ArrowUp':
          return {
            ...player,
            isFiring: false,
            top: player.top - yMoveVelocity,
            left: player.left + xMoveVelocity
          }
        case 'ArrowLeft':
          return {
            ...player,
            isFiring: false,
            rotation: player.rotation - rotationVelocity
          }
        case 'ArrowRight':
          return {
            ...player,
            isFiring: false,
            rotation: player.rotation + rotationVelocity
          }
        case 'Space':
          return {
            ...player,
            isFiring: true
          }
        default:
          return {
            ...player,
            isFiring: false
          }
      }
    }
  }
}

export type PlayerService = ReturnType<typeof createPlayerService>
