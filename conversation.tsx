export const NegotiateConversations: React.FC<{
  interaction: ConversationInterface;
}> = ({ interaction }) => {
  const [connections, setConnections] = useState<{
    [key: string]: ConnectionMeta;
  }>({});
  const [activeConnections, setActiveConnections] = useState<number>(0);
  const [offers, setOffers] = useState<string[]>([]);
  const [masterWebSocket, setMasterWebSocket] = useState<WebSocket>();

  const forceUpdate = useForceUpdate();
  const { currentUser } = useCurrentUserContext();
  const currentDeviceId = getDeviceId();
  const dispatch = useDispatch();
  const { callInProgress } = useSelector(videoSelector);

  useEffect(() => {
    if (!callInProgress) return;

    if (currentUser?.id) {
      // 1. Start websocket as master & 2. Register offer in DB
      onStart().then(() => {
        const websocket = startConnection(ConnectionType.MASTER);

        websocket.onopen = () => {
          getOpenOffers(store.id, interaction.id)
            .then(({ data }) => {
              const offers = data.Items;
              const result = offers.reduce((accumulator, currentValue) => {
                const found = accumulator.findIndex(
                  (a) => a.deviceId === currentValue.deviceId
                );
                if (found > -1) {
                  if (currentValue.createdAt > accumulator[found].createdAt)
                    accumulator[found].connectionId = currentValue.connectionId;
                } else {
                  accumulator.push(currentValue);
                }

                return accumulator;
              }, []);

              if (result.length) {
                const activeOffers = result
                  .filter((offer) => offer.deviceId !== currentDeviceId)
                  .map((i) => i.connectionId);
                setOffers(activeOffers);
              }
            })
            .catch((err) => console.error(err));
        };
      });
    }
  }, [interaction, currentUser, callInProgress]);

  useEffect(() => {
    if (!callInProgress) return;

    // 4. Connect as slave to every open offer
    offers &&
      offers.forEach((connectionId) =>
        startConnection(ConnectionType.SLAVE, connectionId)
      );
  }, [offers, callInProgress]);

  useEffect(() => {
    if (activeConnections === 0) {
      dispatch(stopCall());
      removeLocalVideo();
      masterWebSocket?.close();
      setMasterWebSocket(null);
    }
  }, [activeConnections]);

  const startConnection = (
    connectionType: ConnectionType,
    connectionId?: string
  ) => {
    const websocket = createWebSocket(
      interaction.id,
      currentUser.id,
      connectionType
    );

    if (connectionType === ConnectionType.SLAVE) {
      createConnectionMeta(websocket, connectionType, connectionId);
      websocket.onopen = () => {
        websocket.send(
          JSON.stringify({
            storeId: store.id,
            connectionId,
            action: "negotiate",
            type: MessageType.INITIATE,
          })
        );
      };
    } else {
      setMasterWebSocket(websocket);

      websocket.onmessage = ({ data }: MessageEvent) => {
        const { type, senderConnectionId } = JSON.parse(data);

        if (type === MessageType.INITIATE) {
          startConnection(ConnectionType.MASTER);
          createConnectionMeta(websocket, connectionType, senderConnectionId);
        }
      };
    }

    return websocket;
  };

  const createConnectionMeta = (
    websocket: WebSocket,
    connectionType: ConnectionType,
    senderConnectionId: string
  ) => {
    const connectionMeta = setupConnection(
      websocket,
      connectionType,
      senderConnectionId
    );
    setupVideoForNewConnection(connectionMeta, websocket);
    addConnection(connectionMeta);
    navigator.mediaDevices.getUserMedia({ audio: false, video: true });
  };

  const setupVideoForNewConnection = (
    connectionMeta: ConnectionMeta,
    websocket: WebSocket
  ) => {
    const timeout = setTimeout(() => {
      if (connectionMeta.connection.connectionState !== "connected") {
        console.log("not connected after 15 seconds");
        removeConnection(connectionMeta);
        connectionMeta.connection.close();
      }
    }, 15000);

    connectionMeta.connection.onconnectionstatechange = (e: Event) => {
      const state = (e.currentTarget as RTCPeerConnection).connectionState;
      switch (state) {
        case "connected":
          clearTimeout(timeout);
          addTracks(connectionMeta.connection);
          websocket.close();
          break;
        case "disconnected":
          break;
      }
      forceUpdate();
    };

    connectionMeta.channels.commandsChannel.onmessage = (
      message: MessageEvent
    ) => {
      switch (message.data) {
        case CommandType.VIDEO_ON:
          openLocalCamera();
          break;

        case CommandType.VIDEO_OFF:
          removeRemoteVideo(connectionMeta, false);
          removeConnection(connectionMeta);
          break;
      }
    };

    connectionMeta.connection.ontrack = ({ streams: [stream] }) => {
      const remoteVideo = getRemoteVideo(connectionMeta.connectionId);
      remoteVideo.srcObject = stream;
    };
  };

  const onStart = async () => {
    await openLocalCamera();

    Object.values(connections).forEach(({ channels }) => {
      channels.commandsChannel.readyState === "open" &&
        channels.commandsChannel.send(CommandType.VIDEO_ON);
    });
  };

  const openLocalCamera = async () => {
    const localMediaStream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: true,
    });
    const localVideo = getLocalVideo();
    localVideo.srcObject = localMediaStream;
    localVideo.muted = true;
  };

  const addTracks = (connection: RTCPeerConnection) => {
    const localVideo = getLocalVideo();
    const localMediaStream = localVideo.srcObject as MediaStream;

    localMediaStream.getTracks().forEach((track) => {
      if (connection.connectionState !== "closed") {
        try {
          connection.addTrack(track, localMediaStream);
        } catch (e) {
          // console.error(e);
        }
      }
    });
  };

  const onHangUp = () => {
    Object.values(connections).forEach((connectionMeta) => {
      removeRemoteVideo(connectionMeta, true);
      connectionMeta.channels.commandsChannel.readyState === "open" &&
        connectionMeta.channels.commandsChannel.send(CommandType.VIDEO_OFF);
      connectionMeta.connection.close();
    });
    resetConnections();
  };

  const removeLocalVideo = () => {
    const localVideo = getLocalVideo();
    const localMediaStream: MediaStream = localVideo.srcObject as MediaStream;

    localVideo.srcObject = null;
    localMediaStream?.getTracks().forEach((track) => {
      track.enabled = false;
      track.stop();
    });
  };

  const removeRemoteVideo = (
    connectionMeta: ConnectionMeta,
    shouldRemoveRemoteTracks: boolean
  ) => {
    const { connection } = connectionMeta;
    if (shouldRemoveRemoteTracks)
      connection
        .getSenders()
        .forEach((sender) => connection.removeTrack(sender));
    const remoteVideo = getRemoteVideo(connectionMeta.connectionId);
    remoteVideo.srcObject = null;
  };

  const getLocalVideo = (): HTMLVideoElement => {
    return document.getElementById("localVideo") as HTMLVideoElement;
  };

  const getRemoteVideo = (roomId: string): HTMLVideoElement => {
    return document.getElementById(`remoteVideo${roomId}`) as HTMLVideoElement;
  };

  const addConnection = (connectionMeta: ConnectionMeta) => {
    setConnections((prevConnections) => {
      const updatedConnections = {
        ...prevConnections,
        [connectionMeta.connectionId]: connectionMeta,
      };
      return updatedConnections;
    });
    setActiveConnections((activeConnections) => activeConnections + 1);
  };

  const removeConnection = (connectionMeta: ConnectionMeta) => {
    setConnections((prevConnections) => {
      delete prevConnections[connectionMeta.connectionId];
      return prevConnections;
    });
    setActiveConnections((activeConnections) =>
      activeConnections > 0 ? activeConnections - 1 : 0
    );
  };

  const resetConnections = () => {
    setConnections({});
    setActiveConnections(0);
  };

  return (
    <>
      <div
        style={{
          position: "fixed",
          right: 8,
          top: 90,
          zIndex: 9,
          display: "grid",
          pointerEvents: "none",
        }}
      >
        <VideoPopupStyled
          mobile={window.innerWidth < MOBILE_BREAKPOINT}
          id="localVideo"
          autoPlay
          playsInline
          visible={callInProgress}
        />
        <div style={{ height: 8 }} />
        {connections &&
          Object.values(connections).map(({ connectionId, connection }) => (
            <VideoContainerStyled
              key={connectionId}
              visible={connection.connectionState === "connected"}
            >
              <VideoPopupStyled
                id={`remoteVideo${connectionId}`}
                autoPlay
                playsInline
              ></VideoPopupStyled>
            </VideoContainerStyled>
          ))}
        {callInProgress && (
          <div style={{ pointerEvents: "all", display: "flex", zIndex: 10 }}>
            <SpanButtonIcon
              width={window.innerWidth < MOBILE_BREAKPOINT ? 85 : 125}
              store={store}
              icon={<RejectCallSVG style={{ marginRight: 8 }} />}
              action={onHangUp}
              content="End Call"
            />
          </div>
        )}
      </div>
    </>
  );
};
