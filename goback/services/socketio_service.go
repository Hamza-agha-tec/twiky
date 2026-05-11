package services

import (
	"log"
	"net/http"

	socketio "github.com/googollee/go-socket.io"
	"github.com/labstack/echo/v4"
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
	server := socketio.NewServer(nil)

	// Configure connection handling
	server.OnConnect("/", func(s socketio.Conn) error {
		log.Printf("Socket.IO client connected: %s", s.ID())
		return nil
	})

	server.OnDisconnect("/", func(s socketio.Conn, reason string) {
		log.Printf("Socket.IO client disconnected: %s, reason: %s", s.ID(), reason)
	})

	// Handle chat messages
	server.OnEvent("/", "chat_message", func(s socketio.Conn, msg ChatMessage) {
		log.Printf("Chat message received from %s in channel %s: %s", msg.UserID, msg.ChannelID, msg.Message)

		// Broadcast to all clients in the same channel room
		server.BroadcastToRoom("/", msg.ChannelID, "chat_message", msg)
	})

	// Handle voice events
	server.OnEvent("/", "voice_event", func(s socketio.Conn, event VoiceEvent) {
		log.Printf("Voice event from %s in room %s: %s", event.UserID, event.RoomID, event.Event)

		// Broadcast to all clients in the same voice room
		server.BroadcastToRoom("/", event.RoomID, "voice_event", event)
	})

	// Handle channel joining
	server.OnEvent("/", "join_channel", func(s socketio.Conn, channelID string) {
		log.Printf("Client %s joining channel: %s", s.ID(), channelID)
		s.Join(channelID)
	})

	// Handle channel leaving
	server.OnEvent("/", "leave_channel", func(s socketio.Conn, channelID string) {
		log.Printf("Client %s leaving channel: %s", s.ID(), channelID)
		s.Leave(channelID)
	})

	// Handle voice room joining
	server.OnEvent("/", "join_voice_room", func(s socketio.Conn, roomID string) {
		log.Printf("Client %s joining voice room: %s", s.ID(), roomID)
		s.Join(roomID)
	})

	// Handle voice room leaving
	server.OnEvent("/", "leave_voice_room", func(s socketio.Conn, roomID string) {
		log.Printf("Client %s leaving voice room: %s", s.ID(), roomID)
		s.Leave(roomID)
	})

	return &SocketIOService{
		server: server,
	}
}

func (s *SocketIOService) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	s.server.ServeHTTP(w, r)
}

func (s *SocketIOService) Close() error {
	return s.server.Close()
}

func (s *SocketIOService) BroadcastToChannel(channelID, event string, data interface{}) {
	s.server.BroadcastToRoom("/", channelID, event, data)
}

func (s *SocketIOService) BroadcastToRoom(roomID, event string, data interface{}) {
	s.server.BroadcastToRoom("/", roomID, event, data)
}

func (s *SocketIOService) BroadcastToAll(event string, data interface{}) {
	s.server.BroadcastToRoom("/", "", event, data)
}

func (s *SocketIOService) GetConnectedClientsCount() int {
	// Note: go-socket.io doesn't provide a direct way to get connected client count
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
