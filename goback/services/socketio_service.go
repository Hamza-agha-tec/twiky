package services

import (
	"database/sql"
	"fmt"
	"log"
	"net/http"
	"os"
	"sync"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/labstack/echo/v4"
	socketio "github.com/zishang520/socket.io/v2/socket"
)

// SocketIOService handles all real-time events.
type SocketIOService struct {
	server *socketio.Server
	db     *sql.DB

	// Presence tracking
	presenceMu  sync.RWMutex
	userSockets map[string]string // userID  → socketID
	socketUsers map[string]string // socketID → userID

	// Voice room tracking
	voiceMu      sync.RWMutex
	voiceRooms   map[string]map[string]interface{} // roomID → userID → user payload
	socketVoice  map[string]string                 // socketID → roomID (for disconnect cleanup)

	// Watch room tracking
	watchMu          sync.RWMutex
	watchRooms       map[string]map[string]*watchParticipant // roomID → userID → participant
	watchSocketIndex map[string][2]string                    // socketID → [roomID, userID]
	watchRoomMeta    map[string]*watchRoomMeta               // roomID → meta
}

type watchParticipant struct {
	SocketID   string
	UserID     string
	Username   string
	Fullname   *string
	AvatarURL  *string
	BannerURL  *string
	SubPlan    *string
	IsVerified *bool
	IsHost     bool
	JoinedAt   int64
}

type watchRoomMeta struct {
	SessionStartedAt int64 // 0 means not started
}

type ChatMessage struct {
	ChannelID string `json:"channel_id"`
	UserID    string `json:"user_id"`
	Message   string `json:"message"`
	Timestamp string `json:"timestamp"`
}

type VoiceEvent struct {
	RoomID    string      `json:"room_id"`
	UserID    string      `json:"user_id"`
	Event     string      `json:"event"`
	Data      interface{} `json:"data,omitempty"`
	Timestamp string      `json:"timestamp"`
}

func NewSocketIOService(db *sql.DB) *SocketIOService {
	svc := &SocketIOService{
		server:      socketio.NewServer(nil, nil),
		db:          db,
		userSockets: make(map[string]string),
		socketUsers: make(map[string]string),
		voiceRooms:  make(map[string]map[string]interface{}),
		socketVoice: make(map[string]string),
		watchRooms:       make(map[string]map[string]*watchParticipant),
		watchSocketIndex: make(map[string][2]string),
		watchRoomMeta:    make(map[string]*watchRoomMeta),
	}
	svc.setupHandlers()
	return svc
}

// ── helpers ──────────────────────────────────────────────────────────────────

func asMap(v interface{}) map[string]interface{} {
	if m, ok := v.(map[string]interface{}); ok {
		return m
	}
	return nil
}

func mapStr(m map[string]interface{}, key string) string {
	if m == nil {
		return ""
	}
	if v, ok := m[key]; ok {
		if s, ok := v.(string); ok {
			return s
		}
	}
	return ""
}

func parseUserIDFromSocket(client *socketio.Socket) (string, error) {
	auth := client.Handshake().Auth
	if auth == nil {
		return "", fmt.Errorf("no auth data")
	}
	authMap, ok := auth.(map[string]interface{})
	if !ok {
		return "", fmt.Errorf("invalid auth format")
	}
	tokenVal, ok := authMap["token"]
	if !ok {
		return "", fmt.Errorf("no token in auth")
	}
	tokenStr, ok := tokenVal.(string)
	if !ok || tokenStr == "" {
		return "", fmt.Errorf("invalid token value")
	}

	// Try HMAC first (Supabase HS256)
	jwtSecret := os.Getenv("SUPABASE_JWT_SECRET")
	token, err := jwt.Parse(tokenStr, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); ok {
			return []byte(jwtSecret), nil
		}
		return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
	})
	if err == nil && token.Valid {
		if claims, ok := token.Claims.(jwt.MapClaims); ok {
			if sub, ok := claims["sub"].(string); ok && sub != "" {
				return sub, nil
			}
		}
	}

	// Fallback: parse without verification for Supabase ES256 tokens
	unverified, _, _ := jwt.NewParser().ParseUnverified(tokenStr, jwt.MapClaims{})
	if unverified != nil {
		if claims, ok := unverified.Claims.(jwt.MapClaims); ok {
			if sub, ok := claims["sub"].(string); ok && sub != "" {
				return sub, nil
			}
		}
	}

	return "", fmt.Errorf("could not extract user ID from token")
}

// ── presence helpers ──────────────────────────────────────────────────────────

