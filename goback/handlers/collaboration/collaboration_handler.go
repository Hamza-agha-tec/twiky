package collaboration

import (
	"net/http"

	"github.com/Hamza-agha-tec/goback/middleware"
	"github.com/Hamza-agha-tec/goback/models"
	"github.com/Hamza-agha-tec/goback/services"
	"github.com/labstack/echo/v4"
)

type CollaborationHandler struct {
	collaborationService *services.CollaborationService
	projectService       *services.ProjectService
}

func NewCollaborationHandler(collaborationService *services.CollaborationService, projectService *services.ProjectService) *CollaborationHandler {
	return &CollaborationHandler{
		collaborationService: collaborationService,
		projectService:       projectService,
	}
}

// --- TASKS ---

func (h *CollaborationHandler) CreateTask(c echo.Context) error {
	user := c.Get("user").(*middleware.AuthenticatedUser)

	var req models.CreateTaskRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request format"})
	}

	if req.Title == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "title is required"})
	}

	task, err := h.collaborationService.CreateTask(user.UserID, req)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusCreated, task)
}

func (h *CollaborationHandler) GetTasks(c echo.Context) error {
	user := c.Get("user").(*middleware.AuthenticatedUser)
	groupID := c.QueryParam("group_id")
	if groupID == "" {
		groupID = c.QueryParam("groupId")
	}
	projectID := c.QueryParam("project_id")
	if projectID == "" {
		projectID = c.QueryParam("projectId")
	}

	tasks, err := h.collaborationService.GetTasks(user.UserID, groupID, projectID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusOK, tasks)
}

func (h *CollaborationHandler) UpdateTask(c echo.Context) error {
	user := c.Get("user").(*middleware.AuthenticatedUser)
	taskID := c.Param("id")

	var req models.UpdateTaskRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request format"})
	}

	task, err := h.collaborationService.UpdateTask(user.UserID, taskID, req)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusOK, task)
}

func (h *CollaborationHandler) DeleteTask(c echo.Context) error {
	user := c.Get("user").(*middleware.AuthenticatedUser)
	taskID := c.Param("id")

	err := h.collaborationService.DeleteTask(user.UserID, taskID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusOK, map[string]string{"message": "task deleted"})
}

// --- SUBTASKS ---

func (h *CollaborationHandler) CreateSubtask(c echo.Context) error {
	var req models.CreateSubtaskRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request format"})
	}

	subtask, err := h.collaborationService.CreateSubtask(req)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusCreated, subtask)
}

func (h *CollaborationHandler) UpdateSubtask(c echo.Context) error {
	id := c.Param("id")
	var req models.UpdateSubtaskRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request format"})
	}

	subtask, err := h.collaborationService.UpdateSubtask(id, req)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusOK, subtask)
}

func (h *CollaborationHandler) GetSubtasks(c echo.Context) error {
	taskID := c.QueryParam("task_id")
	if taskID == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "task_id is required"})
	}

	subtasks, err := h.collaborationService.GetSubtasks(taskID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusOK, subtasks)
}

// --- TASK COMMENTS ---

func (h *CollaborationHandler) CreateTaskComment(c echo.Context) error {
	user := c.Get("user").(*middleware.AuthenticatedUser)
	var req models.CreateTaskCommentRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request format"})
	}

	comment, err := h.collaborationService.CreateTaskComment(user.UserID, req)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusCreated, comment)
}

func (h *CollaborationHandler) GetTaskComments(c echo.Context) error {
	taskID := c.QueryParam("task_id")
	if taskID == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "task_id is required"})
	}

	comments, err := h.collaborationService.GetTaskComments(taskID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusOK, comments)
}

func (h *CollaborationHandler) UpdateTaskComment(c echo.Context) error {
	user := c.Get("user").(*middleware.AuthenticatedUser)
	id := c.Param("id")
	var req models.UpdateTaskCommentRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request format"})
	}

	comment, err := h.collaborationService.UpdateTaskComment(user.UserID, id, req)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusOK, comment)
}

func (h *CollaborationHandler) DeleteTaskComment(c echo.Context) error {
	user := c.Get("user").(*middleware.AuthenticatedUser)
	id := c.Param("id")

	err := h.collaborationService.DeleteTaskComment(user.UserID, id)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusOK, map[string]string{"message": "comment deleted"})
}

// --- NOTES ---

