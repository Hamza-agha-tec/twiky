package messaging

import (
	"log"
	"net/http"

	"github.com/Hamza-agha-tec/goback/models"
	"github.com/Hamza-agha-tec/goback/services"
	"github.com/labstack/echo/v4"
)

type MessagingHandler struct {
	messagingService    *services.MessagingService
	socketIOService     *services.SocketIOService
	notificationService *services.NotificationService
}

func NewMessagingHandler(messagingService *services.MessagingService, socketIOService *services.SocketIOService, notificationService *services.NotificationService) *MessagingHandler {
	return &MessagingHandler{
		messagingService:    messagingService,
		socketIOService:     socketIOService,
		notificationService: notificationService,
	}
}

// --- DIRECT CONVERSATIONS ---

func (h *MessagingHandler) GetDirectConversations(c echo.Context) error {
	userID, ok := c.Get("userID").(string)
	if !ok || userID == "" {
		return c.JSON(http.StatusUnauthorized, map[string]string{
			"error": "unauthorized",
		})
	}

	conversations, err := h.messagingService.GetDirectConversations(userID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": err.Error(),
		})
	}

	return c.JSON(http.StatusOK, conversations)
}

func (h *MessagingHandler) CreateDirectConversation(c echo.Context) error {
	userID := c.Get("userID").(string)

	var dto models.StartDirectConversationDto
	if err := c.Bind(&dto); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request format"})
	}

	if dto.TargetUserID == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "targetUserId is required"})
	}

	conv, err := h.messagingService.CreateDirectConversation(userID, dto)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusCreated, conv)
}

func (h *MessagingHandler) GetDirectMessages(c echo.Context) error {
	userID := c.Get("userID").(string)
	conversationID := c.Param("id")

	messages, err := h.messagingService.GetDirectMessages(userID, conversationID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusOK, messages)
}

func (h *MessagingHandler) SendDirectMessage(c echo.Context) error {
	userID := c.Get("userID").(string)
	conversationID := c.Param("id")

	var dto models.SendDirectMessageDto
	if err := c.Bind(&dto); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request format"})
	}

	if dto.Content == "" && dto.FileUrl == "" && len(dto.FileUrls) == 0 {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "content or file is required"})
	}

	msg, err := h.messagingService.SendDirectMessage(userID, conversationID, dto)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	// Emit via WebSockets
	h.socketIOService.BroadcastToRoom("conversation_"+conversationID, "newDirectMessage", msg)

	return c.JSON(http.StatusCreated, msg)
}

func (h *MessagingHandler) DeleteDirectConversation(c echo.Context) error {
	userID := c.Get("userID").(string)
	conversationID := c.Param("id")

	result, err := h.messagingService.DeleteDirectConversation(userID, conversationID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusOK, result)
}

func (h *MessagingHandler) ToggleDirectMessageReaction(c echo.Context) error {
	userID := c.Get("userID").(string)
	messageID := c.Param("messageId")

	var dto models.ToggleReactionDto
	if err := c.Bind(&dto); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request format"})
	}

	if dto.Emoji == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "emoji is required"})
	}

	msg, err := h.messagingService.ToggleDirectMessageReaction(userID, messageID, dto.Emoji)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	if convID := msg.ConversationID; convID != "" {
		h.socketIOService.BroadcastToRoom("conversation_"+convID, "directMessageUpdated", msg)
	}

	return c.JSON(http.StatusOK, msg)
}

// --- GROUP MESSAGING ---

func (h *MessagingHandler) GetGroupMessages(c echo.Context) error {
	userID := c.Get("userID").(string)
	groupID := c.Param("groupId")

	messages, err := h.messagingService.GetGroupMessages(userID, groupID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusOK, messages)
}

func (h *MessagingHandler) SendGroupMessage(c echo.Context) error {
	userID := c.Get("userID").(string)
	groupID := c.Param("groupId")

	log.Println("send group message", userID, groupID)

	var dto models.SendGroupMessageDto
	if err := c.Bind(&dto); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request format"})
	}

	if dto.Content == "" && dto.FileUrl == "" && len(dto.FileUrls) == 0 {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "content or file is required"})
	}

	msg, err := h.messagingService.SendGroupMessage(userID, groupID, dto)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	// Emit via WebSockets
	h.socketIOService.BroadcastToRoom("group_"+groupID, "newGroupMessage", msg)

	// Detect Mentions and create notifications
	if msg.Content != "" {
		go h.notificationService.CreateMentionNotifications(userID, groupID, msg.Content, dto.EntityMentions)
	}

	return c.JSON(http.StatusCreated, msg)
}

func (h *MessagingHandler) ToggleGroupMessageReaction(c echo.Context) error {
	userID := c.Get("userID").(string)
	messageID := c.Param("messageId")

	var dto models.ToggleReactionDto
	if err := c.Bind(&dto); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request format"})
	}

	if dto.Emoji == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "emoji is required"})
	}

	msg, err := h.messagingService.ToggleGroupMessageReaction(userID, messageID, dto.Emoji)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	if msg.GroupID != "" {
		h.socketIOService.BroadcastToRoom("group_"+msg.GroupID, "groupMessageUpdated", msg)
	}

	return c.JSON(http.StatusOK, msg)
}

func (h *MessagingHandler) ToggleGroupMessagePin(c echo.Context) error {
	userID := c.Get("userID").(string)
	messageID := c.Param("messageId")

	msg, err := h.messagingService.ToggleGroupMessagePin(userID, messageID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	if msg.GroupID != "" {
		h.socketIOService.BroadcastToRoom("group_"+msg.GroupID, "groupMessageUpdated", msg)
	}

	return c.JSON(http.StatusOK, msg)
}

func (h *MessagingHandler) DeleteGroupMessage(c echo.Context) error {
	userID := c.Get("userID").(string)
	messageID := c.Param("messageId")

	result, err := h.messagingService.DeleteGroupMessage(userID, messageID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	// Emit via WebSockets
	if groupID, ok := result["groupId"].(string); ok {
		h.socketIOService.BroadcastToRoom("group_"+groupID, "groupMessageDeleted", map[string]interface{}{
			"groupId":   groupID,
			"messageId": messageID,
		})
	}

	return c.JSON(http.StatusOK, result)
}
