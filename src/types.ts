export type Player = {
  type: 'player',
  id: string,
  top: number,
  left: number,
  width: number,
  height: number,
  rotation: number,
  hp: number,
}

export type GameObject = Player

export type Game = {
  id: number,
  players: string[]
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