func (h *CollaborationHandler) CreateNote(c echo.Context) error {
	user := c.Get("user").(*middleware.AuthenticatedUser)

	var req models.CreateNoteRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request format"})
	}

	if req.Title == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "title is required"})
	}

	note, err := h.collaborationService.CreateNote(user.UserID, req)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusCreated, note)
}

func (h *CollaborationHandler) DeleteGoalNote(c echo.Context) error {
	user := c.Get("user").(*middleware.AuthenticatedUser)
	goalID := c.Param("id")
	noteID := c.Param("noteId")

	err := h.collaborationService.DeleteGoalNote(user.UserID, goalID, noteID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusOK, map[string]string{"message": "note deleted"})
}

func (h *CollaborationHandler) GetNotes(c echo.Context) error {
	user := c.Get("user").(*middleware.AuthenticatedUser)
	groupID := c.QueryParam("group_id")
	if groupID == "" {
		groupID = c.QueryParam("groupId")
	}
	projectID := c.QueryParam("project_id")
	if projectID == "" {
		projectID = c.QueryParam("projectId")
	}

	notes, err := h.collaborationService.GetNotes(user.UserID, groupID, projectID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusOK, notes)
}

func (h *CollaborationHandler) UpdateNote(c echo.Context) error {
	user := c.Get("user").(*middleware.AuthenticatedUser)
	noteID := c.Param("id")

	var req models.UpdateNoteRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request format"})
	}

	note, err := h.collaborationService.UpdateNote(user.UserID, noteID, req)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusOK, note)
}

func (h *CollaborationHandler) DeleteNote(c echo.Context) error {
	user := c.Get("user").(*middleware.AuthenticatedUser)
	noteID := c.Param("id")

	err := h.collaborationService.DeleteNote(user.UserID, noteID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusOK, map[string]string{"message": "note deleted"})
}

// --- GOALS ---

func (h *CollaborationHandler) CreateGoal(c echo.Context) error {
	user := c.Get("user").(*middleware.AuthenticatedUser)

	var req models.CreateGoalRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request format"})
	}

	if req.Title == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "title is required"})
	}

	goal, err := h.collaborationService.CreateGoal(user.UserID, req)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusCreated, goal)
}

func (h *CollaborationHandler) GetGoals(c echo.Context) error {
	user := c.Get("user").(*middleware.AuthenticatedUser)
	groupID := c.QueryParam("group_id")
	if groupID == "" {
		groupID = c.QueryParam("groupId")
	}
	projectID := c.QueryParam("project_id")
	if projectID == "" {
		projectID = c.QueryParam("projectId")
	}

	goals, err := h.collaborationService.GetGoals(user.UserID, groupID, projectID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusOK, goals)
}

func (h *CollaborationHandler) UpdateGoal(c echo.Context) error {
	user := c.Get("user").(*middleware.AuthenticatedUser)
	goalID := c.Param("id")

	var req models.UpdateGoalRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request format"})
	}

	goal, err := h.collaborationService.UpdateGoal(user.UserID, goalID, req)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusOK, goal)
}

func (h *CollaborationHandler) DeleteGoal(c echo.Context) error {
	user := c.Get("user").(*middleware.AuthenticatedUser)
	goalID := c.Param("id")

	err := h.collaborationService.DeleteGoal(user.UserID, goalID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusOK, map[string]string{"message": "goal deleted"})
}

func (h *CollaborationHandler) GetMilestones(c echo.Context) error {
	user := c.Get("user").(*middleware.AuthenticatedUser)
	goalID := c.Param("id")

	milestones, err := h.collaborationService.GetMilestones(user.UserID, goalID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusOK, milestones)
}

func (h *CollaborationHandler) CreateMilestone(c echo.Context) error {
	user := c.Get("user").(*middleware.AuthenticatedUser)
	goalID := c.Param("id")

	var req models.CreateMilestoneDto
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request format"})
	}

	milestone, err := h.collaborationService.CreateMilestone(user.UserID, goalID, req)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusCreated, milestone)
}

func (h *CollaborationHandler) ToggleMilestone(c echo.Context) error {
	user := c.Get("user").(*middleware.AuthenticatedUser)
	milestoneID := c.Param("milestoneId")

	var body struct {
		Completed bool `json:"completed"`
	}
	if err := c.Bind(&body); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request format"})
	}

	milestone, err := h.collaborationService.ToggleMilestone(user.UserID, milestoneID, body.Completed)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusOK, milestone)
}

