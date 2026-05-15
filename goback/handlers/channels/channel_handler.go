package channels

import (
	"net/http"

	"github.com/Hamza-agha-tec/goback/middleware"
	"github.com/Hamza-agha-tec/goback/models"
	"github.com/Hamza-agha-tec/goback/services"
	"github.com/labstack/echo/v4"
)

type ChannelHandler struct {
	channelService *services.ChannelService
}

func NewChannelHandler(channelService *services.ChannelService) *ChannelHandler {
	return &ChannelHandler{
		channelService: channelService,
	}
}

func (h *ChannelHandler) CreateChannel(c echo.Context) error {
	user := c.Get("user").(*middleware.AuthenticatedUser)

	var createData models.CreateChannelDto
	if err := c.Bind(&createData); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request body"})
	}

	channel, err := h.channelService.CreateChannel(user.UserID, createData)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusCreated, channel)
}

func (h *ChannelHandler) GetUserChannels(c echo.Context) error {
	user := c.Get("user").(*middleware.AuthenticatedUser)

	channels, err := h.channelService.GetUserChannels(user.UserID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to get user channels ..."})
	}

	return c.JSON(http.StatusOK, channels)
}

func (h *ChannelHandler) DiscoverChannels(c echo.Context) error {
	user := c.Get("user").(*middleware.AuthenticatedUser)

	channels, err := h.channelService.DiscoverChannels(user.UserID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to discover channels"})
	}

	return c.JSON(http.StatusOK, channels)
}

func (h *ChannelHandler) GetInviteLink(c echo.Context) error {
	channelID := c.Param("id")

	// TODO: Implement invite link generation
	_ = channelID // Placeholder
	return c.JSON(http.StatusOK, map[string]string{"invite_link": "placeholder"})
}

func (h *ChannelHandler) GetChannelDetails(c echo.Context) error {
	channelID := c.Param("id")

	channel, err := h.channelService.GetChannelDetails(channelID)
	if err != nil {
		if err.Error() == "channel not found" {
			return c.JSON(http.StatusNotFound, map[string]string{"error": "channel not found"})
		}
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to get channel details"})
	}

	return c.JSON(http.StatusOK, channel)
}

func (h *ChannelHandler) UpdateChannel(c echo.Context) error {
	channelID := c.Param("id")

	var updateData models.UpdateChannelDto
	if err := c.Bind(&updateData); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request body"})
	}

	err := h.channelService.UpdateChannel(channelID, updateData)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to update channel"})
	}

	return c.JSON(http.StatusOK, map[string]string{"message": "channel updated successfully"})
}

func (h *ChannelHandler) DeleteChannel(c echo.Context) error {
	user := c.Get("user").(*middleware.AuthenticatedUser)
	channelID := c.Param("id")

	err := h.channelService.DeleteChannel(user.UserID, channelID)
	if err != nil {
		if err.Error() == "channel not found" {
			return c.JSON(http.StatusNotFound, map[string]string{"error": "channel not found"})
		}
		if err.Error() == "only channel owner can delete channel" {
			return c.JSON(http.StatusForbidden, map[string]string{"error": err.Error()})
		}
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to delete channel"})
	}

	return c.JSON(http.StatusOK, map[string]string{"message": "channel deleted successfully"})
}

func (h *ChannelHandler) GetMembers(c echo.Context) error {
	user := c.Get("user").(*middleware.AuthenticatedUser)
	channelID := c.Param("id")

	members, err := h.channelService.GetMembers(channelID, user.UserID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusOK, members)
}

func (h *ChannelHandler) AddMember(c echo.Context) error {
	channelID := c.Param("id")

	var addData models.AddMemberDto
	if err := c.Bind(&addData); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request body"})
	}

	err := h.channelService.AddMember(channelID, addData)
	if err != nil {
		if err.Error() == "user is already a member" {
			return c.JSON(http.StatusBadRequest, map[string]string{"error": err.Error()})
		}
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to add member"})
	}

	return c.JSON(http.StatusOK, map[string]string{"message": "member added successfully"})
}

func (h *ChannelHandler) KickMember(c echo.Context) error {
	user := c.Get("user").(*middleware.AuthenticatedUser)
	channelID := c.Param("id")
	targetUserID := c.Param("userId")

	err := h.channelService.KickMember(channelID, user.UserID, targetUserID)
	if err != nil {
		if err.Error() == "access denied" || err.Error() == "insufficient permissions" {
			return c.JSON(http.StatusForbidden, map[string]string{"error": err.Error()})
		}
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to kick member"})
	}

	return c.JSON(http.StatusOK, map[string]string{"message": "member kicked successfully"})
}

func (h *ChannelHandler) JoinChannel(c echo.Context) error {
	user := c.Get("user").(*middleware.AuthenticatedUser)
	channelID := c.Param("id")

	err := h.channelService.JoinChannel(user.UserID, channelID)
	if err != nil {
		if err.Error() == "channel not found" {
			return c.JSON(http.StatusNotFound, map[string]string{"error": "channel not found"})
		}
		if err.Error() == "cannot join private channel directly" || err.Error() == "already a member" {
			return c.JSON(http.StatusBadRequest, map[string]string{"error": err.Error()})
		}
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to join channel"})
	}

	return c.JSON(http.StatusOK, map[string]string{"message": "joined channel successfully"})
}

func (h *ChannelHandler) RequestJoinChannel(c echo.Context) error {
	user := c.Get("user").(*middleware.AuthenticatedUser)
	channelID := c.Param("id")

	err := h.channelService.RequestJoinChannel(user.UserID, channelID)
	if err != nil {
		if err.Error() == "channel not found" {
			return c.JSON(http.StatusNotFound, map[string]string{"error": "channel not found"})
		}
		if err.Error() == "can only request to join private channels" ||
			err.Error() == "already a member" ||
			err.Error() == "join request already pending" {
			return c.JSON(http.StatusBadRequest, map[string]string{"error": err.Error()})
		}
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to request join channel"})
	}

	return c.JSON(http.StatusOK, map[string]string{"message": "join request sent successfully"})
}

func (h *ChannelHandler) GetChannelJoinRequests(c echo.Context) error {
	user := c.Get("user").(*middleware.AuthenticatedUser)
	channelID := c.Param("id")

	// TODO: Implement get channel join requests
	_ = user.UserID
	_ = channelID
	return c.JSON(http.StatusOK, []interface{}{})
}

func (h *ChannelHandler) RespondToChannelJoinRequest(c echo.Context) error {
	user := c.Get("user").(*middleware.AuthenticatedUser)
	channelID := c.Param("id")
	requestID := c.Param("requestId")

	var body struct {
		Status string `json:"status" validate:"required,oneof=ACCEPTED REJECTED"`
	}

	if err := c.Bind(&body); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request body"})
	}

	// TODO: Implement respond to channel join request
	_ = user.UserID
	_ = channelID
	_ = requestID
	_ = body.Status

	return c.JSON(http.StatusOK, map[string]string{"message": "join request processed successfully"})
}
