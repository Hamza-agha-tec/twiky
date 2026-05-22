package groups

import (
	"log"
	"net/http"

	"github.com/Hamza-agha-tec/goback/middleware"
	"github.com/Hamza-agha-tec/goback/models"
	"github.com/Hamza-agha-tec/goback/services"
	"github.com/labstack/echo/v4"
)

type GroupHandler struct {
	groupService    *services.GroupService
	socketIOService *services.SocketIOService
}

func NewGroupHandler(groupService *services.GroupService, socketIOService *services.SocketIOService) *GroupHandler {
	return &GroupHandler{
		groupService:    groupService,
		socketIOService: socketIOService,
	}
}

func (h *GroupHandler) CreateGroup(c echo.Context) error {
	user := c.Get("user").(*middleware.AuthenticatedUser)
	channelID := c.Param("channelId")

	var createData models.CreateGroupDto
	if err := c.Bind(&createData); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request body"})
	}

	group, err := h.groupService.CreateGroup(channelID, user.UserID, createData)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to create group"})
	}

	h.socketIOService.BroadcastToRoom("channel_"+channelID, "groupCreated", group)

	return c.JSON(http.StatusCreated, group)
}

func (h *GroupHandler) GetChannelGroups(c echo.Context) error {
	user := c.Get("user").(*middleware.AuthenticatedUser)
	channelID := c.Param("channelId")

	groups, err := h.groupService.GetGroupsInChannel(channelID, user.UserID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusOK, groups)
}

func (h *GroupHandler) GetGroupMembers(c echo.Context) error {
	user := c.Get("user").(*middleware.AuthenticatedUser)
	groupID := c.Param("groupId")

	members, err := h.groupService.GetGroupMembers(groupID, user.UserID)
	if err != nil {
		if err.Error() == "access denied" {
			return c.JSON(http.StatusForbidden, map[string]string{"error": "access denied"})
		}
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusOK, members)
}

func (h *GroupHandler) UpdateGroup(c echo.Context) error {
	user := c.Get("user").(*middleware.AuthenticatedUser)
	groupID := c.Param("groupId")

	var updateData models.UpdateGroupDto
	if err := c.Bind(&updateData); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request body"})
	}

	err := h.groupService.UpdateGroup(groupID, user.UserID, updateData)
	if err != nil {
		if err.Error() == "access denied" || err.Error() == "insufficient permissions" {
			return c.JSON(http.StatusForbidden, map[string]string{"error": err.Error()})
		}
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to update group"})
	}

	h.socketIOService.BroadcastToRoom("group_"+groupID, "groupUpdated", map[string]interface{}{
		"groupId": groupID,
		"data":    updateData,
	})

	return c.JSON(http.StatusOK, map[string]string{"message": "group updated successfully"})
}

func (h *GroupHandler) DeleteGroup(c echo.Context) error {
	user := c.Get("user").(*middleware.AuthenticatedUser)
	groupID := c.Param("groupId")

	err := h.groupService.DeleteGroup(groupID, user.UserID)
	if err != nil {
		if err.Error() == "group not found" {
			return c.JSON(http.StatusNotFound, map[string]string{"error": "group not found"})
		}
		if err.Error() == "only group owner can delete group" {
			return c.JSON(http.StatusForbidden, map[string]string{"error": err.Error()})
		}
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to delete group"})
	}

	h.socketIOService.BroadcastToRoom("group_"+groupID, "groupDeleted", map[string]interface{}{"groupId": groupID})

	return c.JSON(http.StatusOK, map[string]string{"message": "group deleted successfully"})
}

func (h *GroupHandler) AddGroupMember(c echo.Context) error {
	user := c.Get("user").(*middleware.AuthenticatedUser)
	groupID := c.Param("groupId")

	var addData models.AddGroupMemberDto
	if err := c.Bind(&addData); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request body"})
	}

	err := h.groupService.AddMemberToGroup(groupID, user.UserID, addData)
	if err != nil {
		if err.Error() == "access denied" || err.Error() == "insufficient permissions" {
			return c.JSON(http.StatusForbidden, map[string]string{"error": err.Error()})
		}
		if err.Error() == "user is already a member" {
			return c.JSON(http.StatusBadRequest, map[string]string{"error": err.Error()})
		}
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to add member"})
	}

	return c.JSON(http.StatusOK, map[string]string{"message": "member added successfully"})
}

