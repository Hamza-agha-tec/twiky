package services

import (
	"database/sql"
	"encoding/json"
	"fmt"

	"github.com/Hamza-agha-tec/goback/models"
)

type CollaborationService struct {
	db *sql.DB
}

func NewCollaborationService(db *sql.DB) *CollaborationService {
	return &CollaborationService{
		db: db,
	}
}

// --- TASKS ---

func (s *CollaborationService) CreateTask(userID string, req models.CreateTaskRequest) (*models.Task, error) {
	tagsJSON, _ := json.Marshal(req.Tags)
	attachmentsJSON, _ := json.Marshal(req.Attachments)

	query := `
		INSERT INTO tasks (id, title, description, creator_id, assignee_id, group_id, status, priority, due_date, tags, attachments, created_at, updated_at)
		VALUES (gen_random_uuid(), $1, $2, $3, NULLIF($4, ''), NULLIF($5, ''), 'TODO', $6, NULLIF($7, '')::timestamp, $8, $9, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
		RETURNING id, title, description, creator_id, assignee_id, group_id, status, priority, due_date, created_at, updated_at
	`

	task := &models.Task{}
	var tags []byte
	var attachments []byte

	err := s.db.QueryRow(query,
		req.Title, req.Description, userID, req.AssigneeID, req.GroupID, req.Priority, req.DueDate, tagsJSON, attachmentsJSON,
	).Scan(
		&task.ID, &task.Title, &task.Description, &task.CreatorID, &task.AssigneeID, &task.GroupID, &task.Status, &task.Priority, &task.DueDate, &task.CreatedAt, &task.UpdatedAt,
	)

	if err != nil {
		return nil, fmt.Errorf("failed to create task: %w", err)
	}

	// Fetch back JSON fields
	err = s.db.QueryRow("SELECT tags, attachments FROM tasks WHERE id = $1", task.ID).Scan(&tags, &attachments)
	if err == nil {
		json.Unmarshal(tags, &task.Tags)
		json.Unmarshal(attachments, &task.Attachments)
	}

	return task, nil
}

func (s *CollaborationService) GetTasks(userID string, groupID string) ([]*models.Task, error) {
	query := `
		SELECT id, title, description, creator_id, assignee_id, group_id, status, priority, due_date, tags, attachments, created_at, updated_at
		FROM tasks
		WHERE ($2 = '' OR group_id = $2)
		ORDER BY created_at DESC
	`

	rows, err := s.db.Query(query, userID, groupID)
	if err != nil {
		return nil, fmt.Errorf("failed to query tasks: %w", err)
	}
	defer rows.Close()

	var tasks []*models.Task
	for rows.Next() {
		task := &models.Task{}
		var tags []byte
		var attachments []byte
		err := rows.Scan(
			&task.ID, &task.Title, &task.Description, &task.CreatorID, &task.AssigneeID, &task.GroupID, &task.Status, &task.Priority, &task.DueDate, &tags, &attachments, &task.CreatedAt, &task.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan task: %w", err)
		}
		json.Unmarshal(tags, &task.Tags)
		json.Unmarshal(attachments, &task.Attachments)
		tasks = append(tasks, task)
	}

	return tasks, nil
}

