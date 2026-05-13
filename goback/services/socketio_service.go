package services

import (
	"fmt"
	"log"
	"net/http"

	"github.com/labstack/echo/v4"
	socketio "github.com/zishang520/socket.io/v2/socket"
)

type SocketIOService struct {
	server *socketio.Server
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
	Event     string      `json:"event"` // join, leave, speak, mute, deafen
	Data      interface{} `json:"data,omitempty"`
	Timestamp string      `json:"timestamp"`
}

func NewSocketIOService() *SocketIOService {
	server := socketio.NewServer(nil, nil)

	// Configure connection handling
	server.On("connection", func(clients ...any) {
		client := clients[0].(*socketio.Socket)
		log.Printf("Socket.IO client connected: %s", client.Id())

		// Handle voice room joining
		client.On("join-voice-room", func(datas ...any) {
			if len(datas) > 0 {
				roomID := fmt.Sprintf("%v", datas[0])
				log.Printf("Client %s joining voice room: %s", client.Id(), roomID)
				client.Join(socketio.Room(roomID))
			}
		})

		// Handle voice room leaving
		client.On("leave-voice-room", func(datas ...any) {
			if len(datas) > 0 {
				roomID := fmt.Sprintf("%v", datas[0])
				log.Printf("Client %s leaving voice room: %s", client.Id(), roomID)
				client.Leave(socketio.Room(roomID))
			}
		})

		// Handle DM call invite
		client.On("dm-call-invite", func(datas ...any) {
			if len(datas) > 0 {
				log.Printf("DM call invite received from %s: %v", client.Id(), datas[0])
				// Broadcast to target user or handle call logic
				server.Emit("dm-call-invite", datas[0])
			}
		})

		// Handle DM call accepted
		client.On("dm-call-accepted", func(datas ...any) {
			if len(datas) > 0 {
				log.Printf("DM call accepted by %s: %v", client.Id(), datas[0])
				server.Emit("dm-call-accepted", datas[0])
			}
		})

		// Handle DM call rejected
		client.On("dm-call-rejected", func(datas ...any) {
			if len(datas) > 0 {
				log.Printf("DM call rejected by %s: %v", client.Id(), datas[0])
				server.Emit("dm-call-rejected", datas[0])
			}
		})

		// Handle DM call cancelled
		client.On("dm-call-cancelled", func(datas ...any) {
			if len(datas) > 0 {
				log.Printf("DM call cancelled by %s: %v", client.Id(), datas[0])
				server.Emit("dm-call-cancelled", datas[0])
			}
		})

		// Handle DM call ended
		client.On("dm-call-ended", func(datas ...any) {
			if len(datas) > 0 {
				log.Printf("DM call ended by %s: %v", client.Id(), datas[0])
				server.Emit("dm-call-ended", datas[0])
			}
		})

		// Handle watch join
		client.On("watch:join", func(datas ...any) {
			if len(datas) > 0 {
				roomID := fmt.Sprintf("%v", datas[0])
				log.Printf("Client %s joining watch room: %s", client.Id(), roomID)
				client.Join(socketio.Room(roomID))
				server.To(socketio.Room(roomID)).Emit("watch:join", client.Id())
			}
		})

		// Handle watch play
		client.On("watch:play", func(datas ...any) {
			if len(datas) > 0 {
				log.Printf("Watch play event from %s: %v", client.Id(), datas[0])
				// Broadcast to all clients in the same watch room
				server.Emit("watch:play", datas[0])
			}
		})

		// Handle watch pause
		client.On("watch:pause", func(datas ...any) {
			if len(datas) > 0 {
				log.Printf("Watch pause event from %s: %v", client.Id(), datas[0])
				server.Emit("watch:pause", datas[0])
			}
		})

		// Handle watch seek
		client.On("watch:seek", func(datas ...any) {
			if len(datas) > 0 {
				log.Printf("Watch seek event from %s: %v", client.Id(), datas[0])
				server.Emit("watch:seek", datas[0])
			}
		})

		// Handle watch sync request
		client.On("watch:sync-request", func(datas ...any) {
			if len(datas) > 0 {
				log.Printf("Watch sync request from %s: %v", client.Id(), datas[0])
				server.Emit("watch:sync-request", datas[0])
			}
		})

		// Handle watch sync response
		client.On("watch:sync-response", func(datas ...any) {
			if len(datas) > 0 {
				log.Printf("Watch sync response from %s: %v", client.Id(), datas[0])
				server.Emit("watch:sync-response", datas[0])
			}
		})

		// Handle voice room audio toggle
		client.On("voice-room-audio-toggle", func(datas ...any) {
			if len(datas) > 0 {
				log.Printf("Voice room audio toggle from %s: %v", client.Id(), datas[0])
				server.Emit("voice-room-audio-toggle", datas[0])
			}
		})

		// Handle voice speaking
		client.On("voice-speaking", func(datas ...any) {
			if len(datas) > 0 {
				log.Printf("Voice speaking event from %s: %v", client.Id(), datas[0])
				server.Emit("voice-speaking", datas[0])
			}
		})

		// Handle voice soundboard
		client.On("voice-soundboard", func(datas ...any) {
			if len(datas) > 0 {
				log.Printf("Voice soundboard event from %s: %v", client.Id(), datas[0])
				server.Emit("voice-soundboard", datas[0])
			}
		})

		// Handle voice kick
		client.On("voice-kick", func(datas ...any) {
			if len(datas) > 0 {
				log.Printf("Voice kick event from %s: %v", client.Id(), datas[0])
				server.Emit("voice-kick", datas[0])
			}
		})

		// Handle voice server mute
		client.On("voice-server-mute", func(datas ...any) {
			if len(datas) > 0 {
				log.Printf("Voice server mute event from %s: %v", client.Id(), datas[0])
				server.Emit("voice-server-mute", datas[0])
			}
		})

		// Handle subscribe voice rooms
		client.On("subscribe-voice-rooms", func(datas ...any) {
			if len(datas) > 0 {
				log.Printf("Subscribe voice rooms from %s: %v", client.Id(), datas[0])
				server.Emit("subscribe-voice-rooms", datas[0])
			}
		})

		client.On("disconnect", func(datas ...any) {
			log.Printf("Socket.IO client disconnected: %s", client.Id())
		})
	})

	return &SocketIOService{
		server: server,
	}
}

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
	// Note: zishang520/socket.io doesn't provide a direct way to get connected client count
	// This would need to be tracked manually
	return 0 // Placeholder
}

// Echo middleware for Socket.IO
func (s *SocketIOService) EchoMiddleware() echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			// Check if this is a Socket.IO request
			if c.Request().URL.Path == "/socket.io/" {
				s.ServeHTTP(c.Response().Writer, c.Request())
				return nil
			}
			return next(c)
		}
	}
}
