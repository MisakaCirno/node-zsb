import Elysia from 'elysia'
import openapi, { fromTypes } from '@elysiajs/openapi'
import { boardController } from './src/server/controllers/imageController.ts'
import { utilsController } from './src/server/controllers/utilsController.ts'
import { webController } from './src/server/controllers/webController.ts'

const serverInfo = {
  hostname: 'localhost',
  port: 3000,
}

interface StoppableServer {
  stop?: () => void | Promise<void>
}

const app = new Elysia()
  .use(
    openapi({
      references: fromTypes(),
    })
  )
  .use(boardController)
  .use(utilsController)
  .use(webController)

const server: unknown = app.listen(serverInfo)

console.log(
  `Server running at http://${serverInfo.hostname}:${serverInfo.port}`
)

async function shutdown() {
  try {
    await (server as StoppableServer | undefined)?.stop?.()
  } finally {
    process.exit(0)
  }
}

process.once('SIGINT', shutdown)
process.once('SIGTERM', shutdown)
