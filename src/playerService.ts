import { Player } from './types'

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
        ...playerInvariantProperties
      }
    }
  }
}

export type PlayerService = ReturnType<typeof createPlayerService>
