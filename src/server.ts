import dotenv from 'dotenv'
import express from 'express'
import cors from 'cors'
import { createServer } from 'http'
import { Server } from 'socket.io'
import { createGameRepository } from './gameRepository'

dotenv.config()

const PORT = process.env.PORT || 3000

const app = express()
app.use(cors())
app.use(express.json())

const gameRepository = createGameRepository()

app.post('/new', (req, res) => {
  const connectionId = req.body.connectionId
  const gameId = gameRepository.createNewGame({ players: [connectionId] })
  res.json({ gameId })
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
  gameRepository.updateGame(gameId, {
    players: game.players.concat(connectionId)
  })

  res.json({ gameId })
})

const httpServer = createServer(app)
const io = new Server(httpServer, { cors: { origin: '*' } })

io.on('connection', (socket) => {
  console.log('connection')
})

httpServer.listen(PORT, () => {
  console.log('listening on port ' + PORT)
})
