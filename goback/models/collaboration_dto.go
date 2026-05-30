package models

import (
	"time"
)

type CreateTaskRequest struct {
	Title       string                   `json:"title" validate:"required"`
	Description string                   `json:"description"`
	Status      string                   `json:"status"`
	ProjectID   string                   `json:"project_id"`
	GroupID     string                   `json:"group_id"`
	AssigneeID  string                   `json:"assignee_id"`
	DueDate     string                   `json:"due_date"`
	Priority    string                   `json:"priority"`
	Tags        []string                 `json:"tags"`
	Attachments []map[string]interface{} `json:"attachments"`
}

type UpdateTaskRequest struct {
	Title       string                   `json:"title"`
	Description string                   `json:"description"`
	Status      string                   `json:"status"`
	AssigneeID  string                   `json:"assignee_id"`
	DueDate     string                   `json:"due_date"`
	Priority    string                   `json:"priority"`
	Tags        []string                 `json:"tags"`
	Attachments []map[string]interface{} `json:"attachments"`
}

type CreateNoteRequest struct {
	Title     string   `json:"title" validate:"required"`
	Content   string   `json:"content"`
	ProjectID string   `json:"project_id"`
	GroupID   string   `json:"group_id"`
	Tags      []string `json:"tags"`
	Color     string   `json:"color"`
}

type UpdateNoteRequest struct {
	Title    string   `json:"title"`
	Content  string   `json:"content"`
	Tags     []string `json:"tags"`
	Color    string   `json:"color"`
	IsPinned *bool    `json:"is_pinned"`
}

type CreateGoalRequest struct {
	Title       string `json:"title" validate:"required"`
	Description string `json:"description"`
	ProjectID   string `json:"project_id"`
	GroupID     string `json:"group_id"`
	Category    string `json:"category"`
	TargetDate  string `json:"target_date"`
	Priority    string `json:"priority"`
}

type UpdateGoalRequest struct {
	Title      string                   `json:"title"`
	Progress   *float64                 `json:"progress"`
	Status     string                   `json:"status"`
	Milestones []map[string]interface{} `json:"milestones"`
}

type CreateMilestoneDto struct {
	Title       string `json:"title"`
	Description string `json:"description"`
	DueDate     string `json:"dueDate"`
}

type GoalNoteDto struct {
	Title         string `json:"title"`
	Content       string `json:"content"`
	ProgressPoint int    `json:"progress_point"`
	Milestone     string `json:"milestone"`
	Color         string `json:"color"`
}

type Milestone struct {
	ID          string    `json:"id"`
	GoalID      string    `json:"goal_id"`
	Title       string    `json:"title"`
	Description string    `json:"description"`
	Completed   bool      `json:"completed"`
	DueDate     string    `json:"due_date"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type CreateSubtaskRequest struct {
	Title       string `json:"title" validate:"required"`
	TaskID      string `json:"task_id" validate:"required"`
	IsCompleted bool   `json:"is_completed"`
}

type UpdateSubtaskRequest struct {
	Title       string `json:"title"`
	IsCompleted bool   `json:"is_completed"`
}

type CreateTaskCommentRequest struct {
	TaskID   string `json:"task_id" validate:"required"`
	Content  string `json:"content" validate:"required"`
	ParentID string `json:"parent_id"`
}

type UpdateTaskCommentRequest struct {
	Content   string                   `json:"content"`
	Reactions []map[string]interface{} `json:"reactions"`
}
