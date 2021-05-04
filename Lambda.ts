export const getOpenOffers = async (storeId: string, conversationId: string) =>
  post("get-conversation-user", storeId, conversationId);

export const getChatMessages = async (
  storeId: string,
  conversationId: string
) => post("get-chat", storeId, conversationId);

export const getActiveUsers = async (storeId: string, conversationId: string) =>
  post("get-user", storeId, conversationId);

const post = async (
  endpoint: string,
  storeId: string,
  conversationId: string
) =>
  axios.post<{ Items: any }>(
    `https://ENDPOINT/websocket/${endpoint}`,
    JSON.stringify({
      storeId,
      conversationId,
    }),
    {
      headers: {
        "Content-Type": "application/json",
      },
    }
  );
