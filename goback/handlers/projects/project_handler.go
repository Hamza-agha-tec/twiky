package projects

import (
	"net/http"

	"github.com/Hamza-agha-tec/goback/middleware"
	"github.com/Hamza-agha-tec/goback/models"
	"github.com/Hamza-agha-tec/goback/services"
	"github.com/labstack/echo/v4"
)

type ProjectHandler struct {
	projectService *services.ProjectService
	groupService   *services.GroupService
}

func NewProjectHandler(projectService *services.ProjectService, groupService *services.GroupService) *ProjectHandler {
	return &ProjectHandler{
		projectService: projectService,
		groupService:   groupService,
	}
}

func (h *ProjectHandler) ListProjects(c echo.Context) error {
	user := c.Get("user").(*middleware.AuthenticatedUser)
	channelID := c.Param("channelId")

	projects, err := h.projectService.GetProjectsByChannel(channelID, user.UserID)
	if err != nil {
		return c.JSON(http.StatusForbidden, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusOK, projects)
}

func (h *ProjectHandler) CreateProject(c echo.Context) error {
	user := c.Get("user").(*middleware.AuthenticatedUser)
	channelID := c.Param("channelId")

	var dto models.CreateProjectDto
	if err := c.Bind(&dto); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request body"})
	}
	if dto.Name == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "name is required"})
	}

	project, err := h.projectService.CreateProject(channelID, user.UserID, dto)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusCreated, project)
}

func (h *ProjectHandler) GetProject(c echo.Context) error {
	user := c.Get("user").(*middleware.AuthenticatedUser)
	projectID := c.Param("projectId")

	project, err := h.projectService.GetProject(projectID, user.UserID)
	if err != nil {
		return c.JSON(http.StatusForbidden, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusOK, project)
}

func (h *ProjectHandler) GetProjectGroups(c echo.Context) error {
	user := c.Get("user").(*middleware.AuthenticatedUser)
	projectID := c.Param("projectId")

	groups, err := h.projectService.GetGroupsInProject(projectID, user.UserID)
	if err != nil {
		return c.JSON(http.StatusForbidden, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusOK, groups)
}

func (h *ProjectHandler) CreateProjectGroup(c echo.Context) error {
	user := c.Get("user").(*middleware.AuthenticatedUser)
	channelID := c.Param("channelId")
	projectID := c.Param("projectId")

	var dto models.CreateGroupDto
	if err := c.Bind(&dto); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request body"})
	}

	group, err := h.groupService.CreateGroupInProject(channelID, projectID, user.UserID, dto)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusCreated, group)
}

func (h *ProjectHandler) UpdateProject(c echo.Context) error {
	user := c.Get("user").(*middleware.AuthenticatedUser)
	projectID := c.Param("projectId")

	var dto models.UpdateProjectDto
	if err := c.Bind(&dto); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request body"})
	}

	project, err := h.projectService.UpdateProject(projectID, user.UserID, dto)
	if err != nil {
		return c.JSON(http.StatusForbidden, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusOK, project)
}

func (h *ProjectHandler) DeleteProject(c echo.Context) error {
	user := c.Get("user").(*middleware.AuthenticatedUser)
	projectID := c.Param("projectId")

	if err := h.projectService.DeleteProject(projectID, user.UserID); err != nil {
		return c.JSON(http.StatusForbidden, map[string]string{"error": err.Error()})
	}
	return c.NoContent(http.StatusNoContent)
}

func (h *ProjectHandler) RequestJoinProject(c echo.Context) error {
	user := c.Get("user").(*middleware.AuthenticatedUser)
	projectID := c.Param("projectId")

	if err := h.projectService.RequestJoinProject(user.UserID, projectID); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]string{"message": "Join request sent"})
}

func (h *ProjectHandler) JoinProject(c echo.Context) error {
	user := c.Get("user").(*middleware.AuthenticatedUser)
	projectID := c.Param("projectId")

	if err := h.projectService.JoinProject(user.UserID, projectID); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]string{"message": "Joined project successfully"})
}

func (h *ProjectHandler) GetProjectJoinRequests(c echo.Context) error {
	user := c.Get("user").(*middleware.AuthenticatedUser)
	projectID := c.Param("projectId")

	requests, err := h.projectService.GetProjectJoinRequests(projectID, user.UserID)
	if err != nil {
		return c.JSON(http.StatusForbidden, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusOK, requests)
}

func (h *ProjectHandler) HandleJoinRequest(c echo.Context) error {
	user := c.Get("user").(*middleware.AuthenticatedUser)
	requestID := c.Param("requestId")
	action := c.QueryParam("action") // ACCEPT or REJECT

	if action != "ACCEPT" && action != "REJECT" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "action must be ACCEPT or REJECT"})
	}

	if err := h.projectService.HandleJoinRequest(requestID, user.UserID, action); err != nil {
		return c.JSON(http.StatusForbidden, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]string{"message": "Request handled successfully"})
}

func (h *ProjectHandler) GetProjectMembers(c echo.Context) error {
	user := c.Get("user").(*middleware.AuthenticatedUser)
	projectID := c.Param("projectId")

	members, err := h.projectService.GetProjectMembers(projectID, user.UserID)
	if err != nil {
		return c.JSON(http.StatusForbidden, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusOK, members)
}

func (h *ProjectHandler) AddProjectMember(c echo.Context) error {
	user := c.Get("user").(*middleware.AuthenticatedUser)
	projectID := c.Param("projectId")

	var req struct {
		UserID string `json:"user_id"`
		Role   string `json:"role"`
	}
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request body"})
	}

	if err := h.projectService.AddProjectMember(projectID, user.UserID, req.UserID, req.Role); err != nil {
		return c.JSON(http.StatusForbidden, map[string]string{"error": err.Error()})
	}
	return c.NoContent(http.StatusOK)
}

func (h *ProjectHandler) RemoveProjectMember(c echo.Context) error {
	user := c.Get("user").(*middleware.AuthenticatedUser)
	projectID := c.Param("projectId")
	targetUserID := c.Param("userId")

	if err := h.projectService.RemoveProjectMember(projectID, user.UserID, targetUserID); err != nil {
		return c.JSON(http.StatusForbidden, map[string]string{"error": err.Error()})
	}
	return c.NoContent(http.StatusNoContent)
}


