export const onIceCandidateHandler = (
  connectionId: string,
  socket: WebSocket,
  channel: RTCDataChannel
) => ({ candidate }: RTCPeerConnectionIceEvent) => {
  const message = {
    action: "negotiate",
    connectionId: connectionId,
    candidate,
  };
  sendMessage(socket, channel, message);
};

export const onNegotiationNeededHandler = (
  connectionMeta: ConnectionMeta,
  peerConnectionId: string,
  socket: WebSocket
) => async () => {
  try {
    if (connectionMeta.type === ConnectionType.MASTER) {
      connectionMeta.makingOffer = true;
      await connectionMeta.connection.setLocalDescription(
        await connectionMeta.connection.createOffer()
      );
      sendOffer(
        peerConnectionId,
        connectionMeta.connection.localDescription,
        socket,
        connectionMeta.channels.negotiationChannel
      );
    }
  } catch (err) {
    console.error(err);
  } finally {
    connectionMeta.makingOffer = false;
  }
};

export const onMessageHandlerNegotiation = (
  connectionMeta: ConnectionMeta,
  peerConnectionId: string,
  socket: WebSocket
) => {
  return async (e: MessageEvent) => {
    try {
      const { description, candidate } = JSON.parse(e.data) as Message;

      if (description) {
        if (description.type === "offer") {
          await connectionMeta.connection.setRemoteDescription(description);
          await connectionMeta.connection.setLocalDescription(
            await connectionMeta.connection.createAnswer()
          );
          sendOffer(
            peerConnectionId,
            connectionMeta.connection.localDescription,
            socket,
            connectionMeta.channels.negotiationChannel
          );
        } else {
          await connectionMeta.connection.setRemoteDescription(description);
        }
      } else if (candidate) {
        addIceCandidate(connectionMeta.connection, candidate);
      }
    } catch (err) {
      if (!connectionMeta.ignoreOffer) {
        console.error(err);
      }
    }
  };
};

const addIceCandidate = async (
  connection: RTCPeerConnection,
  candidate: RTCIceCandidateInit
) => {
  try {
    if (connection.remoteDescription) {
      await connection.addIceCandidate(candidate);
    } else {
      setTimeout(() => {
        addIceCandidate(connection, candidate);
      }, 1000);
    }
  } catch (e) {
    console.error(e, candidate);
  }
};

const sendMessage = (
  socket: WebSocket,
  channel: RTCDataChannel,
  message: Object
): void => {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(message));
  } else {
    channel.send(JSON.stringify(message));
  }
};

const sendOffer = (
  peerConnectionId: string,
  description: RTCSessionDescription,
  socket: WebSocket,
  channel: RTCDataChannel
) => {
  const message = {
    action: "negotiate",
    connectionId: peerConnectionId,
    description,
  };
  sendMessage(socket, channel, message);
};
