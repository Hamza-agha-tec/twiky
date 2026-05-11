package models

import (
	"time"
)

type Task struct {
	ID          string                 `json:"id" db:"id"`
	Title       string                 `json:"title" db:"title"`
	Description string                 `json:"description,omitempty" db:"description"`
	CreatorID   string                 `json:"creator_id" db:"creator_id"`
	AssigneeID  string                 `json:"assignee_id,omitempty" db:"assignee_id"`
	GroupID     string                 `json:"group_id,omitempty" db:"group_id"`
	Status      string                 `json:"status" db:"status"`
	Priority    string                 `json:"priority,omitempty" db:"priority"`
	DueDate     *time.Time             `json:"due_date,omitempty" db:"due_date"`
	Tags        []string               `json:"tags,omitempty" db:"tags"`
	Attachments []map[string]interface{} `json:"attachments,omitempty" db:"attachments"`
	CreatedAt   time.Time              `json:"created_at" db:"created_at"`
	UpdatedAt   time.Time              `json:"updated_at" db:"updated_at"`
}

type Note struct {
	ID        string    `json:"id" db:"id"`
	Title     string    `json:"title" db:"title"`
	Content   string    `json:"content,omitempty" db:"content"`
	CreatorID string    `json:"creator_id" db:"creator_id"`
	GroupID   string    `json:"group_id,omitempty" db:"group_id"`
	Color     string    `json:"color,omitempty" db:"color"`
	Tags      []string  `json:"tags,omitempty" db:"tags"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
	UpdatedAt time.Time `json:"updated_at" db:"updated_at"`
}

type Goal struct {
	ID          string                 `json:"id" db:"id"`
	Title       string                 `json:"title" db:"title"`
	Description string                 `json:"description,omitempty" db:"description"`
	CreatorID   string                 `json:"creator_id" db:"creator_id"`
	GroupID     string                 `json:"group_id,omitempty" db:"group_id"`
	Category    string                 `json:"category,omitempty" db:"category"`
	Status      string                 `json:"status" db:"status"`
	Priority    string                 `json:"priority,omitempty" db:"priority"`
	Progress    float64                `json:"progress" db:"progress"`
	TargetDate  *time.Time             `json:"target_date,omitempty" db:"target_date"`
	Milestones  []map[string]interface{} `json:"milestones,omitempty" db:"milestones"`
	CreatedAt   time.Time              `json:"created_at" db:"created_at"`
	UpdatedAt   time.Time              `json:"updated_at" db:"updated_at"`
}
