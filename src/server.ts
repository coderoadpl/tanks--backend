import dotenv from 'dotenv'
import express from 'express'
import cors from 'cors'
import { createServer } from 'http'
import { Server } from 'socket.io'
import { createGameRepository } from './gameRepository'
import { createGameService } from './gameService'
import { createPlayerService } from './playerService'

dotenv.config()

const PORT = process.env.PORT || 3000

const app = express()
app.use(cors())
app.use(express.json())

const httpServer = createServer(app)
const io = new Server(httpServer, { cors: { origin: '*' } })

const gameRepository = createGameRepository()
const playerService = createPlayerService()
const gameService = createGameService({ io, gameRepository, playerService })

app.post('/new', (req, res) => {
  const connectionId = req.body.connectionId as string
  const game = gameService.createNewGame({ startingPlayerConnectionId: connectionId })
  gameService.emitBoardChangedEvent(game.id)
  res.json({ gameId: game.id })
})

app.post('/join', (req, res) => {
  const gameId = Number(req.body.gameId)
  const connectionId = req.body.connectionId

  if (Number.isNaN(gameId)) {
    res.status(404).json({ error: 'This is not a valid game id!' })
    return
  }
  const game = gameRepository.getGame(gameId)
  if (!game) {
    res.status(404).json({ error: 'This game do not exists!' })
    return
  }
  if (game.players.length === 2) {
    res.status(403).json({ error: 'This game is full, start a new one!' })
    return
  }
  gameService.addPlayerToTheGame({ gameId, playerId: connectionId })
  gameService.emitBoardChangedEvent(gameId)

  res.json({ gameId })
})

io.on('connection', (socket) => {
  console.log('connection')
})

httpServer.listen(PORT, () => {
  console.log('listening on port ' + PORT)
})