func (s *SocketIOService) trackOnline(socketID, userID string) {
	s.presenceMu.Lock()
	s.userSockets[userID] = socketID
	s.socketUsers[socketID] = userID
	s.presenceMu.Unlock()

	if s.db != nil {
		if _, err := s.db.Exec(`UPDATE users SET is_online = true WHERE id = $1`, userID); err != nil {
			log.Printf("set online failed (userID=%s): %v", userID, err)
		}
	}

	s.server.Emit("userStatusChange", map[string]interface{}{
		"userId": userID,
		"status": "online",
	})
}

func (s *SocketIOService) trackOffline(socketID string) {
	s.presenceMu.Lock()
	userID, ok := s.socketUsers[socketID]
	if ok {
		delete(s.socketUsers, socketID)
		delete(s.userSockets, userID)
	}
	s.presenceMu.Unlock()

	if !ok {
		return
	}

	now := time.Now().UTC().Format(time.RFC3339)
	if s.db != nil {
		if _, err := s.db.Exec(
			`UPDATE users SET is_online = false, last_seen_at = $1 WHERE id = $2`,
			now, userID,
		); err != nil {
			log.Printf("set offline failed (userID=%s): %v", userID, err)
		}
	}

	s.server.Emit("userStatusChange", map[string]interface{}{
		"userId":     userID,
		"status":     "offline",
		"lastSeenAt": now,
	})
}

func (s *SocketIOService) onlineUserIDs() []string {
	s.presenceMu.RLock()
	defer s.presenceMu.RUnlock()
	ids := make([]string, 0, len(s.userSockets))
	for uid := range s.userSockets {
		ids = append(ids, uid)
	}
	return ids
}

func (s *SocketIOService) socketIDForUser(userID string) string {
	s.presenceMu.RLock()
	defer s.presenceMu.RUnlock()
	return s.userSockets[userID]
}

// ── voice room helpers ────────────────────────────────────────────────────────

// joinVoiceRoom adds userID with payload to roomID, returns old roomID if user was elsewhere.
func (s *SocketIOService) joinVoiceRoom(socketID, roomID string, userPayload interface{}) (oldRoomID string) {
	s.voiceMu.Lock()
	defer s.voiceMu.Unlock()

	oldRoomID = s.socketVoice[socketID]
	if oldRoomID != "" && oldRoomID != roomID {
		// remove from old room
		if room, ok := s.voiceRooms[oldRoomID]; ok {
			userID := mapStr(asMap(userPayload), "id")
			delete(room, userID)
		}
	}

	s.socketVoice[socketID] = roomID
	if s.voiceRooms[roomID] == nil {
		s.voiceRooms[roomID] = make(map[string]interface{})
	}
	userID := mapStr(asMap(userPayload), "id")
	if userID != "" {
		s.voiceRooms[roomID][userID] = userPayload
	}
	return oldRoomID
}

func (s *SocketIOService) leaveVoiceRoom(socketID, roomID string) (userID string) {
	s.voiceMu.Lock()
	defer s.voiceMu.Unlock()

	s.presenceMu.RLock()
	userID = s.socketUsers[socketID]
	s.presenceMu.RUnlock()

	if room, ok := s.voiceRooms[roomID]; ok {
		delete(room, userID)
	}
	if s.socketVoice[socketID] == roomID {
		delete(s.socketVoice, socketID)
	}
	return userID
}

func (s *SocketIOService) getVoiceParticipants(roomID string) []interface{} {
	s.voiceMu.RLock()
	defer s.voiceMu.RUnlock()
	room := s.voiceRooms[roomID]
	list := make([]interface{}, 0, len(room))
	for _, u := range room {
		list = append(list, u)
	}
	return list
}

func (s *SocketIOService) removeFromAllVoiceRooms(socketID string) (roomID, userID string) {
	s.voiceMu.Lock()
	defer s.voiceMu.Unlock()

	s.presenceMu.RLock()
	userID = s.socketUsers[socketID]
	s.presenceMu.RUnlock()

	roomID = s.socketVoice[socketID]
	if roomID != "" {
		if room, ok := s.voiceRooms[roomID]; ok {
			delete(room, userID)
		}
		delete(s.socketVoice, socketID)
	}
	return roomID, userID
}

// ── watch room helpers ────────────────────────────────────────────────────────

