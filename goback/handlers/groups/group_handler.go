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
	groupService *services.GroupService
}

func NewGroupHandler(groupService *services.GroupService) *GroupHandler {
	return &GroupHandler{
		groupService: groupService,
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
