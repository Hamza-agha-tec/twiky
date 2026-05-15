package models

import (
	"time"
)

type Task struct {
	ID          string                   `json:"id" db:"id"`
	GroupID     *string                  `json:"group_id" db:"group_id"`
	CreatorID   string                   `json:"creator_id" db:"creator_id"`
	AssigneeID  *string                  `json:"assignee_id" db:"assignee_id"`
	Title       string                   `json:"title" db:"title"`
	Description *string                  `json:"description" db:"description"`
	Status      string                   `json:"status" db:"status"`
	DueDate     *time.Time               `json:"due_date" db:"due_date"`
	CreatedAt   time.Time                `json:"created_at" db:"created_at"`
	Priority    string                   `json:"priority" db:"priority"`
	Tags        []string                 `json:"tags" db:"tags"`
	Attachments []map[string]interface{} `json:"attachments" db:"attachments"`
}

type Note struct {
	ID        string    `json:"id" db:"id"`
	GroupID   *string   `json:"group_id" db:"group_id"`
	AuthorID  string    `json:"author_id" db:"author_id"`
	Title     string    `json:"title" db:"title"`
	Content   *string   `json:"content" db:"content"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
	Tags      []string  `json:"tags" db:"tags"`
	Color     *string   `json:"color" db:"color"`
}

type Goal struct {
	ID          string                   `json:"id" db:"id"`
	UserID      *string                  `json:"user_id" db:"user_id"`
	GroupID     *string                  `json:"group_id" db:"group_id"`
	Title       string                   `json:"title" db:"title"`
	Description *string                  `json:"description" db:"description"`
	Category    string                   `json:"category" db:"category"`
	Status      string                   `json:"status" db:"status"`
	Priority    string                   `json:"priority" db:"priority"`
	TargetDate  *time.Time               `json:"target_date" db:"target_date"`
	Progress    int                      `json:"progress" db:"progress"`
	Milestones  []map[string]interface{} `json:"milestones" db:"milestones"`
	CreatedAt   time.Time                `json:"created_at" db:"created_at"`
	UpdatedAt   time.Time                `json:"updated_at" db:"updated_at"`
}

type GoalNote struct {
	ID            string    `json:"id" db:"id"`
	UserID        *string   `json:"user_id" db:"user_id"`
	GoalID        string    `json:"goal_id" db:"goal_id"`
	ProgressPoint *int      `json:"progress_point" db:"progress_point"`
	Title         string    `json:"title" db:"title"`
	Content       string    `json:"content" db:"content"`
	Milestone     *string   `json:"milestone" db:"milestone"`
	CreatedAt     time.Time `json:"created_at" db:"created_at"`
	UpdatedAt     time.Time `json:"updated_at" db:"updated_at"`
	Color         *string   `json:"color" db:"color"`
	IsFavorite    bool      `json:"is_favorite" db:"is_favorite"`
}

type GoalSubMilestone struct {
	ID          string    `json:"id" db:"id"`
	CreatedAt   time.Time `json:"created_at" db:"created_at"`
	UserID      string    `json:"user_id" db:"user_id"`
	GoalID      string    `json:"goal_id" db:"goal_id"`
	MilestoneID string    `json:"milestone_id" db:"milestone_id"`
	Title       string    `json:"title" db:"title"`
	Completed   *bool     `json:"completed" db:"completed"`
}