func (h *GroupHandler) UpdateGroupMemberRole(c echo.Context) error {
	user := c.Get("user").(*middleware.AuthenticatedUser)
	groupID := c.Param("groupId")

	var updateData models.AddGroupMemberDto
	if err := c.Bind(&updateData); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request body"})
	}

	err := h.groupService.UpdateGroupMemberRole(groupID, user.UserID, updateData)
	if err != nil {
		if err.Error() == "access denied" || err.Error() == "insufficient permissions" {
			return c.JSON(http.StatusForbidden, map[string]string{"error": err.Error()})
		}
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to update member role"})
	}

	return c.JSON(http.StatusOK, map[string]string{"message": "member role updated successfully"})
}

func (h *GroupHandler) DeleteGroupMember(c echo.Context) error {
	user := c.Get("user").(*middleware.AuthenticatedUser)
	groupID := c.Param("groupId")
	memberID := c.Param("memberId")

	err := h.groupService.DeleteGroupMember(groupID, user.UserID, memberID)
	if err != nil {
		if err.Error() == "access denied" || err.Error() == "insufficient permissions" {
			return c.JSON(http.StatusForbidden, map[string]string{"error": err.Error()})
		}
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to remove member"})
	}

	return c.JSON(http.StatusOK, map[string]string{"message": "member removed successfully"})
}

func (h *GroupHandler) RequestJoin(c echo.Context) error {
	user := c.Get("user").(*middleware.AuthenticatedUser)
	groupID := c.Param("groupId")

	log.Println("trying to join a private group")

	err := h.groupService.RequestJoinGroup(groupID, user.UserID)
	if err != nil {
		if err.Error() == "group not found" {
			return c.JSON(http.StatusNotFound, map[string]string{"error": "group not found"})
		}
		if err.Error() == "can only request to join private groups" ||
			err.Error() == "already a member" ||
			err.Error() == "join request already exists" {
			return c.JSON(http.StatusBadRequest, map[string]string{"error": err.Error()})
		}
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusOK, map[string]string{"message": "join request sent successfully"})
}

func (h *GroupHandler) GetJoinRequests(c echo.Context) error {
	user := c.Get("user").(*middleware.AuthenticatedUser)
	groupID := c.Param("groupId")

	requests, err := h.groupService.GetJoinRequests(groupID, user.UserID)
	if err != nil {
		if err.Error() == "access denied" || err.Error() == "insufficient permissions" {
			return c.JSON(http.StatusForbidden, map[string]string{"error": err.Error()})
		}
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to get join requests"})
	}

	return c.JSON(http.StatusOK, requests)
}

func (h *GroupHandler) RespondToJoinRequest(c echo.Context) error {
	user := c.Get("user").(*middleware.AuthenticatedUser)
	groupID := c.Param("groupId")
	requestID := c.Param("requestId")

	var body struct {
		Status string `json:"status" validate:"required,oneof=ACCEPTED REJECTED"`
	}

	if err := c.Bind(&body); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request body"})
	}

	err := h.groupService.RespondToJoinRequest(groupID, requestID, body.Status, user.UserID)
	if err != nil {
		if err.Error() == "access denied" || err.Error() == "insufficient permissions" {
			return c.JSON(http.StatusForbidden, map[string]string{"error": err.Error()})
		}
		if err.Error() == "join request not found" {
			return c.JSON(http.StatusNotFound, map[string]string{"error": "join request not found"})
		}
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to respond to join request"})
	}

	return c.JSON(http.StatusOK, map[string]string{"message": "join request processed successfully"})
}

func (h *GroupHandler) GetChannelEvents(c echo.Context) error {
	user := c.Get("user").(*middleware.AuthenticatedUser)
	channelID := c.Param("channelId")

	events, err := h.groupService.GetChannelEvents(channelID, user.UserID)
	if err != nil {
		if err.Error() == "access denied" {
			return c.JSON(http.StatusForbidden, map[string]string{"error": "access denied"})
		}
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusOK, events)
}

