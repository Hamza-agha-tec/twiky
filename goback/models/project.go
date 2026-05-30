package models

import "time"

type WorkspaceProject struct {
	ID          string    `json:"id" db:"id"`
	ChannelID   string    `json:"channel_id" db:"channel_id"`
	Name        string    `json:"name" db:"name"`
	Description *string   `json:"description" db:"description"`
	AccessType  string    `json:"access_type" db:"access_type"`
	OwnerID     string    `json:"owner_id" db:"owner_id"`
	CreatedAt   time.Time `json:"created_at" db:"created_at"`
	UpdatedAt   time.Time `json:"updated_at" db:"updated_at"`
	Role        string    `json:"role,omitempty"`
}

type ProjectMember struct {
	ProjectID string    `json:"project_id" db:"project_id"`
	UserID    string    `json:"user_id" db:"user_id"`
	Role      string    `json:"role" db:"role"`
	JoinedAt  time.Time `json:"joined_at" db:"joined_at"`
}

type ProjectJoinRequest struct {
	ID        string    `json:"id" db:"id"`
	ProjectID string    `json:"project_id" db:"project_id"`
	UserID    string    `json:"user_id" db:"user_id"`
	Status    string    `json:"status" db:"status"`
	Message   string    `json:"message" db:"message"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
	UpdatedAt time.Time `json:"updated_at" db:"updated_at"`
}

type ProjectJoinRequestWithUser struct {
	ID        string          `json:"id"`
	Status    string          `json:"status"`
	CreatedAt time.Time       `json:"created_at"`
	User      JoinRequestUser `json:"user"`
}

type CreateProjectDto struct {
	Name        string `json:"name" validate:"required,min=1,max=100"`
	Description string `json:"description" validate:"max=500"`
	AccessType  string `json:"access_type" validate:"oneof=PUBLIC PRIVATE"`
}

type UpdateProjectDto struct {
	Name        string `json:"name" validate:"min=1,max=100"`
	Description string `json:"description" validate:"max=500"`
	AccessType  string `json:"access_type" validate:"oneof=PUBLIC PRIVATE"`
}

type Whiteboard struct {
	ID        string                 `json:"id" db:"id"`
	ProjectID string                 `json:"project_id" db:"project_id"`
	Title     string                 `json:"title" db:"title"`
	Data      map[string]interface{} `json:"data" db:"data"`
	CreatedBy string                 `json:"created_by" db:"created_by"`
	CreatedAt time.Time              `json:"created_at" db:"created_at"`
	UpdatedAt time.Time              `json:"updated_at" db:"updated_at"`
}

type CreateWhiteboardDto struct {
	Title     string                 `json:"title"`
	ProjectID string                 `json:"project_id"`
	Data      map[string]interface{} `json:"data"`
}

type UpdateWhiteboardDto struct {
	Title     string                 `json:"title"`
	ProjectID string                 `json:"project_id"`
	Data      map[string]interface{} `json:"data"`
}
