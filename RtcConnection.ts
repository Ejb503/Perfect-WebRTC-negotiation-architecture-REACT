export const rtcConfig = {
  iceServers: [
    {
      username: "YOUR USERNAME",
      urls: ["xxx.xirsys.com", "xxx.xirsys.com"],
      credential: "",
    },
  ],
};

export const createRTCConnection = () => {
  let localConnection = new RTCPeerConnection(rtcConfig);

  const createDataChannel = (label: string, id: number) =>
    localConnection.createDataChannel(label, {
      negotiated: true,
      id,
    });

  const commandsChannel = createDataChannel("commandChannel", 0);
  const negotiationChannel = createDataChannel("negotiationChannel", 2);

  return {
    localConnection,
    channels: {
      commandsChannel,
      negotiationChannel,
    },
  };
};

export const setupConnection = (
  webSocket: WebSocket,
  connectionType: ConnectionType,
  peerConnectionId: string
): ConnectionMeta => {
  const connection = createLocalConnection(peerConnectionId, connectionType);
  const { connection: localConnection, channels } = connection;

  webSocket.onmessage = onMessageHandlerNegotiation(
    connection,
    peerConnectionId,
    webSocket
  );

  localConnection.onicecandidate = onIceCandidateHandler(
    peerConnectionId,
    webSocket,
    channels.negotiationChannel
  );
  localConnection.onnegotiationneeded = onNegotiationNeededHandler(
    connection,
    peerConnectionId,
    webSocket
  );

  channels.negotiationChannel.onmessage = onMessageHandlerNegotiation(
    connection,
    peerConnectionId,
    webSocket
  );

  return connection;
};

function createLocalConnection(
  connectionId: string,
  type: ConnectionType
): ConnectionMeta {
  const { localConnection, channels } = createRTCConnection();

  return {
    type,
    connectionId,
    channels,
    connection: localConnection,
    makingOffer: false,
    ignoreOffer: false,
    isSettingRemoteAnswerPending: false,
  };
}