func (s *CollaborationService) UpdateTask(userID string, taskID string, req models.UpdateTaskRequest) (*models.Task, error) {
	query := `
		UPDATE tasks
		SET title = COALESCE($1, title),
			description = COALESCE($2, description),
			assignee_id = COALESCE(NULLIF($3, ''), assignee_id),
			status = COALESCE($4, status),
			priority = COALESCE($5, priority),
			due_date = COALESCE($6::timestamp, due_date),
			updated_at = CURRENT_TIMESTAMP
		WHERE id = $7 AND creator_id = $8
		RETURNING id, title, description, creator_id, assignee_id, group_id, status, priority, due_date, created_at, updated_at
	`

	task := &models.Task{}
	err := s.db.QueryRow(query,
		req.Title, req.Description, req.AssigneeID, req.Status, req.Priority, req.DueDate, taskID, userID,
	).Scan(
		&task.ID, &task.Title, &task.Description, &task.CreatorID, &task.AssigneeID, &task.GroupID, &task.Status, &task.Priority, &task.DueDate, &task.CreatedAt, &task.UpdatedAt,
	)

	if err != nil {
		return nil, fmt.Errorf("failed to update task: %w", err)
	}

	// Fetch JSON fields
	var tags []byte
	var attachments []byte
	s.db.QueryRow("SELECT tags, attachments FROM tasks WHERE id = $1", taskID).Scan(&tags, &attachments)
	if tags != nil {
		json.Unmarshal(tags, &task.Tags)
	}
	if attachments != nil {
		json.Unmarshal(attachments, &task.Attachments)
	}

	return task, nil
}

// --- NOTES ---

func (s *CollaborationService) CreateNote(userID string, req models.CreateNoteRequest) (*models.Note, error) {
	tagsJSON, _ := json.Marshal(req.Tags)

	query := `
		INSERT INTO notes (id, title, content, creator_id, group_id, color, tags, created_at, updated_at)
		VALUES (gen_random_uuid(), $1, $2, $3, NULLIF($4, ''), $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
		RETURNING id, title, content, creator_id, group_id, color, created_at, updated_at
	`

	note := &models.Note{}
	var tags []byte

	err := s.db.QueryRow(query,
		req.Title, req.Content, userID, req.GroupID, req.Color, tagsJSON,
	).Scan(
		&note.ID, &note.Title, &note.Content, &note.CreatorID, &note.GroupID, &note.Color, &note.CreatedAt, &note.UpdatedAt,
	)

	if err != nil {
		return nil, fmt.Errorf("failed to create note: %w", err)
	}

	err = s.db.QueryRow("SELECT tags FROM notes WHERE id = $1", note.ID).Scan(&tags)
	if err == nil {
		json.Unmarshal(tags, &note.Tags)
	}

	return note, nil
}

func (s *CollaborationService) GetNotes(userID string, groupID string) ([]*models.Note, error) {
	query := `
		SELECT id, title, content, creator_id, group_id, color, tags, created_at, updated_at
		FROM notes
		WHERE ($2 = '' OR group_id = $2)
		ORDER BY created_at DESC
	`

	rows, err := s.db.Query(query, userID, groupID)
	if err != nil {
		return nil, fmt.Errorf("failed to query notes: %w", err)
	}
	defer rows.Close()

	var notes []*models.Note
	for rows.Next() {
		note := &models.Note{}
		var tags []byte
		err := rows.Scan(
			&note.ID, &note.Title, &note.Content, &note.CreatorID, &note.GroupID, &note.Color, &tags, &note.CreatedAt, &note.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan note: %w", err)
		}
		json.Unmarshal(tags, &note.Tags)
		notes = append(notes, note)
	}

	return notes, nil
}

func (s *CollaborationService) UpdateNote(userID string, noteID string, req models.UpdateNoteRequest) (*models.Note, error) {
	query := `
		UPDATE notes
		SET title = COALESCE($1, title),
			content = COALESCE($2, content),
			color = COALESCE($3, color),
			updated_at = CURRENT_TIMESTAMP
		WHERE id = $4 AND creator_id = $5
		RETURNING id, title, content, creator_id, group_id, color, created_at, updated_at
	`

	note := &models.Note{}
	var tags []byte
	err := s.db.QueryRow(query,
		req.Title, req.Content, req.Color, noteID, userID,
	).Scan(
		&note.ID, &note.Title, &note.Content, &note.CreatorID, &note.GroupID, &note.Color, &note.CreatedAt, &note.UpdatedAt,
	)

	if err != nil {
		return nil, fmt.Errorf("failed to update note: %w", err)
	}

	// Fetch tags
	s.db.QueryRow("SELECT tags FROM notes WHERE id = $1", noteID).Scan(&tags)
	if tags != nil {
		json.Unmarshal(tags, &note.Tags)
	}

	return note, nil
}

