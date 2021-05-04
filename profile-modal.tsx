export const ProfileModal: React.FC<{
  setInteraction: () => void;
  interaction: ConversationInterface;
}> = ({ interaction }) => {
  const [editing, setEditing] = useState<boolean>(false);
  const dispatch = useDispatch();
  const {
    websocket,
    currentConnectionId,
    connectedUsers,
    inviteAssistant,
  } = useWebsocketContext();
  const {
    setCurrentUser,
    currentUser,
    availableUsers,
  } = useCurrentUserContext();
  const { hideModal } = useModalContext();
  const [customerName, setCustomerName] = useState("");
  const [errors, setErrors] = useState<{ customerName: string; email: string }>(
    { customerName: "", email: "" }
  );
  const merchantInvited = useSelector(inviteAssistantSelector);

  useEffect(() => {
    if (customerName && !customerName) {
      setErrors({ ...errors, customerName: "Must enter a name" });
      return;
    }
    setErrors({ customerName: "", email: "" });
  }, [customerName]);

  const setCustomerNameHandler = (
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setCustomerName(event.target.value);
  };

  const createProfileHandler = async () => {
    const newUser = await createProfile(
      `https://i.pravatar.cc/150?u=${interaction.id}`,
      customerName,
      interaction.id,
      store.user_id || ""
    );
    setCurrentUser(newUser);

    // We need to connect to the websocket, and tell peers to update the conversation. There will be better ways to do this...
    setTimeout(() => {
      websocket.send(
        JSON.stringify({
          storeId: store.id,
          connectionId: undefined,
          senderConnectionId: currentConnectionId,
          action: "sendmessage",
          type: MessageType.UPDATE,
          userId: newUser.id,
          conversationId: interaction.id,
        } as Message)
      );
    }, 3000);
  };

  const selectProfile = async (profileId: string) => {
    setCurrentUser(
      interaction.profiles.find((profile) => profile.id === profileId)
    );
    hideModal();
  };

  return (
    <>
      {currentUser?.id && (
        <>
          <h3 style={{ marginBottom: 16 }}>
            There are {connectedUsers.length + 1} users online.
          </h3>
          <div style={{ width: "100%", overflow: "auto" }}>
            <div
              style={{
                display: "flex",
                marginBottom: 32,
                width: (availableUsers.length + 2) * 110,
                padding: "10px 0",
              }}
            >
              <UserStyled>
                <div
                  style={{
                    background: "green",
                    width: 16,
                    height: 16,
                    borderRadius: "50%",
                    position: "absolute",
                    top: -8,
                    right: -8,
                    border: `solid 2px ${store.textColor}`,
                  }}
                />

                <UserSVG style={{ marginBottom: 8 }} />
                <h2 style={{ height: 60 }}>{currentUser?.name.slice(0, 8)}</h2>
                <p>YOU</p>
              </UserStyled>
              <UserStyledSmall
                selected={merchantInvited}
                onClick={() => {
                  if (merchantInvited) return;
                  inviteAssistant();
                  dispatch(
                    createToast({
                      type: "success",
                      message: `You have invited ${assistant.name} to the conversation`,
                      action: () => {},
                      icon: <></>,
                    })
                  );
                }}
                key={assistant?.id}
              >
                <div
                  style={{
                    background: "grey",
                    width: 16,
                    height: 16,
                    borderRadius: "50%",
                    position: "absolute",
                    top: -8,
                    right: -8,
                    border: `solid 2px ${store.textColor}`,
                  }}
                />
                {
                  <img
                    src={assistant.profilePic}
                    style={{ width: 50, height: 50, borderRadius: "50%" }}
                  />
                }
                <h2 style={{ height: 60 }}>{assistant?.name}</h2>
                <p>Merchant</p>
                <span>{!merchantInvited ? "(invite)" : "(invited)"}</span>
              </UserStyledSmall>

              {connectedUsers.map((profile: UserProfile) => (
                <UserStyled
                  selected={profile.id === currentUser?.id}
                  key={profile.id}
                >
                  <div
                    style={{
                      background: "green",
                      width: 16,
                      height: 16,
                      borderRadius: "50%",
                      position: "absolute",
                      top: -8,
                      right: -8,
                      border: `solid 2px ${store.textColor}`,
                    }}
                  />

                  <UserSVG style={{ marginBottom: 8 }} />
                  <h2 style={{ height: 60 }}>{profile.name.slice(0, 8)}</h2>
                  <p>FRIEND</p>
                </UserStyled>
              ))}
            </div>
          </div>
        </>
      )}
      <>
        <h3 style={{ marginBottom: 8 }}>
          Please select your profile or create a new one.
        </h3>
        <div style={{ width: "100%", overflow: "auto" }}>
          <div
            style={{
              display: "flex",
              marginBottom: 32,
              width: availableUsers.length * 110,
              padding: "10px 0",
            }}
          >
            {availableUsers
              .filter(
                (user) => !connectedUsers.map((a) => a.id).includes(user.id)
              )
              .filter((user) => user.id !== currentUser?.id)
              .slice(0, 5)
              .map((profile: UserProfile) => (
                <UserStyled
                  onClick={() => selectProfile(profile.id)}
                  selected={profile.id === currentUser?.id}
                  key={profile.id}
                >
                  <div
                    style={{
                      background: "grey",
                      width: 16,
                      height: 16,
                      borderRadius: "50%",
                      position: "absolute",
                      top: -8,
                      right: -8,
                      border: `solid 2px ${store.textColor}`,
                    }}
                  />

                  <UserSVG style={{ marginBottom: 8 }} />
                  <h2 style={{ height: 60 }}>{profile.name.slice(0, 8)}</h2>
                  {profile.id !== currentUser?.id && <p>SELECT</p>}
                  {profile.id == currentUser?.id && <p>YOU</p>}
                </UserStyled>
              ))}
          </div>
        </div>
        {!editing && (
          <ClientButton
            store={store}
            large
            content={"Create profile"}
            icon={<PlusSVG style={{ marginRight: 16 }} />}
            action={() => setEditing(true)}
          />
        )}
        {editing && (
          <div style={{ maxWidth: 360 }}>
            <TextInput
              store={store}
              id="Name"
              label="Name"
              placeholder="Name"
              onChangeHandler={setCustomerNameHandler}
              onBlurHandler={() => {}}
              value={customerName}
              type="text"
              success={Boolean(customerName)}
              error={errors.customerName}
            />
            <div style={{ height: 16 }} />
            <ClientButton
              store={store}
              large
              content={"Create profile"}
              icon={<PlusSVG style={{ marginRight: 16 }} />}
              action={createProfileHandler}
              disabled={!customerName}
            />
          </div>
        )}
      </>
      <div style={{ height: 16 }} />

      <InviteFriends interaction={interaction} />
    </>
  );
};