func (s *SocketIOService) watchParticipantsList(roomID string) ([]map[string]interface{}, int64) {
	s.watchMu.RLock()
	defer s.watchMu.RUnlock()
	room := s.watchRooms[roomID]
	list := make([]map[string]interface{}, 0, len(room))
	for _, p := range room {
		var avatar interface{} = nil
		if p.AvatarURL != nil {
			avatar = *p.AvatarURL
		}
		var banner interface{} = nil
		if p.BannerURL != nil {
			banner = *p.BannerURL
		}
		var sub interface{} = nil
		if p.SubPlan != nil {
			sub = *p.SubPlan
		}
		var full interface{} = nil
		if p.Fullname != nil {
			full = *p.Fullname
		}
		var ver interface{} = nil
		if p.IsVerified != nil {
			ver = *p.IsVerified
		}
		list = append(list, map[string]interface{}{
			"userId":     p.UserID,
			"username":   p.Username,
			"fullname":   full,
			"avatarUrl":  avatar,
			"bannerUrl":  banner,
			"subPlan":    sub,
			"isVerified": ver,
			"isHost":     p.IsHost,
			"joinedAt":   p.JoinedAt,
		})
	}
	var started int64
	if meta := s.watchRoomMeta[roomID]; meta != nil {
		started = meta.SessionStartedAt
	}
	return list, started
}

func (s *SocketIOService) emitWatchParticipants(roomID string) {
	list, started := s.watchParticipantsList(roomID)
	payload := map[string]interface{}{
		"roomId":       roomID,
		"participants": list,
	}
	if started > 0 {
		payload["sessionStartedAt"] = started
	} else {
		payload["sessionStartedAt"] = nil
	}
	// broadcast globally so sidebar of users not inside the room still updates
	s.server.Emit("watch:participants", payload)
}

// removeFromWatchRoom returns roomID it was removed from, or "" if not in any.
func (s *SocketIOService) removeFromWatchRoom(socketID string) string {
	s.watchMu.Lock()
	entry, ok := s.watchSocketIndex[socketID]
	if !ok {
		s.watchMu.Unlock()
		return ""
	}
	delete(s.watchSocketIndex, socketID)
	roomID, userID := entry[0], entry[1]
	if room, ok := s.watchRooms[roomID]; ok {
		delete(room, userID)
		if len(room) == 0 {
			delete(s.watchRooms, roomID)
			delete(s.watchRoomMeta, roomID)
		}
	}
	s.watchMu.Unlock()
	return roomID
}

// ── socket event setup ────────────────────────────────────────────────────────

