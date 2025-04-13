// ChatScreen.tsx
import React, { useEffect, useState, useRef, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  Image,
  StyleSheet,
  Platform,
  StatusBar,
  useColorScheme,
  Dimensions,
  Keyboard,
} from "react-native";
import Button from "@/components/ui/Button";
import { FontAwesome, MaterialIcons } from "@expo/vector-icons";
import { DarkTheme, DefaultTheme } from "@react-navigation/native";
import { router, useLocalSearchParams } from "expo-router";
import { connectSocket, getSocket } from "@/src/socket/socket";
import EmojiPicker, { EmojiClickData } from "emoji-picker-react";
import * as MediaLibrary from "expo-media-library";
import * as FileSystem from "expo-file-system";
import { format } from "date-fns";
import { Theme } from "emoji-picker-react";

interface Message {
  id: string;
  id_user1: string;
  id_user2: string;
  message: string;
  contentType: "text" | "image";
  fileName?: string;
  createdAt: string;
  category: "send" | "receive";
}

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const ChatScreen = () => {
  const [userID2] = useState("492ad52c-1041-707e-21cc-2e8d96752239");
  const [anotherUser] = useState<{ _id: string; name: string; image: string } | null>(null);
  const [conversation, setConversation] = useState<Message[]>([]);
  const [message, setMessage] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showImagePicker, setShowImagePicker] = useState(false);
  const [deviceImages, setDeviceImages] = useState<MediaLibrary.Asset[]>([]);
  const [permissionResponse, requestPermission] = MediaLibrary.usePermissions();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const colorScheme = useColorScheme();
  const theme = useMemo(() => (colorScheme === "dark" ? DarkTheme : DefaultTheme), [colorScheme]);
  const { userId } = useLocalSearchParams();

  useEffect(() => {
    connectSocket();
  }, []);

  const sendTextMessage = () => {
    if (!message.trim()) return;
    getSocket().emit("private-message", {
      receiverId: userID2,
      message,
      messageType: "private",
      contentType: "text",
    });
    setMessage("");
    setShowEmojiPicker(false);
  };

  const toggleEmojiPicker = () => {
    setShowEmojiPicker((prev) => !prev);
    if (showEmojiPicker) Keyboard.dismiss();
    setShowImagePicker(false);
  };

  const handleEmojiClick = (emojiData: EmojiClickData) => {
    setMessage((prev) => prev + emojiData.emoji);
  };

  // Mobile: load images
  const loadDeviceImages = async () => {
    if (permissionResponse?.status !== "granted") {
      await requestPermission();
    }
    const media = await MediaLibrary.getAssetsAsync({
      first: 100,
      mediaType: ["photo"],
      sortBy: ["creationTime"],
    });
    setDeviceImages(media.assets);
  };

  useEffect(() => {
    if (showImagePicker && Platform.OS !== "web") {
      loadDeviceImages();
    }
  }, [showImagePicker]);

  // Mobile image select
  const handleMobileImageSelect = async (asset: MediaLibrary.Asset) => {
    try {
      const base64 = await FileSystem.readAsStringAsync(asset.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      getSocket().emit("private-message", {
        receiverId: userID2,
        message: {
          data: base64,
          filename: asset.filename || `IMG_${asset.id}.jpg`,
        },
        messageType: "private",
        contentType: "file",
      });
      setShowImagePicker(false);
    } catch (error) {
      console.error("Error selecting mobile image:", error);
    }
  };

  // Web file change
  const onWebFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(",")[1];
      getSocket().emit("private-message", {
        receiverId: userID2,
        message: {
          data: base64,
          filename: file.name,
        },
        messageType: "private",
        contentType: "file",
      });
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const openImagePicker = () => {
    if (Platform.OS === "web") {
      fileInputRef.current?.click();
    } else {
      setShowImagePicker((prev) => !prev);
      setShowEmojiPicker(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Hidden web file input */}
      {Platform.OS === "web" && (
        <input
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          ref={fileInputRef}
          onChange={onWebFileChange}
        />
      )}

      {/* Header */}
      <View style={[styles.customHeader, { backgroundColor: theme.colors.background }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <FontAwesome name="arrow-left" size={24} color={theme.colors.primary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
          {anotherUser?.name || "Chat"}
        </Text>
      </View>

      {/* Messages */}
      <FlatList
        data={conversation}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          const isImage = item.contentType === "image";
          return (
            <View
              style={[
                styles.messageContainer,
                item.category === "send" ? styles.sentMessage : styles.receivedMessage,
              ]}
            >
              {item.category === "receive" && anotherUser && (
                <Image source={{ uri: anotherUser.image }} style={styles.avatar} />
              )}
              <View
                style={[
                  styles.messageBubble,
                  {
                    backgroundColor:
                      item.category === "send" ? theme.colors.primary : theme.colors.card,
                  },
                ]}
              >
                {isImage ? (
                  <Image
                    source={{ uri: `data:image/jpeg;base64,${item.message}` }}
                    style={styles.sentImage}
                    resizeMode="cover"
                  />
                ) : (
                  <Text style={[styles.messageText, { color: theme.colors.text }]}>
                    {item.message}
                  </Text>
                )}
                <Text style={[styles.messageTime, { color: theme.colors.text }]}>
                  {format(new Date(item.createdAt), "HH:mm")}
                </Text>
              </View>
            </View>
          );
        }}
        contentContainerStyle={{ padding: 10 }}
      />

      {/* Emoji Picker */}
      {showEmojiPicker && (
        <View
          style={[
            styles.emojiPickerContainer,
            {
              backgroundColor: theme.colors.card,
              borderTopWidth: 1,
              borderTopColor: theme.colors.border,
            },
          ]}
        >
          <EmojiPicker
            width={SCREEN_WIDTH}
            height={300}
            onEmojiClick={handleEmojiClick}
            skinTonesDisabled
            searchDisabled={false}
            previewConfig={{ showPreview: false }}
            theme={colorScheme === "dark" ? Theme.DARK : Theme.LIGHT}
          />
        </View>
      )}

      {/* Image Picker (Mobile) */}
      {showImagePicker && Platform.OS !== "web" && (
        <View
          style={[
            styles.imagePickerContainer,
            {
              backgroundColor: theme.colors.card,
              borderTopWidth: 1,
              borderTopColor: theme.colors.border,
            },
          ]}
        >
          <View style={styles.imagePickerHeader}>
            <Text style={[styles.imagePickerTitle, { color: theme.colors.text }]}>
              Chọn ảnh
            </Text>
            <TouchableOpacity onPress={() => setShowImagePicker(false)}>
              <MaterialIcons name="close" size={24} color={theme.colors.text} />
            </TouchableOpacity>
          </View>
          <FlatList
            data={deviceImages}
            numColumns={3}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => handleMobileImageSelect(item)}
                style={styles.imageItem}
              >
                <Image source={{ uri: item.uri }} style={styles.imageThumbnail} />
              </TouchableOpacity>
            )}
          />
        </View>
      )}

      {/* Input */}
      <View style={[styles.inputContainer, { backgroundColor: theme.colors.card }]}>
        <TouchableOpacity onPress={toggleEmojiPicker} style={styles.iconSpacing}>
          <FontAwesome
            name="smile-o"
            size={24}
            color={showEmojiPicker ? theme.colors.primary : theme.colors.text}
          />
        </TouchableOpacity>
        <TextInput
          style={[styles.input, { backgroundColor: theme.colors.background, color: theme.colors.text }]}
          value={message}
          onChangeText={setMessage}
          placeholder="Nhập tin nhắn..."
          placeholderTextColor={theme.colors.text}
        />
        {message.trim() === "" ? (
          <TouchableOpacity onPress={openImagePicker} style={styles.iconSpacing}>
            <FontAwesome
              name="file"
              size={24}
              color={showImagePicker ? theme.colors.primary : theme.colors.text}
            />
          </TouchableOpacity>
        ) : (
          <Button onPress={sendTextMessage}>Gửi</Button>
        )}
      </View>
    </View>
  );
};

