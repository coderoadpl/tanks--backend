import dotenv from 'dotenv'
import express from 'express'
import cors from 'cors'
import { createServer } from 'http'
import { Server } from 'socket.io'
import { createGameRepository } from './gameRepository'
import { createGameService } from './gameService'
import { createPlayerService } from './playerService'
import { createStore } from './store'

dotenv.config()

const PORT = Number(process.env.PORT) || 3000

const app = express()
app.use(cors())
app.use(express.json())

const httpServer = createServer(app)
const io = new Server(httpServer, { cors: { origin: '*' } })

const store = createStore()

const gameRepository = createGameRepository({ store })
const playerService = createPlayerService()
const gameService = createGameService({ io, gameRepository, playerService })

app.post('/new', (req, res) => {
  const connectionId = req.body.connectionId as string
  const game = gameService.createNewGame({ startingPlayerConnectionId: connectionId })
  gameService.emitBoardChangedEvent({ gameId: game.id })
  res.json({ gameId: game.id })
})

app.post('/join', (req, res) => {
  const gameId = Number(req.body.gameId)
  const connectionId = req.body.connectionId

  if (Number.isNaN(gameId)) {
    res.status(404).json({ error: 'This is not a valid game id!' })
    return
  }
  const game = gameRepository.getGame({ gameId })
  if (!game) {
    res.status(404).json({ error: 'This game do not exists!' })
    return
  }
  if (game.players.length === 2) {
    res.status(403).json({ error: 'This game is full, start a new one!' })
    return
  }
  gameService.addPlayerToTheGame({ gameId, playerId: connectionId })
  gameService.emitBoardChangedEvent({ gameId })

  res.json({ gameId })
})

io.on('connection', (socket) => {
  const connectionId = socket.id
  console.log(`New connection with id ${connectionId}`)
  socket.on('PLAYER_ACTION', ({ key, eventName }) => {
    gameService.handlePlayerAction({ playerId: connectionId, action: { key, eventName } })
  })
})

httpServer.listen(PORT, () => {
  console.log('listening on port ' + PORT)
})