// --- GOALS ---

func (s *CollaborationService) CreateGoal(userID string, req models.CreateGoalRequest) (*models.Goal, error) {
	query := `
		INSERT INTO goals (id, title, description, creator_id, group_id, category, status, priority, progress, target_date, created_at, updated_at)
		VALUES (gen_random_uuid(), $1, $2, $3, NULLIF($4, ''), $5, 'PENDING', $6, 0, NULLIF($7, '')::timestamp, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
		RETURNING id, title, description, creator_id, group_id, category, status, priority, progress, target_date, created_at, updated_at
	`

	goal := &models.Goal{}

	err := s.db.QueryRow(query,
		req.Title, req.Description, userID, req.GroupID, req.Category, req.Priority, req.TargetDate,
	).Scan(
		&goal.ID, &goal.Title, &goal.Description, &goal.CreatorID, &goal.GroupID, &goal.Category, &goal.Status, &goal.Priority, &goal.Progress, &goal.TargetDate, &goal.CreatedAt, &goal.UpdatedAt,
	)

	if err != nil {
		return nil, fmt.Errorf("failed to create goal: %w", err)
	}

	return goal, nil
}

func (s *CollaborationService) GetGoals(userID string, groupID string) ([]*models.Goal, error) {
	query := `
		SELECT id, title, description, creator_id, group_id, category, status, priority, progress, target_date, milestones, created_at, updated_at
		FROM goals
		WHERE ($2 = '' OR group_id = $2)
		ORDER BY created_at DESC
	`

	rows, err := s.db.Query(query, userID, groupID)
	if err != nil {
		return nil, fmt.Errorf("failed to query goals: %w", err)
	}
	defer rows.Close()

	var goals []*models.Goal
	for rows.Next() {
		goal := &models.Goal{}
		var milestones []byte
		err := rows.Scan(
			&goal.ID, &goal.Title, &goal.Description, &goal.CreatorID, &goal.GroupID, &goal.Category, &goal.Status, &goal.Priority, &goal.Progress, &goal.TargetDate, &milestones, &goal.CreatedAt, &goal.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan goal: %w", err)
		}
		if milestones != nil {
			json.Unmarshal(milestones, &goal.Milestones)
		}
		goals = append(goals, goal)
	}

	return goals, nil
}

func (s *CollaborationService) UpdateGoal(userID string, goalID string, req models.UpdateGoalRequest) (*models.Goal, error) {
	query := `
		UPDATE goals
		SET title = COALESCE($1, title),
			status = COALESCE($2, status),
			progress = COALESCE($3, progress),
			milestones = COALESCE($4, milestones),
			updated_at = CURRENT_TIMESTAMP
		WHERE id = $5 AND creator_id = $6
		RETURNING id, title, description, creator_id, group_id, category, status, priority, progress, target_date, created_at, updated_at
	`

	milestonesJSON, _ := json.Marshal(req.Milestones)
	goal := &models.Goal{}
	var milestones []byte
	err := s.db.QueryRow(query,
		req.Title, req.Status, req.Progress, milestonesJSON, goalID, userID,
	).Scan(
		&goal.ID, &goal.Title, &goal.Description, &goal.CreatorID, &goal.GroupID, &goal.Category, &goal.Status, &goal.Priority, &goal.Progress, &goal.TargetDate, &goal.CreatedAt, &goal.UpdatedAt,
	)

	if err != nil {
		return nil, fmt.Errorf("failed to update goal: %w", err)
	}

	// Fetch milestones
	s.db.QueryRow("SELECT milestones FROM goals WHERE id = $1", goalID).Scan(&milestones)
	if milestones != nil {
		json.Unmarshal(milestones, &goal.Milestones)
	}

	return goal, nil
}

