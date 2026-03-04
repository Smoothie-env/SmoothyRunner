export interface DockerPreset {
  id: string
  name: string
  image: string
  tag: string
  ports: { hostPort: number; containerPort: number }[]
  env: { key: string; value: string }[]
  volumes: { hostPath: string; containerPath: string }[]
  healthCheckEnabled: boolean
  healthTimeoutSeconds: number
}

export const DOCKER_PRESETS: DockerPreset[] = [
  {
    id: 'sqlserver-2022',
    name: 'SQL Server 2022',
    image: 'mcr.microsoft.com/mssql/server',
    tag: '2022-latest',
    ports: [{ hostPort: 1433, containerPort: 1433 }],
    env: [
      { key: 'ACCEPT_EULA', value: 'Y' },
      { key: 'SA_PASSWORD', value: 'YourStrong!Passw0rd' }
    ],
    volumes: [],
    healthCheckEnabled: true,
    healthTimeoutSeconds: 60
  },
  {
    id: 'redis',
    name: 'Redis',
    image: 'redis',
    tag: 'alpine',
    ports: [{ hostPort: 6379, containerPort: 6379 }],
    env: [],
    volumes: [],
    healthCheckEnabled: true,
    healthTimeoutSeconds: 30
  },
  {
    id: 'rabbitmq',
    name: 'RabbitMQ',
    image: 'rabbitmq',
    tag: '3-management',
    ports: [
      { hostPort: 5672, containerPort: 5672 },
      { hostPort: 15672, containerPort: 15672 }
    ],
    env: [
      { key: 'RABBITMQ_DEFAULT_USER', value: 'guest' },
      { key: 'RABBITMQ_DEFAULT_PASS', value: 'guest' }
    ],
    volumes: [],
    healthCheckEnabled: true,
    healthTimeoutSeconds: 60
  },
  {
    id: 'postgres-16',
    name: 'PostgreSQL 16',
    image: 'postgres',
    tag: '16-alpine',
    ports: [{ hostPort: 5432, containerPort: 5432 }],
    env: [
      { key: 'POSTGRES_USER', value: 'postgres' },
      { key: 'POSTGRES_PASSWORD', value: 'postgres' },
      { key: 'POSTGRES_DB', value: 'app' }
    ],
    volumes: [],
    healthCheckEnabled: true,
    healthTimeoutSeconds: 30
  },
  {
    id: 'seq',
    name: 'Seq',
    image: 'datalust/seq',
    tag: 'latest',
    ports: [
      { hostPort: 5341, containerPort: 5341 },
      { hostPort: 8081, containerPort: 80 }
    ],
    env: [
      { key: 'ACCEPT_EULA', value: 'Y' }
    ],
    volumes: [],
    healthCheckEnabled: true,
    healthTimeoutSeconds: 30
  }
]