func (s *SocketIOService) setupHandlers() {
	server := s.server

	server.On("connection", func(clients ...any) {
		client := clients[0].(*socketio.Socket)
		socketID := string(client.Id())
		log.Printf("Socket.IO connected: %s", socketID)

		// Identify user from JWT
		if userID, err := parseUserIDFromSocket(client); err == nil {
			s.trackOnline(socketID, userID)
			client.Join(socketio.Room("user_" + userID))
		} else {
			log.Printf("Socket auth failed %s: %v", socketID, err)
		}

		// ── Presence ────────────────────────────────────────────────────────

		client.On("getOnlineUsers", func(_ ...any) {
			client.Emit("onlineUsersList", s.onlineUserIDs())
		})

		client.On("getLastSeen", func(datas ...any) {
			if len(datas) == 0 || s.db == nil {
				return
			}
			rawIDs, ok := datas[0].([]interface{})
			if !ok {
				return
			}
			result := make(map[string]string)
			for _, raw := range rawIDs {
				uid, ok := raw.(string)
				if !ok || uid == "" {
					continue
				}
				var lastSeenAt sql.NullString
				if err := s.db.QueryRow(`SELECT last_seen_at FROM users WHERE id = $1`, uid).Scan(&lastSeenAt); err == nil && lastSeenAt.Valid {
					result[uid] = lastSeenAt.String
				}
			}
			client.Emit("lastSeenMap", result)
		})

		// ── Voice presence ───────────────────────────────────────────────────

		client.On("join-voice-room", func(datas ...any) {
			if len(datas) == 0 {
				return
			}
			payload := asMap(datas[0])
			if payload == nil {
				return
			}
			roomID := mapStr(payload, "roomId")
			if roomID == "" {
				return
			}
			userPayload, _ := payload["user"]

			oldRoomID := s.joinVoiceRoom(socketID, roomID, userPayload)

			// Leave old socket.io room and notify its participants
			if oldRoomID != "" && oldRoomID != roomID {
				client.Leave(socketio.Room("voice_" + oldRoomID))
				s.presenceMu.RLock()
				userID := s.socketUsers[socketID]
				s.presenceMu.RUnlock()
				leftPayload := map[string]interface{}{"roomId": oldRoomID, "userId": userID}
				server.To(socketio.Room("voice_" + oldRoomID)).Emit("user-left-voice", leftPayload)
				server.To(socketio.Room("sub_voice_" + oldRoomID)).Emit("user-left-voice", leftPayload)
			}

			// Join socket.io room for broadcast
			client.Join(socketio.Room("voice_" + roomID))

			// Send current participants to the joining user
			client.Emit("voice-room-users", map[string]interface{}{
				"roomId":       roomID,
				"participants": s.getVoiceParticipants(roomID),
			})

			// Broadcast join to everyone in the room and sidebar subscribers
			joinPayload := map[string]interface{}{"roomId": roomID, "user": userPayload}
			server.To(socketio.Room("voice_" + roomID)).Emit("user-joined-voice", joinPayload)
			server.To(socketio.Room("sub_voice_" + roomID)).Emit("user-joined-voice", joinPayload)
		})

		client.On("leave-voice-room", func(datas ...any) {
			if len(datas) == 0 {
				return
			}
			payload := asMap(datas[0])
			roomID := mapStr(payload, "roomId")
			if roomID == "" {
				return
			}

			userID := s.leaveVoiceRoom(socketID, roomID)
			client.Leave(socketio.Room("voice_" + roomID))

			leftPayload := map[string]interface{}{"roomId": roomID, "userId": userID}
			server.To(socketio.Room("voice_" + roomID)).Emit("user-left-voice", leftPayload)
			server.To(socketio.Room("sub_voice_" + roomID)).Emit("user-left-voice", leftPayload)
		})

		client.On("subscribe-voice-rooms", func(datas ...any) {
			if len(datas) == 0 {
				return
			}
			payload := asMap(datas[0])
			rawIDs, _ := payload["roomIds"].([]interface{})
			for _, raw := range rawIDs {
				roomID, ok := raw.(string)
				if !ok || roomID == "" {
					continue
				}
				client.Join(socketio.Room("sub_voice_" + roomID))
				// Send current participants for sidebar
				client.Emit("voice-room-participants", map[string]interface{}{
					"roomId": roomID,
					"users":  s.getVoiceParticipants(roomID),
				})
			}
		})

		client.On("unsubscribe-voice-rooms", func(datas ...any) {
			if len(datas) == 0 {
				return
			}
			payload := asMap(datas[0])
			rawIDs, _ := payload["roomIds"].([]interface{})
			for _, raw := range rawIDs {
				roomID, ok := raw.(string)
				if !ok || roomID == "" {
					continue
				}
				client.Leave(socketio.Room("sub_voice_" + roomID))
			}
		})

		client.On("voice-room-audio-toggle", func(datas ...any) {
			if len(datas) == 0 {
				return
			}
			payload := asMap(datas[0])
			roomID := mapStr(payload, "roomId")
			if roomID == "" {
				return
			}
			s.presenceMu.RLock()
			userID := s.socketUsers[socketID]
			s.presenceMu.RUnlock()

			// Update mute state in our participant map
			s.voiceMu.Lock()
			if room := s.voiceRooms[roomID]; room != nil {
				if u := asMap(room[userID]); u != nil {
					u["isMuted"] = payload["muted"]
					room[userID] = u
				}
			}
			s.voiceMu.Unlock()

			out := map[string]interface{}{"roomId": roomID, "userId": userID, "muted": payload["muted"]}
			server.To(socketio.Room("voice_" + roomID)).Emit("user-audio-toggled", out)
			server.To(socketio.Room("sub_voice_" + roomID)).Emit("user-audio-toggled", out)
		})

		client.On("voice-speaking", func(datas ...any) {
			if len(datas) == 0 {
				return
			}
			payload := asMap(datas[0])
			roomID := mapStr(payload, "roomId")
			if roomID == "" {
				return
			}
			s.presenceMu.RLock()
			userID := s.socketUsers[socketID]
			s.presenceMu.RUnlock()

			s.voiceMu.Lock()
			if room := s.voiceRooms[roomID]; room != nil {
				if u := asMap(room[userID]); u != nil {
					u["isSpeaking"] = payload["speaking"]
					room[userID] = u
				}
			}
			s.voiceMu.Unlock()

			out := map[string]interface{}{"roomId": roomID, "userId": userID, "speaking": payload["speaking"]}
			server.To(socketio.Room("voice_" + roomID)).Emit("user-speaking", out)
		})

		client.On("voice-soundboard", func(datas ...any) {
			if len(datas) == 0 {
				return
			}
			payload := asMap(datas[0])
			roomID := mapStr(payload, "roomId")
			if roomID == "" {
				return
			}
			s.presenceMu.RLock()
			senderID := s.socketUsers[socketID]
			s.presenceMu.RUnlock()

			out := map[string]interface{}{
				"roomId":    roomID,
				"senderId":  senderID,
				"sound":     payload["sound"],
				"startedAt": payload["startedAt"],
			}
			server.To(socketio.Room("voice_" + roomID)).Emit("voice-soundboard", out)
		})

		client.On("voice-soundboard-stop", func(datas ...any) {
			if len(datas) == 0 {
				return
			}
			payload := asMap(datas[0])
			roomID := mapStr(payload, "roomId")
			if roomID == "" {
				return
			}
			s.presenceMu.RLock()
			senderID := s.socketUsers[socketID]
			s.presenceMu.RUnlock()

			server.To(socketio.Room("voice_" + roomID)).Emit("voice-soundboard-stop", map[string]interface{}{
				"roomId":   roomID,
				"senderId": senderID,
			})
		})

		client.On("voice-kick", func(datas ...any) {
			if len(datas) == 0 {
				return
			}
			payload := asMap(datas[0])
			roomID := mapStr(payload, "roomId")
			targetID := mapStr(payload, "targetId")
			if roomID == "" || targetID == "" {
				return
			}

			// Remove target from voice room map
			s.voiceMu.Lock()
			if room := s.voiceRooms[roomID]; room != nil {
				delete(room, targetID)
			}
			// Find and clear target's socket voice tracking
			if sid := s.socketIDForUser(targetID); sid != "" {
				if s.socketVoice[sid] == roomID {
					delete(s.socketVoice, sid)
				}
			}
			s.voiceMu.Unlock()

			// Tell the kicked user
			server.To(socketio.Room("user_" + targetID)).Emit("voice-kicked", map[string]interface{}{"roomId": roomID})

			// Tell everyone else the user left
			leftPayload := map[string]interface{}{"roomId": roomID, "userId": targetID}
			server.To(socketio.Room("voice_" + roomID)).Emit("user-left-voice", leftPayload)
			server.To(socketio.Room("sub_voice_" + roomID)).Emit("user-left-voice", leftPayload)
		})

		client.On("voice-server-mute", func(datas ...any) {
			if len(datas) == 0 {
				return
			}
			payload := asMap(datas[0])
			roomID := mapStr(payload, "roomId")
			targetID := mapStr(payload, "targetId")
			if roomID == "" || targetID == "" {
				return
			}
			muted := payload["muted"]

			// Update state in map
			s.voiceMu.Lock()
			if room := s.voiceRooms[roomID]; room != nil {
				if u := asMap(room[targetID]); u != nil {
					u["isMuted"] = muted
					room[targetID] = u
				}
			}
			s.voiceMu.Unlock()

			// Tell the target
			server.To(socketio.Room("user_" + targetID)).Emit("voice-server-muted", map[string]interface{}{
				"roomId": roomID,
				"muted":  muted,
			})

			// Broadcast mute change to room
			out := map[string]interface{}{"roomId": roomID, "userId": targetID, "muted": muted}
			server.To(socketio.Room("voice_" + roomID)).Emit("user-audio-toggled", out)
			server.To(socketio.Room("sub_voice_" + roomID)).Emit("user-audio-toggled", out)
		})

		client.On("voice-move-user", func(datas ...any) {
			if len(datas) == 0 {
				return
			}
			payload := asMap(datas[0])
			fromRoomID := mapStr(payload, "fromRoomId")
			targetRoomID := mapStr(payload, "targetRoomId")
			targetID := mapStr(payload, "targetId")
			if fromRoomID == "" || targetRoomID == "" || targetID == "" {
				return
			}

			// Move user in voice room maps
			s.voiceMu.Lock()
			var movedUser interface{}
			if room := s.voiceRooms[fromRoomID]; room != nil {
				movedUser = room[targetID]
				delete(room, targetID)
			}
			if s.voiceRooms[targetRoomID] == nil {
				s.voiceRooms[targetRoomID] = make(map[string]interface{})
			}
			if movedUser != nil {
				s.voiceRooms[targetRoomID][targetID] = movedUser
			}
			if sid := s.socketIDForUser(targetID); sid != "" {
				s.socketVoice[sid] = targetRoomID
			}
			s.voiceMu.Unlock()

			// Tell the moved user
			server.To(socketio.Room("user_" + targetID)).Emit("voice-moved", map[string]interface{}{
				"fromRoomId":   fromRoomID,
				"targetRoomId": targetRoomID,
			})

			// Broadcast leave from old room, join to new room
			leftPayload := map[string]interface{}{"roomId": fromRoomID, "userId": targetID}
			server.To(socketio.Room("voice_" + fromRoomID)).Emit("user-left-voice", leftPayload)
			server.To(socketio.Room("sub_voice_" + fromRoomID)).Emit("user-left-voice", leftPayload)

			joinPayload := map[string]interface{}{"roomId": targetRoomID, "user": movedUser}
			server.To(socketio.Room("voice_" + targetRoomID)).Emit("user-joined-voice", joinPayload)
			server.To(socketio.Room("sub_voice_" + targetRoomID)).Emit("user-joined-voice", joinPayload)
		})

		// ── DM call events ───────────────────────────────────────────────────

		client.On("dm-call-invite", func(datas ...any) {
			if len(datas) > 0 {
				server.Emit("dm-call-invite", datas[0])
			}
		})
		client.On("dm-call-accepted", func(datas ...any) {
			if len(datas) > 0 {
				server.Emit("dm-call-accepted", datas[0])
			}
		})
		client.On("dm-call-rejected", func(datas ...any) {
			if len(datas) > 0 {
				server.Emit("dm-call-rejected", datas[0])
			}
		})
		client.On("dm-call-cancelled", func(datas ...any) {
			if len(datas) > 0 {
				server.Emit("dm-call-cancelled", datas[0])
			}
		})
		client.On("dm-call-ended", func(datas ...any) {
			if len(datas) > 0 {
				server.Emit("dm-call-ended", datas[0])
			}
		})

		// ── Watch party ──────────────────────────────────────────────────────

		client.On("watch:join", func(datas ...any) {
			if len(datas) == 0 {
				return
			}
			payload := asMap(datas[0])
			if payload == nil {
				return
			}
			roomID := mapStr(payload, "roomId")
			userID := mapStr(payload, "userId")
			if roomID == "" || userID == "" {
				return
			}
			username := mapStr(payload, "username")
			if username == "" {
				username = userID
			}
			strPtr := func(key string) *string {
				if v, ok := payload[key]; ok {
					if s, ok := v.(string); ok && s != "" {
						return &s
					}
				}
				return nil
			}
			avatar := strPtr("avatarUrl")
			banner := strPtr("bannerUrl")
			sub := strPtr("subPlan")
			full := strPtr("fullname")
			var verified *bool
			if v, ok := payload["isVerified"]; ok {
				if b, ok := v.(bool); ok {
					verified = &b
				}
			}
			isHost, _ := payload["isHost"].(bool)

			// Remove any previous watch room membership for this socket
			if prev, ok := s.watchSocketIndex[socketID]; ok {
				prevRoom := prev[0]
				s.watchMu.Lock()
				if room, ok := s.watchRooms[prevRoom]; ok {
					delete(room, prev[1])
					if len(room) == 0 {
						delete(s.watchRooms, prevRoom)
						delete(s.watchRoomMeta, prevRoom)
					}
				}
				delete(s.watchSocketIndex, socketID)
				s.watchMu.Unlock()
				client.Leave(socketio.Room("watch_" + prevRoom))
				s.emitWatchParticipants(prevRoom)
			}

			s.watchMu.Lock()
			if s.watchRooms[roomID] == nil {
				s.watchRooms[roomID] = make(map[string]*watchParticipant)
			}
			s.watchRooms[roomID][userID] = &watchParticipant{
				SocketID:   socketID,
				UserID:     userID,
				Username:   username,
				Fullname:   full,
				AvatarURL:  avatar,
				BannerURL:  banner,
				SubPlan:    sub,
				IsVerified: verified,
				IsHost:     isHost,
				JoinedAt:   time.Now().UnixMilli(),
			}
			s.watchSocketIndex[socketID] = [2]string{roomID, userID}
			s.watchMu.Unlock()

			client.Join(socketio.Room("watch_" + roomID))
			s.emitWatchParticipants(roomID)
		})

		client.On("watch:leave", func(_ ...any) {
			roomID := s.removeFromWatchRoom(socketID)
			if roomID != "" {
				client.Leave(socketio.Room("watch_" + roomID))
				s.emitWatchParticipants(roomID)
			}
		})

		client.On("watch:play", func(datas ...any) {
			if len(datas) == 0 {
				return
			}
			payload := asMap(datas[0])
			roomID := mapStr(payload, "roomId")
			if roomID == "" {
				return
			}
			// record session start on first play
			s.watchMu.Lock()
			meta, ok := s.watchRoomMeta[roomID]
			if !ok {
				meta = &watchRoomMeta{}
				s.watchRoomMeta[roomID] = meta
			}
			started := meta.SessionStartedAt == 0
			if started {
				meta.SessionStartedAt = time.Now().UnixMilli()
			}
			s.watchMu.Unlock()
			if started {
				s.emitWatchParticipants(roomID)
			}
			client.To(socketio.Room("watch_" + roomID)).Emit("watch:play", map[string]interface{}{
				"timestamp": payload["timestamp"],
				"serverNow": time.Now().UnixMilli(),
			})
		})

		client.On("watch:pause", func(datas ...any) {
			if len(datas) == 0 {
				return
			}
			payload := asMap(datas[0])
			roomID := mapStr(payload, "roomId")
			if roomID == "" {
				return
			}
			client.To(socketio.Room("watch_" + roomID)).Emit("watch:pause", map[string]interface{}{
				"timestamp": payload["timestamp"],
				"serverNow": time.Now().UnixMilli(),
			})
		})

		client.On("watch:seek", func(datas ...any) {
			if len(datas) == 0 {
				return
			}
			payload := asMap(datas[0])
			roomID := mapStr(payload, "roomId")
			if roomID == "" {
				return
			}
			client.To(socketio.Room("watch_" + roomID)).Emit("watch:seek", map[string]interface{}{
				"timestamp": payload["timestamp"],
				"serverNow": time.Now().UnixMilli(),
			})
		})

		client.On("watch:sync-request", func(datas ...any) {
			if len(datas) == 0 {
				return
			}
			payload := asMap(datas[0])
			roomID := mapStr(payload, "roomId")
			if roomID == "" {
				return
			}
			client.To(socketio.Room("watch_" + roomID)).Emit("watch:sync-request", map[string]interface{}{
				"roomId": roomID,
			})
		})

		client.On("watch:sync-response", func(datas ...any) {
			if len(datas) == 0 {
				return
			}
			payload := asMap(datas[0])
			roomID := mapStr(payload, "roomId")
			if roomID == "" {
				return
			}
			client.To(socketio.Room("watch_" + roomID)).Emit("watch:sync-response", map[string]interface{}{
				"timestamp": payload["timestamp"],
				"paused":    payload["paused"],
				"serverNow": time.Now().UnixMilli(),
			})
		})

		client.On("watch:end", func(datas ...any) {
			if len(datas) == 0 {
				return
			}
			payload := asMap(datas[0])
			roomID := mapStr(payload, "roomId")
			if roomID == "" {
				return
			}
			client.To(socketio.Room("watch_" + roomID)).Emit("watch:end", map[string]interface{}{
				"roomId": roomID,
			})
			s.watchMu.Lock()
			// clear all socket index entries pointing at this room
			for sid, entry := range s.watchSocketIndex {
				if entry[0] == roomID {
					delete(s.watchSocketIndex, sid)
				}
			}
			delete(s.watchRooms, roomID)
			delete(s.watchRoomMeta, roomID)
			s.watchMu.Unlock()
		})

		client.On("watch:kick", func(datas ...any) {
			if len(datas) == 0 {
				return
			}
			payload := asMap(datas[0])
			roomID := mapStr(payload, "roomId")
			targetID := mapStr(payload, "targetUserId")
			if roomID == "" || targetID == "" {
				return
			}
			s.watchMu.Lock()
			room, ok := s.watchRooms[roomID]
			if !ok {
				s.watchMu.Unlock()
				return
			}
			target, ok := room[targetID]
			if !ok {
				s.watchMu.Unlock()
				return
			}
			targetSocketID := target.SocketID
			delete(room, targetID)
			delete(s.watchSocketIndex, targetSocketID)
			if len(room) == 0 {
				delete(s.watchRooms, roomID)
				delete(s.watchRoomMeta, roomID)
			}
			s.watchMu.Unlock()

			// notify the kicked user via their user_ room (reliable across sockets)
			server.To(socketio.Room("user_" + targetID)).Emit("watch:kicked", map[string]interface{}{
				"roomId": roomID,
			})
			s.emitWatchParticipants(roomID)
		})

		// ── Group & channel rooms ────────────────────────────────────────────

		client.On("joinGroupRoom", func(datas ...any) {
			if len(datas) > 0 {
				groupID := fmt.Sprintf("%v", datas[0])
				client.Join(socketio.Room("group_" + groupID))
			}
		})
		client.On("leaveGroupRoom", func(datas ...any) {
			if len(datas) > 0 {
				groupID := fmt.Sprintf("%v", datas[0])
				client.Leave(socketio.Room("group_" + groupID))
			}
		})
		client.On("joinChannelRoom", func(datas ...any) {
			if len(datas) > 0 {
				channelID := fmt.Sprintf("%v", datas[0])
				client.Join(socketio.Room("channel_" + channelID))
			}
		})
		client.On("leaveChannelRoom", func(datas ...any) {
			if len(datas) > 0 {
				channelID := fmt.Sprintf("%v", datas[0])
				client.Leave(socketio.Room("channel_" + channelID))
			}
		})

		// ── Typing indicators ────────────────────────────────────────────────

		client.On("userTyping", func(datas ...any) {
			if len(datas) == 0 {
				return
			}
			payload, ok := datas[0].(map[string]interface{})
			if !ok {
				return
			}
			s.presenceMu.RLock()
			userID := s.socketUsers[socketID]
			s.presenceMu.RUnlock()
			payload["userId"] = userID

			if convID, _ := payload["conversationId"].(string); convID != "" {
				server.To(socketio.Room("conversation_" + convID)).Emit("userTyping", payload)
			} else if groupID, _ := payload["groupId"].(string); groupID != "" {
				server.To(socketio.Room("group_" + groupID)).Emit("userTyping", payload)
			}
		})

		// ── DM room ──────────────────────────────────────────────────────────

		client.On("joinDirectRoom", func(datas ...any) {
			if len(datas) > 0 {
				conversationID := fmt.Sprintf("%v", datas[0])
				client.Join(socketio.Room("conversation_" + conversationID))
			}
		})
		client.On("leaveRoom", func(datas ...any) {
			if len(datas) > 0 {
				room := fmt.Sprintf("%v", datas[0])
				client.Leave(socketio.Room(room))
			}
		})
		client.On("markDirectRead", func(datas ...any) {
			if len(datas) == 0 {
				return
			}
			payload, ok := datas[0].(map[string]interface{})
			if !ok {
				return
			}
			conversationID := fmt.Sprintf("%v", payload["conversationId"])
			messageID := fmt.Sprintf("%v", payload["messageId"])
			if conversationID == "" || messageID == "" {
				return
			}
			_, err := s.db.Exec(
				`UPDATE direct_messages SET status = 'read' WHERE conversation_id = $1 AND status != 'read'`,
				conversationID,
			)
			if err != nil {
				log.Printf("markDirectRead DB error: %v", err)
				return
			}
			server.To(socketio.Room("conversation_"+conversationID)).Emit("directMessageStatusUpdate", map[string]interface{}{
				"messageId":      messageID,
				"conversationId": conversationID,
				"status":         "read",
			})
		})
		client.On("directMessageDelivered", func(datas ...any) {
			if len(datas) == 0 {
				return
			}
			payload, ok := datas[0].(map[string]interface{})
			if !ok {
				return
			}
			conversationID := fmt.Sprintf("%v", payload["conversationId"])
			messageID := fmt.Sprintf("%v", payload["messageId"])
			if conversationID == "" || messageID == "" {
				return
			}
			_, err := s.db.Exec(
				`UPDATE direct_messages SET status = 'delivered' WHERE id = $1 AND status = 'sent'`,
				messageID,
			)
			if err != nil {
				log.Printf("directMessageDelivered DB error: %v", err)
				return
			}
			server.To(socketio.Room("conversation_"+conversationID)).Emit("directMessageStatusUpdate", map[string]interface{}{
				"messageId":      messageID,
				"conversationId": conversationID,
				"status":         "delivered",
			})
		})

		// ── Disconnect ───────────────────────────────────────────────────────

		client.On("disconnect", func(_ ...any) {
			log.Printf("Socket.IO disconnected: %s", socketID)

			// Voice cleanup
			roomID, userID := s.removeFromAllVoiceRooms(socketID)
			if roomID != "" && userID != "" {
				leftPayload := map[string]interface{}{"roomId": roomID, "userId": userID}
				server.To(socketio.Room("voice_" + roomID)).Emit("user-left-voice", leftPayload)
				server.To(socketio.Room("sub_voice_" + roomID)).Emit("user-left-voice", leftPayload)
			}

			// Watch cleanup
			if watchRoomID := s.removeFromWatchRoom(socketID); watchRoomID != "" {
				s.emitWatchParticipants(watchRoomID)
			}

			// Presence cleanup
			s.trackOffline(socketID)
		})
	})
}

// ── public API ────────────────────────────────────────────────────────────────

func (s *SocketIOService) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	s.server.ServeHandler(nil).ServeHTTP(w, r)
}

func (s *SocketIOService) Close() {
	s.server.Close(nil)
}

func (s *SocketIOService) BroadcastToChannel(channelID, event string, data interface{}) {
	s.server.To(socketio.Room(channelID)).Emit(event, data)
}

func (s *SocketIOService) BroadcastToRoom(roomID, event string, data interface{}) {
	s.server.To(socketio.Room(roomID)).Emit(event, data)
}

func (s *SocketIOService) BroadcastToAll(event string, data interface{}) {
	s.server.Emit(event, data)
}

func (s *SocketIOService) GetConnectedClientsCount() int {
	s.presenceMu.RLock()
	defer s.presenceMu.RUnlock()
	return len(s.userSockets)
}

func (s *SocketIOService) EchoMiddleware() echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			if c.Request().URL.Path == "/socket.io/" {
				s.ServeHTTP(c.Response().Writer, c.Request())
				return nil
			}
			return next(c)
		}
	}
}