// --- WHITEBOARDS ---

func (h *CollaborationHandler) GetWhiteboards(c echo.Context) error {
	user := c.Get("user").(*middleware.AuthenticatedUser)
	projectID := c.QueryParam("project_id")
	if projectID == "" {
		projectID = c.QueryParam("projectId")
	}

	boards, err := h.projectService.ListWhiteboards(projectID, user.UserID)
	if err != nil {
		return c.JSON(http.StatusForbidden, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusOK, boards)
}

func (h *CollaborationHandler) GetWhiteboard(c echo.Context) error {
	user := c.Get("user").(*middleware.AuthenticatedUser)
	boardID := c.Param("id")

	var projectID string
	err := h.collaborationService.GetDB().QueryRow("SELECT project_id FROM whiteboards WHERE id = $1", boardID).Scan(&projectID)
	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "whiteboard not found"})
	}

	board, err := h.projectService.GetWhiteboard(projectID, boardID, user.UserID)
	if err != nil {
		return c.JSON(http.StatusForbidden, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusOK, board)
}

func (h *CollaborationHandler) CreateWhiteboard(c echo.Context) error {
	user := c.Get("user").(*middleware.AuthenticatedUser)

	var dto models.CreateWhiteboardDto
	if err := c.Bind(&dto); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request body"})
	}

	projectID := dto.ProjectID
	if projectID == "" {
		projectID = c.QueryParam("project_id")
	}
	if projectID == "" {
		projectID = c.QueryParam("projectId")
	}

	if projectID == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "project_id is required"})
	}

	board, err := h.projectService.CreateWhiteboard(projectID, user.UserID, dto)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusCreated, board)
}

func (h *CollaborationHandler) UpdateWhiteboard(c echo.Context) error {
	user := c.Get("user").(*middleware.AuthenticatedUser)
	boardID := c.Param("id")

	var dto models.UpdateWhiteboardDto
	if err := c.Bind(&dto); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request body"})
	}

	projectID := dto.ProjectID
	if projectID == "" {
		projectID = c.QueryParam("project_id")
	}
	if projectID == "" {
		projectID = c.QueryParam("projectId")
	}

	// If projectID is still empty, we need to fetch it from the database
	if projectID == "" {
		var pID string
		err := h.collaborationService.GetDB().QueryRow("SELECT project_id FROM whiteboards WHERE id = $1", boardID).Scan(&pID)
		if err != nil {
			return c.JSON(http.StatusNotFound, map[string]string{"error": "whiteboard not found"})
		}
		projectID = pID
	}

	board, err := h.projectService.UpdateWhiteboard(projectID, boardID, user.UserID, dto)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusOK, board)
}

func (h *CollaborationHandler) DeleteWhiteboard(c echo.Context) error {
	user := c.Get("user").(*middleware.AuthenticatedUser)
	boardID := c.Param("id")
	projectID := c.QueryParam("project_id")
	if projectID == "" {
		projectID = c.QueryParam("projectId")
	}

	// If projectID is still empty, we need to fetch it from the database
	if projectID == "" {
		var pID string
		err := h.collaborationService.GetDB().QueryRow("SELECT project_id FROM whiteboards WHERE id = $1", boardID).Scan(&pID)
		if err != nil {
			return c.JSON(http.StatusNotFound, map[string]string{"error": "whiteboard not found"})
		}
		projectID = pID
	}

	if err := h.projectService.DeleteWhiteboard(projectID, boardID, user.UserID); err != nil {
		return c.JSON(http.StatusForbidden, map[string]string{"error": err.Error()})
	}
	return c.NoContent(http.StatusNoContent)
}

func (h *CollaborationHandler) GetGoalNotes(c echo.Context) error {
	user := c.Get("user").(*middleware.AuthenticatedUser)
	goalID := c.Param("id")

	notes, err := h.collaborationService.GetGoalNotes(user.UserID, goalID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusOK, notes)
}

func (h *CollaborationHandler) CreateGoalNote(c echo.Context) error {
	user := c.Get("user").(*middleware.AuthenticatedUser)
	goalID := c.Param("id")

	var dto models.GoalNoteDto
	if err := c.Bind(&dto); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request format"})
	}

	note, err := h.collaborationService.CreateGoalNote(user.UserID, goalID, dto)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusCreated, note)
}
