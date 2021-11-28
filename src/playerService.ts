import { Player, PlayerAction } from './types'

export const playerInvariantProperties = {
  type: 'player' as const,
  width: 20,
  height: 40,
  rotation: 0,
  hp: 1
}

export const createPlayerService = () => {
  return {
    makePlayer ({ playerId, top, left }: {playerId: string, top: number, left: number }): Player {
      return {
        id: playerId,
        top: top,
        left: left,
        isFiring: false,
        ...playerInvariantProperties
      }
    },
    processPlayerAction ({ player, action }: { player: Player, action: PlayerAction }) {
      // keyup do not move player
      if (action.eventName !== 'keydown') return player

      const moceVelocity = Number(process.env.MOVE_VELOCITY_PER_TICK) || 10
      const rotationVelocity = Number(process.env.ROTATION_VELOCITY_PER_TICK) || 10

      switch (action.key) {
        case 'ArrowDown':
          return {
            ...player,
            isFiring: false,
            top: player.top + moceVelocity
          }
        case 'ArrowUp':
          return {
            ...player,
            isFiring: false,
            top: player.top - moceVelocity
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
            isFiring: true,
            rotation: player.rotation + rotationVelocity
          }
        default:
          return player
      }
    }
  }
}

export type PlayerService = ReturnType<typeof createPlayerService>