func (h *GroupHandler) CreateChannelEvent(c echo.Context) error {
	user := c.Get("user").(*middleware.AuthenticatedUser)
	channelID := c.Param("channelId")

	var dto models.CreateChannelEventDto
	if err := c.Bind(&dto); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request body"})
	}

	event, err := h.groupService.CreateChannelEvent(channelID, user.UserID, dto)
	if err != nil {
		switch err.Error() {
		case "access denied":
			return c.JSON(http.StatusForbidden, map[string]string{"error": err.Error()})
		case "voice room not found", "voice room does not belong to this channel", "events can only be scheduled in voice rooms":
			return c.JSON(http.StatusBadRequest, map[string]string{"error": err.Error()})
		default:
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
		}
	}

	h.socketIOService.BroadcastToRoom("group_"+event.GroupID, "eventCreated", event)
	h.socketIOService.BroadcastToRoom("channel_"+channelID, "eventCreated", event)

	return c.JSON(http.StatusCreated, event)
}

func (h *GroupHandler) GetGroupEvents(c echo.Context) error {
	user := c.Get("user").(*middleware.AuthenticatedUser)
	groupID := c.Param("groupId")

	events, err := h.groupService.GetGroupEvents(groupID, user.UserID)
	if err != nil {
		if err.Error() == "access denied" {
			return c.JSON(http.StatusForbidden, map[string]string{"error": "access denied"})
		}
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusOK, events)
}

func (h *GroupHandler) CreateGroupEvent(c echo.Context) error {
	user := c.Get("user").(*middleware.AuthenticatedUser)
	groupID := c.Param("groupId")

	var dto models.CreateVoiceEventDto
	if err := c.Bind(&dto); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request body"})
	}

	event, err := h.groupService.CreateGroupEvent(groupID, user.UserID, dto)
	if err != nil {
		switch err.Error() {
		case "access denied":
			return c.JSON(http.StatusForbidden, map[string]string{"error": err.Error()})
		case "events can only be scheduled in voice rooms":
			return c.JSON(http.StatusBadRequest, map[string]string{"error": err.Error()})
		default:
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
		}
	}

	channelID, _ := h.groupService.GetGroupChannelID(groupID)

	h.socketIOService.BroadcastToRoom("group_"+groupID, "eventCreated", event)
	if channelID != "" {
		h.socketIOService.BroadcastToRoom("channel_"+channelID, "eventCreated", event)
	}

	return c.JSON(http.StatusCreated, event)
}

func (h *GroupHandler) StartGroupEvent(c echo.Context) error {
	user := c.Get("user").(*middleware.AuthenticatedUser)
	groupID := c.Param("groupId")
	eventID := c.Param("eventId")

	event, err := h.groupService.StartGroupEvent(groupID, eventID, user.UserID)
	if err != nil {
		switch err.Error() {
		case "only channel owners and admins can start events":
			return c.JSON(http.StatusForbidden, map[string]string{"error": err.Error()})
		case "event not found", "group not found":
			return c.JSON(http.StatusNotFound, map[string]string{"error": err.Error()})
		default:
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
		}
	}

	channelID, _ := h.groupService.GetGroupChannelID(groupID)
	h.socketIOService.BroadcastToRoom("group_"+groupID, "eventStarted", event)
	if channelID != "" {
		h.socketIOService.BroadcastToRoom("channel_"+channelID, "eventStarted", event)
	}

	return c.JSON(http.StatusOK, event)
}

func (h *GroupHandler) DeleteGroupEvent(c echo.Context) error {
	user := c.Get("user").(*middleware.AuthenticatedUser)
	groupID := c.Param("groupId")
	eventID := c.Param("eventId")

	err := h.groupService.DeleteGroupEvent(groupID, eventID, user.UserID)
	if err != nil {
		if err.Error() == "insufficient permissions to delete events" {
			return c.JSON(http.StatusForbidden, map[string]string{"error": err.Error()})
		}
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	channelID, _ := h.groupService.GetGroupChannelID(groupID)

	h.socketIOService.BroadcastToRoom("group_"+groupID, "eventDeleted", map[string]string{"eventId": eventID})
	if channelID != "" {
		h.socketIOService.BroadcastToRoom("channel_"+channelID, "eventDeleted", map[string]string{"eventId": eventID})
	}

	return c.JSON(http.StatusOK, map[string]string{"message": "event deleted successfully"})
}

