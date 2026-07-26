export const DEFAULT_SERVER_HOST = 'localhost'
export const DEFAULT_SERVER_PORT = 3000

export interface ServerEnvironment {
  [key: string]: string | undefined
  NODE_ZSB_HOST?: string
  NODE_ZSB_PORT?: string
}

export interface ServerInfo {
  hostname: string
  port: number
}

export function getServerInfo(
  environment: ServerEnvironment = process.env,
): ServerInfo {
  const hostname = environment.NODE_ZSB_HOST?.trim() || DEFAULT_SERVER_HOST
  const portValue = environment.NODE_ZSB_PORT?.trim()
  const port = portValue ? Number(portValue) : DEFAULT_SERVER_PORT

  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error('NODE_ZSB_PORT must be an integer between 1 and 65535')
  }

  return {
    hostname,
    port,
  }
}

export function formatServerOrigin({ hostname, port }: ServerInfo): string {
  const displayHostname = hostname.includes(':') ? `[${hostname}]` : hostname
  return `http://${displayHostname}:${port}`
}
