export type PlayerActionEventName = 'keyup' | 'keydown'
export type PlayerActionEventKey = 'ArrowDown' | 'ArrowUp' | 'ArrowLeft' | 'ArrowRight' | 'Space'
export type PlayerAction = { key: PlayerActionEventKey, eventName: PlayerActionEventName }

type GameObjectBase = {
  id: string,
  top: number,
  left: number,
  width: number,
  height: number,
  rotation: number,
}

export type Player = GameObjectBase & {
  type: 'player',
  hp: number,
  isFiring: boolean
}

export type GameObject = Player

export type Game = {
  id: number,
  clockId?: NodeJS.Timer,
  players: string[],
  nextPlayersAction: Record<string, PlayerAction | null>,
  board: {
    dimensions: {
      x: number,
      y: number
    }
    objects: GameObject[]
  },
}

export type Store = {
  nextGameId: number,
  games: Game[]
}
