import { WebPubSubServiceClient } from "@azure/web-pubsub";

// One service client per hub per worker. Used both to mint group-scoped client
// access tokens (negotiate / join) and to PUBLISH ONCE to a session group.
//
// CRITICAL (architecture.md): we always publish to the group, never loop a send
// per connection. `sendToGroup` is a single call that Web PubSub fans out.

let serviceClient: WebPubSubServiceClient | undefined;

function getHubName(): string {
  return process.env.WEBPUBSUB_HUB_NAME || "guildlive";
}

export function getServiceClient(): WebPubSubServiceClient {
  if (!serviceClient) {
    const conn = process.env.WEBPUBSUB_CONNECTION_STRING;
    if (!conn) {
      throw new Error("WEBPUBSUB_CONNECTION_STRING is not set");
    }
    serviceClient = new WebPubSubServiceClient(conn, getHubName());
  }
  return serviceClient;
}

/** Group name for a session. One group == one live game. */
export function groupName(sessionCode: string): string {
  return `session-${sessionCode}`;
}

/**
 * Mint a client access token that lets a connection JOIN/SEND only within its
 * session group. The frontend opens a WebSocket to `url`.
 */
export async function getGroupAccessToken(
  sessionCode: string,
  userId: string,
): Promise<{ url: string }> {
  const group = groupName(sessionCode);
  const token = await getServiceClient().getClientAccessToken({
    userId,
    // Scope the token to this group only: join + send within the group.
    roles: [
      `webpubsub.joinLeaveGroup.${group}`,
      `webpubsub.sendToGroup.${group}`,
    ],
    groups: [group],
  });
  return { url: token.url };
}

/**
 * Publish ONE message to the whole session group. Single call -> fan-out to all
 * 200 members. This is the only broadcast primitive the app uses.
 */
export async function publishToSession(
  sessionCode: string,
  message: unknown,
): Promise<void> {
  // serviceClient.group(name).sendToAll == publish ONCE, service fans out to
  // every member of the group. No per-connection loop anywhere.
  // Passing a plain object uses the JSON overload (contentType is implicit).
  await getServiceClient()
    .group(groupName(sessionCode))
    .sendToAll(message as Record<string, unknown>);
}
