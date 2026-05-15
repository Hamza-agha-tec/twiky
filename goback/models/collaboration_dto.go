package models

import (
	"time"
)

type CreateTaskRequest struct {
	Title       string                   `json:"title" validate:"required"`
	Description string                   `json:"description"`
	GroupID     string                   `json:"groupId"`
	AssigneeID  string                   `json:"assigneeId"`
	DueDate     string                   `json:"dueDate"`
	Priority    string                   `json:"priority"`
	Tags        []string                 `json:"tags"`
	Attachments []map[string]interface{} `json:"attachments"`
}

type UpdateTaskRequest struct {
	Title       string                   `json:"title"`
	Description string                   `json:"description"`
	Status      string                   `json:"status"`
	AssigneeID  string                   `json:"assigneeId"`
	DueDate     string                   `json:"dueDate"`
	Priority    string                   `json:"priority"`
	Tags        []string                 `json:"tags"`
	Attachments []map[string]interface{} `json:"attachments"`
}

type CreateNoteRequest struct {
	Title   string   `json:"title" validate:"required"`
	Content string   `json:"content"`
	GroupID string   `json:"groupId"`
	Tags    []string `json:"tags"`
	Color   string   `json:"color"`
}

type UpdateNoteRequest struct {
	Title   string   `json:"title"`
	Content string   `json:"content"`
	Tags    []string `json:"tags"`
	Color   string   `json:"color"`
}

type CreateGoalRequest struct {
	Title       string `json:"title" validate:"required"`
	Description string `json:"description"`
	GroupID     string `json:"groupId"`
	Category    string `json:"category"`
	TargetDate  string `json:"targetDate"`
	Priority    string `json:"priority"`
}

type UpdateGoalRequest struct {
	Title      string                   `json:"title"`
	Progress   float64                  `json:"progress"`
	Status     string                   `json:"status"`
	Milestones []map[string]interface{} `json:"milestones"`
}

type CreateMilestoneDto struct {
	Title       string `json:"title"`
	Description string `json:"description"`
	DueDate     string `json:"dueDate"`
}

type GoalNoteDto struct {
	Content string `json:"content"`
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