export default ChatScreen;

const styles = StyleSheet.create({
  container: { flex: 1 },
  customHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 15,
    paddingTop: StatusBar.currentHeight ? StatusBar.currentHeight + 5 : 30,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  headerTitle: { fontSize: 18, fontWeight: "bold", flex: 1, textAlign: "center" },
  messageContainer: { flexDirection: "row", alignItems: "flex-end", marginVertical: 5 },
  sentMessage: { justifyContent: "flex-end", alignSelf: "flex-end" },
  receivedMessage: { justifyContent: "flex-start", alignSelf: "flex-start" },
  avatar: { width: 36, height: 36, borderRadius: 18, marginRight: 8 },
  messageBubble: { padding: 10, borderRadius: 12, maxWidth: "70%" },
  messageText: { fontSize: 16 },
  messageTime: { fontSize: 10, marginTop: 4, opacity: 0.7, alignSelf: "flex-end" },
  inputContainer: { flexDirection: "row", alignItems: "center", padding: 10, borderTopWidth: 1 },
  input: { flex: 1, height: 40, borderRadius: 20, paddingHorizontal: 12, marginHorizontal: 8 },
  iconSpacing: { marginHorizontal: 6 },
  emojiPickerContainer: { position: "absolute", bottom: 60, left: 0, right: 0, zIndex: 1000 },
  imagePickerContainer: { position: "absolute", bottom: 60, left: 0, right: 0, height: 300, zIndex: 1000 },
  imagePickerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 12,
    borderBottomWidth: 1,
  },
  imagePickerTitle: { fontSize: 16, fontWeight: "bold" },
  imageItem: { flex: 1, aspectRatio: 1, margin: 2 },
  imageThumbnail: { width: "100%", height: "100%", borderRadius: 6 },
  sentImage: { width: 200, height: 200, borderRadius: 10 },
});
