import { Container, CosmosClient, Database } from "@azure/cosmos";

// Single shared CosmosClient per worker process (connection pooling).
// Lazy-initialised so importing this module never throws at load time.

let client: CosmosClient | undefined;
let database: Database | undefined;

function getClient(): CosmosClient {
  if (!client) {
    const conn = process.env.COSMOS_CONNECTION_STRING;
    if (!conn) {
      throw new Error("COSMOS_CONNECTION_STRING is not set");
    }
    client = new CosmosClient(conn);
  }
  return client;
}

function getDatabase(): Database {
  if (!database) {
    const dbName = process.env.COSMOS_DATABASE_NAME || "guildlive";
    database = getClient().database(dbName);
  }
  return database;
}

export const containers = {
  sessions: (): Container => getDatabase().container("sessions"),
  questions: (): Container => getDatabase().container("questions"),
  players: (): Container => getDatabase().container("players"),
  answers: (): Container => getDatabase().container("answers"),
};