func (s *CollaborationService) GetMilestones(userID string, goalID string) ([]*models.Milestone, error) {
	query := `
		SELECT id, goal_id, title, description, completed, due_date, created_at, updated_at
		FROM milestones
		WHERE goal_id = $1
		ORDER BY created_at ASC
	`

	rows, err := s.db.Query(query, goalID)
	if err != nil {
		return nil, fmt.Errorf("failed to query milestones: %w", err)
	}
	defer rows.Close()

	var milestones []*models.Milestone
	for rows.Next() {
		milestone := &models.Milestone{}
		err := rows.Scan(
			&milestone.ID, &milestone.GoalID, &milestone.Title, &milestone.Description, &milestone.Completed, &milestone.DueDate, &milestone.CreatedAt, &milestone.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan milestone: %w", err)
		}
		milestones = append(milestones, milestone)
	}

	return milestones, nil
}

func (s *CollaborationService) CreateMilestone(userID string, goalID string, dto models.CreateMilestoneDto) (*models.Milestone, error) {
	query := `
		INSERT INTO milestones (id, goal_id, title, description, completed, due_date, created_at, updated_at)
		VALUES (gen_random_uuid(), $1, $2, $3, false, $4::timestamp, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
		RETURNING id, goal_id, title, description, completed, due_date, created_at, updated_at
	`

	milestone := &models.Milestone{}
	err := s.db.QueryRow(query, goalID, dto.Title, dto.Description, dto.DueDate).Scan(
		&milestone.ID, &milestone.GoalID, &milestone.Title, &milestone.Description, &milestone.Completed, &milestone.DueDate, &milestone.CreatedAt, &milestone.UpdatedAt,
	)

	if err != nil {
		return nil, fmt.Errorf("failed to create milestone: %w", err)
	}

	return milestone, nil
}

func (s *CollaborationService) ToggleMilestone(userID string, milestoneID string, completed bool) (*models.Milestone, error) {
	query := `
		UPDATE milestones
		SET completed = $1, updated_at = CURRENT_TIMESTAMP
		WHERE id = $2
		RETURNING id, goal_id, title, description, completed, due_date, created_at, updated_at
	`

	milestone := &models.Milestone{}
	err := s.db.QueryRow(query, completed, milestoneID).Scan(
		&milestone.ID, &milestone.GoalID, &milestone.Title, &milestone.Description, &milestone.Completed, &milestone.DueDate, &milestone.CreatedAt, &milestone.UpdatedAt,
	)

	if err != nil {
		return nil, fmt.Errorf("failed to toggle milestone: %w", err)
	}

	return milestone, nil
}

func (s *CollaborationService) GetGoalNotes(userID string, goalID string) ([]*models.GoalNote, error) {
	query := `
		SELECT id, goal_id, content, created_at, updated_at
		FROM goal_notes
		WHERE goal_id = $1
		ORDER BY created_at DESC
	`

	rows, err := s.db.Query(query, goalID)
	if err != nil {
		return nil, fmt.Errorf("failed to query goal notes: %w", err)
	}
	defer rows.Close()

	var notes []*models.GoalNote
	for rows.Next() {
		note := &models.GoalNote{}
		err := rows.Scan(
			&note.ID, &note.GoalID, &note.Content, &note.CreatedAt, &note.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan goal note: %w", err)
		}
		notes = append(notes, note)
	}

	return notes, nil
}

func (s *CollaborationService) CreateGoalNote(userID string, goalID string, dto models.GoalNoteDto) (*models.GoalNote, error) {
	query := `
		INSERT INTO goal_notes (id, goal_id, content, created_at, updated_at)
		VALUES (gen_random_uuid(), $1, $2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
		RETURNING id, goal_id, content, created_at, updated_at
	`

	note := &models.GoalNote{}
	err := s.db.QueryRow(query, goalID, dto.Content).Scan(
		&note.ID, &note.GoalID, &note.Content, &note.CreatedAt, &note.UpdatedAt,
	)

	if err != nil {
		return nil, fmt.Errorf("failed to create goal note: %w", err)
	}

	return note, nil
}
