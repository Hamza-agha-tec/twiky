package collaboration

import (
	"net/http"

	"github.com/Hamza-agha-tec/goback/models"
	"github.com/Hamza-agha-tec/goback/services"
	"github.com/labstack/echo/v4"
)

type CollaborationHandler struct {
	collaborationService *services.CollaborationService
}

func NewCollaborationHandler(collaborationService *services.CollaborationService) *CollaborationHandler {
	return &CollaborationHandler{
		collaborationService: collaborationService,
	}
}

// --- TASKS ---

func (h *CollaborationHandler) CreateTask(c echo.Context) error {
	userID := c.Get("userID").(string)

	var req models.CreateTaskRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request format"})
	}

	if req.Title == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "title is required"})
	}

	task, err := h.collaborationService.CreateTask(userID, req)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusCreated, task)
}

func (h *CollaborationHandler) GetTasks(c echo.Context) error {
	userID := c.Get("userID").(string)
	groupID := c.QueryParam("groupId")

	tasks, err := h.collaborationService.GetTasks(userID, groupID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusOK, tasks)
}

func (h *CollaborationHandler) UpdateTask(c echo.Context) error {
	userID := c.Get("userID").(string)
	taskID := c.Param("id")

	var req models.UpdateTaskRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request format"})
	}

	task, err := h.collaborationService.UpdateTask(userID, taskID, req)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusOK, task)
}

// --- NOTES ---

func (h *CollaborationHandler) CreateNote(c echo.Context) error {
	userID := c.Get("userID").(string)

	var req models.CreateNoteRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request format"})
	}

	if req.Title == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "title is required"})
	}

	note, err := h.collaborationService.CreateNote(userID, req)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusCreated, note)
}

func (h *CollaborationHandler) GetNotes(c echo.Context) error {
	userID := c.Get("userID").(string)
	groupID := c.QueryParam("groupId")

	notes, err := h.collaborationService.GetNotes(userID, groupID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusOK, notes)
}

func (h *CollaborationHandler) UpdateNote(c echo.Context) error {
	userID := c.Get("userID").(string)
	noteID := c.Param("id")

	var req models.UpdateNoteRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request format"})
	}

	note, err := h.collaborationService.UpdateNote(userID, noteID, req)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusOK, note)
}

// --- GOALS ---

func (h *CollaborationHandler) CreateGoal(c echo.Context) error {
	userID := c.Get("userID").(string)

	var req models.CreateGoalRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request format"})
	}

	if req.Title == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "title is required"})
	}

	goal, err := h.collaborationService.CreateGoal(userID, req)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusCreated, goal)
}

func (h *CollaborationHandler) GetGoals(c echo.Context) error {
	userID := c.Get("userID").(string)
	groupID := c.QueryParam("groupId")

	goals, err := h.collaborationService.GetGoals(userID, groupID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusOK, goals)
}

func (h *CollaborationHandler) UpdateGoal(c echo.Context) error {
	userID := c.Get("userID").(string)
	goalID := c.Param("id")

	var req models.UpdateGoalRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request format"})
	}

	goal, err := h.collaborationService.UpdateGoal(userID, goalID, req)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusOK, goal)
}

func (h *CollaborationHandler) GetMilestones(c echo.Context) error {
	userID := c.Get("userID").(string)
	goalID := c.Param("id")

	milestones, err := h.collaborationService.GetMilestones(userID, goalID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusOK, milestones)
}

func (h *CollaborationHandler) CreateMilestone(c echo.Context) error {
	userID := c.Get("userID").(string)
	goalID := c.Param("id")

	var req models.CreateMilestoneDto
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request format"})
	}

	milestone, err := h.collaborationService.CreateMilestone(userID, goalID, req)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusCreated, milestone)
}

func (h *CollaborationHandler) ToggleMilestone(c echo.Context) error {
	userID := c.Get("userID").(string)
	milestoneID := c.Param("milestoneId")

	var body struct {
		Completed bool `json:"completed"`
	}
	if err := c.Bind(&body); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request format"})
	}

	milestone, err := h.collaborationService.ToggleMilestone(userID, milestoneID, body.Completed)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusOK, milestone)
}

func (h *CollaborationHandler) GetGoalNotes(c echo.Context) error {
	userID := c.Get("userID").(string)
	goalID := c.Param("id")

	notes, err := h.collaborationService.GetGoalNotes(userID, goalID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusOK, notes)
}

func (h *CollaborationHandler) CreateGoalNote(c echo.Context) error {
	userID := c.Get("userID").(string)
	goalID := c.Param("id")

	var dto models.GoalNoteDto
	if err := c.Bind(&dto); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request format"})
	}

	note, err := h.collaborationService.CreateGoalNote(userID, goalID, dto)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusCreated, note)
}
