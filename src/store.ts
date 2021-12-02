import { Store } from './types'

export const createStore = ():Store => ({
  nextGameId: 0,
  games: []
})
