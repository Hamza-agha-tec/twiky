package services

import (
	"database/sql"
	"encoding/json"
	"fmt"

	"github.com/Hamza-agha-tec/goback/models"
	"github.com/lib/pq"
)

type CollaborationService struct {
	db       *sql.DB
	supabase *SupabaseClient
}

func NewCollaborationService(db *sql.DB, supabaseURL, supabaseKey string) *CollaborationService {
	return &CollaborationService{
		db:       db,
		supabase: NewSupabaseClient(supabaseURL, supabaseKey),
	}
}

func (s *CollaborationService) GetDB() *sql.DB {
	return s.db
}

// --- TASKS ---

func (s *CollaborationService) CreateTask(userID string, req models.CreateTaskRequest) (*models.Task, error) {
	attJSON, err := attachmentsJSON(req.Attachments)
	if err != nil {
		return nil, err
	}

	task := &models.Task{}
	var tags []string
	var desc, assignee, groupID, projectID sql.NullString
	var due sql.NullTime
	var attScan []byte
	err = s.db.QueryRow(`
		INSERT INTO tasks (
			title, description, creator_id, assignee_id, group_id, project_id,
			status, priority, due_date, tags, attachments
		)
		VALUES (
			$1, $2, $3, $4, $5, $6,
			$7, $8, $9, $10, $11
		)
		RETURNING id, title, description, creator_id, assignee_id, group_id, project_id,
		          status, priority, due_date, created_at, tags, attachments
	`,
		req.Title,
		sqlNullString(req.Description),
		userID,
		sqlNullUUID(req.AssigneeID),
		sqlNullUUID(req.GroupID),
		sqlNullUUID(req.ProjectID),
		defaultString(req.Status, "TODO"),
		defaultString(req.Priority, "medium"),
		sqlNullString(req.DueDate),
		tagsArray(req.Tags),
		attJSON,
	).Scan(
		&task.ID, &task.Title, &desc, &task.CreatorID, &assignee,
		&groupID, &projectID, &task.Status, &task.Priority, &due,
		&task.CreatedAt, pq.Array(&tags), &attScan,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create task: %w", err)
	}
	task.Description = nullStringPtr(desc)
	task.AssigneeID = nullStringPtr(assignee)
	task.GroupID = nullStringPtr(groupID)
	task.ProjectID = nullStringPtr(projectID)
	task.DueDate = nullTimePtr(due)
	task.Tags = tags
	_ = json.Unmarshal(attScan, &task.Attachments)
	return task, nil
}

func (s *CollaborationService) GetTasks(userID string, groupID string, projectID string) ([]*models.Task, error) {
	query := `
		SELECT id, project_id, group_id, creator_id, assignee_id, title, description,
		       status, due_date, created_at, priority, tags, attachments
		FROM tasks
		WHERE 1=1
	`
	args := []interface{}{}
	argCount := 1

	if projectID != "" {
		query += fmt.Sprintf(" AND project_id = $%d", argCount)
		args = append(args, projectID)
		argCount++
	} else {
		if groupID != "" {
			query += fmt.Sprintf(" AND (creator_id = $%d OR group_id = $%d)", argCount, argCount+1)
			args = append(args, userID, groupID)
			argCount += 2
		} else {
			query += fmt.Sprintf(" AND creator_id = $%d", argCount)
			args = append(args, userID)
			argCount++
		}
	}

	query += " ORDER BY created_at DESC"

	rows, err := s.db.Query(query, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to query tasks: %w", err)
	}
	defer rows.Close()

	tasks := make([]*models.Task, 0)
	for rows.Next() {
		task := &models.Task{}
		var pID, gID, assignee, desc sql.NullString
		var due sql.NullTime
		var tags []string
		var attScan []byte

		err := rows.Scan(
			&task.ID, &pID, &gID, &task.CreatorID, &assignee, &task.Title, &desc,
			&task.Status, &due, &task.CreatedAt, &task.Priority, pq.Array(&tags), &attScan,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan task: %w", err)
		}

		task.ProjectID = nullStringPtr(pID)
		task.GroupID = nullStringPtr(gID)
		task.AssigneeID = nullStringPtr(assignee)
		task.Description = nullStringPtr(desc)
		task.DueDate = nullTimePtr(due)
		task.Tags = tags
		if attScan != nil {
			_ = json.Unmarshal(attScan, &task.Attachments)
		} else {
			task.Attachments = []map[string]interface{}{}
		}

		tasks = append(tasks, task)
	}

	return tasks, nil
}

func (s *CollaborationService) UpdateTask(userID string, taskID string, req models.UpdateTaskRequest) (*models.Task, error) {
	var tasks []models.Task

	updateMap := make(map[string]interface{})
	if req.Title != "" {
		updateMap["title"] = req.Title
	}
	if req.Description != "" {
		updateMap["description"] = req.Description
	}
	if req.AssigneeID != "" {
		updateMap["assignee_id"] = req.AssigneeID
	} else if req.AssigneeID == "null" {
		updateMap["assignee_id"] = nil
	}
	if req.Status != "" {
		updateMap["status"] = req.Status
	}
	if req.Priority != "" {
		updateMap["priority"] = req.Priority
	}
	if req.DueDate != "" {
		updateMap["due_date"] = req.DueDate
	}

	if len(updateMap) == 0 {
		return nil, fmt.Errorf("no fields to update")
	}

	err := s.supabase.GetClient().DB.From("tasks").
		Update(updateMap).
		Eq("id", taskID).
		Eq("creator_id", userID).
		Execute(&tasks)

	if err != nil {
		return nil, fmt.Errorf("failed to update task: %w", err)
	}

	if len(tasks) == 0 {
		return nil, fmt.Errorf("task not found")
	}

	return &tasks[0], nil
}

func (s *CollaborationService) DeleteTask(userID string, taskID string) error {
	_, err := s.db.Exec(`
		DELETE FROM tasks
		WHERE id = $1 AND creator_id = $2
	`, taskID, userID)

	if err != nil {
		return fmt.Errorf("failed to delete task: %w", err)
	}

	return nil
}

// --- SUBTASKS ---

func (s *CollaborationService) CreateSubtask(req models.CreateSubtaskRequest) (*models.Subtask, error) {
	subtask := &models.Subtask{}
	err := s.db.QueryRow(`
		INSERT INTO subtasks (task_id, title, is_completed)
		VALUES ($1, $2, $3)
		RETURNING id, task_id, title, is_completed, created_at
	`, req.TaskID, req.Title, req.IsCompleted).Scan(
		&subtask.ID, &subtask.TaskID, &subtask.Title, &subtask.IsCompleted, &subtask.CreatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create subtask: %w", err)
	}
	return subtask, nil
}

func (s *CollaborationService) UpdateSubtask(id string, req models.UpdateSubtaskRequest) (*models.Subtask, error) {
	subtask := &models.Subtask{}
	err := s.db.QueryRow(`
		UPDATE subtasks
		SET title = COALESCE(NULLIF($1, ''), title),
		    is_completed = $2
		WHERE id = $3
		RETURNING id, task_id, title, is_completed, created_at
	`, req.Title, req.IsCompleted, id).Scan(
		&subtask.ID, &subtask.TaskID, &subtask.Title, &subtask.IsCompleted, &subtask.CreatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to update subtask: %w", err)
	}
	return subtask, nil
}

func (s *CollaborationService) GetSubtasks(taskID string) ([]*models.Subtask, error) {
	rows, err := s.db.Query(`
		SELECT id, task_id, title, is_completed, created_at
		FROM subtasks
		WHERE task_id = $1
		ORDER BY created_at ASC
	`, taskID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]*models.Subtask, 0)
	for rows.Next() {
		st := &models.Subtask{}
		if err := rows.Scan(&st.ID, &st.TaskID, &st.Title, &st.IsCompleted, &st.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, st)
	}
	return out, nil
}

// --- TASK COMMENTS ---

func (s *CollaborationService) CreateTaskComment(userID string, req models.CreateTaskCommentRequest) (*models.TaskComment, error) {
	comment := &models.TaskComment{}
	var reactions []byte
	err := s.db.QueryRow(`
		INSERT INTO task_comments (task_id, user_id, content, parent_id)
		VALUES ($1, $2, $3, $4)
		RETURNING id, task_id, user_id, content, parent_id, reactions, created_at
	`, req.TaskID, userID, req.Content, sqlNullUUID(req.ParentID)).Scan(
		&comment.ID, &comment.TaskID, &comment.UserID, &comment.Content, &comment.ParentID, &reactions, &comment.CreatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create task comment: %w", err)
	}
	if reactions != nil {
		_ = json.Unmarshal(reactions, &comment.Reactions)
	} else {
		comment.Reactions = []map[string]interface{}{}
	}

	// Fetch user info - use pointers for potentially null fields
	u := &models.User{}
	var email, username, avatar sql.NullString
	err = s.db.QueryRow(`
		SELECT id, email, username, avatar_url FROM users WHERE id = $1
	`, userID).Scan(&u.ID, &email, &username, &avatar)
	if err == nil {
		u.Email = email.String
		u.Username = nullStringPtr(username)
		u.AvatarURL = nullStringPtr(avatar)
		comment.User = u
	}

	return comment, nil
}

func (s *CollaborationService) GetTaskComments(taskID string) ([]*models.TaskComment, error) {
	rows, err := s.db.Query(`
		SELECT tc.id, tc.task_id, tc.user_id, tc.content, tc.parent_id, tc.reactions, tc.created_at,
		       u.id, u.email, u.username, u.avatar_url
		FROM task_comments tc
		JOIN users u ON tc.user_id = u.id
		WHERE tc.task_id = $1
		ORDER BY tc.created_at DESC
	`, taskID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]*models.TaskComment, 0)
	for rows.Next() {
		tc := &models.TaskComment{}
		u := &models.User{}
		var reactions []byte
		var email, username, avatar sql.NullString
		if err := rows.Scan(
			&tc.ID, &tc.TaskID, &tc.UserID, &tc.Content, &tc.ParentID, &reactions, &tc.CreatedAt,
			&u.ID, &email, &username, &avatar,
		); err != nil {
			return nil, fmt.Errorf("failed to scan task comment: %w", err)
		}

		u.Email = email.String
		u.Username = nullStringPtr(username)
		u.AvatarURL = nullStringPtr(avatar)

		if reactions != nil {
			_ = json.Unmarshal(reactions, &tc.Reactions)
		} else {
			tc.Reactions = []map[string]interface{}{}
		}
		tc.User = u
		out = append(out, tc)
	}
	return out, nil
}

func (s *CollaborationService) UpdateTaskComment(userID string, id string, req models.UpdateTaskCommentRequest) (*models.TaskComment, error) {
	comment := &models.TaskComment{}
	var reactions []byte

	var err error
	if req.Content != "" {
		err = s.db.QueryRow(`
			UPDATE task_comments
			SET content = $1
			WHERE id = $2 AND user_id = $3
			RETURNING id, task_id, user_id, content, parent_id, reactions, created_at
		`, req.Content, id, userID).Scan(
			&comment.ID, &comment.TaskID, &comment.UserID, &comment.Content, &comment.ParentID, &reactions, &comment.CreatedAt,
		)
	} else if req.Reactions != nil {
		reactJSON, _ := json.Marshal(req.Reactions)
		err = s.db.QueryRow(`
			UPDATE task_comments
			SET reactions = $1
			WHERE id = $2
			RETURNING id, task_id, user_id, content, parent_id, reactions, created_at
		`, reactJSON, id).Scan(
			&comment.ID, &comment.TaskID, &comment.UserID, &comment.Content, &comment.ParentID, &reactions, &comment.CreatedAt,
		)
	}

	if err != nil {
		return nil, fmt.Errorf("failed to update task comment: %w", err)
	}

	if reactions != nil {
		_ = json.Unmarshal(reactions, &comment.Reactions)
	} else {
		comment.Reactions = []map[string]interface{}{}
	}

	return comment, nil
}

func (s *CollaborationService) DeleteTaskComment(userID string, id string) error {
	_, err := s.db.Exec(`
		DELETE FROM task_comments
		WHERE id = $1 AND user_id = $2
	`, id, userID)
	return err
}

// --- NOTES ---

func (s *CollaborationService) CreateNote(userID string, req models.CreateNoteRequest) (*models.Note, error) {
	note := &models.Note{}
	var tags []string
	var content, groupID, projectID, color sql.NullString
	err := s.db.QueryRow(`
		INSERT INTO notes (title, content, author_id, group_id, project_id, color, tags, is_pinned)
		VALUES ($1, $2, $3, $4, $5, $6, $7, false)
		RETURNING id, title, content, author_id, group_id, project_id, created_at, tags, color, is_pinned
	`,
		req.Title,
		sqlNullString(req.Content),
		userID,
		sqlNullUUID(req.GroupID),
		sqlNullUUID(req.ProjectID),
		defaultString(req.Color, "#ffffff"),
		tagsArray(req.Tags),
	).Scan(
		&note.ID, &note.Title, &content, &note.AuthorID,
		&groupID, &projectID, &note.CreatedAt, pq.Array(&tags), &color, &note.IsPinned,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create note: %w", err)
	}
	note.Content = nullStringPtr(content)
	note.GroupID = nullStringPtr(groupID)
	note.ProjectID = nullStringPtr(projectID)
	note.Color = nullStringPtr(color)
	note.Tags = tags
	return note, nil
}

func (s *CollaborationService) GetNotes(userID string, groupID string, projectID string) ([]*models.Note, error) {
	query := `
		SELECT id, title, content, author_id, group_id, project_id, color, is_pinned, created_at
		FROM notes
		WHERE 1=1
	`
	args := []interface{}{}
	argCount := 1

	if projectID != "" {
		query += fmt.Sprintf(" AND project_id = $%d", argCount)
		args = append(args, projectID)
		argCount++
	} else {
		if groupID != "" {
			query += fmt.Sprintf(" AND (author_id = $%d OR group_id = $%d)", argCount, argCount+1)
			args = append(args, userID, groupID)
			argCount += 2
		} else {
			query += fmt.Sprintf(" AND author_id = $%d", argCount)
			args = append(args, userID)
			argCount++
		}
	}

	query += " ORDER BY is_pinned DESC, created_at DESC"

	rows, err := s.db.Query(query, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to query notes: %w", err)
	}
	defer rows.Close()

	notes := make([]*models.Note, 0)
	for rows.Next() {
		note := &models.Note{}
		var content, gID, pID, color sql.NullString

		err := rows.Scan(
			&note.ID, &note.Title, &content, &note.AuthorID, &gID, &pID, &color,
			&note.IsPinned, &note.CreatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan note: %w", err)
		}

		note.Content = nullStringPtr(content)
		note.GroupID = nullStringPtr(gID)
		note.ProjectID = nullStringPtr(pID)
		note.Color = nullStringPtr(color)

		notes = append(notes, note)
	}

	return notes, nil
}

func (s *CollaborationService) UpdateNote(userID string, noteID string, req models.UpdateNoteRequest) (*models.Note, error) {
	note := &models.Note{}
	var tags []string
	var content, groupID, projectID, color sql.NullString

	// Build update query dynamically
	query := "UPDATE notes SET updated_at = now()"
	args := []interface{}{}
	argCount := 1

	if req.Title != "" {
		query += fmt.Sprintf(", title = $%d", argCount)
		args = append(args, req.Title)
		argCount++
	}
	if req.Content != "" {
		query += fmt.Sprintf(", content = $%d", argCount)
		args = append(args, req.Content)
		argCount++
	}
	if req.Color != "" {
		query += fmt.Sprintf(", color = $%d", argCount)
		args = append(args, req.Color)
		argCount++
	}
	if req.Tags != nil {
		query += fmt.Sprintf(", tags = $%d", argCount)
		args = append(args, pq.Array(req.Tags))
		argCount++
	}
	if req.IsPinned != nil {
		query += fmt.Sprintf(", is_pinned = $%d", argCount)
		args = append(args, *req.IsPinned)
		argCount++
	}

	if argCount == 1 {
		return nil, fmt.Errorf("no fields to update")
	}

	query += fmt.Sprintf(" WHERE id = $%d AND author_id = $%d RETURNING id, title, content, author_id, group_id, project_id, color, tags, is_pinned, created_at", argCount, argCount+1)
	args = append(args, noteID, userID)

	err := s.db.QueryRow(query, args...).Scan(
		&note.ID, &note.Title, &content, &note.AuthorID, &groupID, &projectID, &color, pq.Array(&tags), &note.IsPinned, &note.CreatedAt,
	)

	if err != nil {
		return nil, fmt.Errorf("failed to update note: %w", err)
	}

	note.Content = nullStringPtr(content)
	note.GroupID = nullStringPtr(groupID)
	note.ProjectID = nullStringPtr(projectID)
	note.Color = nullStringPtr(color)
	note.Tags = tags

	return note, nil
}

func (s *CollaborationService) DeleteGoalNote(userID string, goalID string, noteID string) error {
	// Check if user is either the note author OR the goal owner
	var isAuthorized bool
	err := s.db.QueryRow(`
		SELECT EXISTS (
			SELECT 1 FROM goal_notes gn
			LEFT JOIN goals g ON gn.goal_id = g.id
			WHERE gn.id = $1 AND gn.goal_id = $2 AND (gn.user_id = $3 OR g.user_id = $3)
		)
	`, noteID, goalID, userID).Scan(&isAuthorized)

	if err != nil {
		return fmt.Errorf("failed to check authorization: %w", err)
	}

	if !isAuthorized {
		return fmt.Errorf("unauthorized to delete this goal note")
	}

	_, err = s.db.Exec(`
		DELETE FROM goal_notes
		WHERE id = $1 AND goal_id = $2
	`, noteID, goalID)

	if err != nil {
		return fmt.Errorf("failed to delete goal note: %w", err)
	}

	return nil
}

func (s *CollaborationService) DeleteNote(userID string, noteID string) error {
	_, err := s.db.Exec(`
		DELETE FROM notes
		WHERE id = $1 AND author_id = $2
	`, noteID, userID)

	if err != nil {
		return fmt.Errorf("failed to delete note: %w", err)
	}

	return nil
}

// --- GOALS ---

func (s *CollaborationService) CreateGoal(userID string, req models.CreateGoalRequest) (*models.Goal, error) {
	goal := &models.Goal{}
	var desc, groupID, projectID sql.NullString
	var target sql.NullTime
	err := s.db.QueryRow(`
		INSERT INTO goals (
			title, description, user_id, group_id, project_id,
			category, status, priority, progress, target_date
		)
		VALUES ($1, $2, $3, $4, $5, $6, 'TODO', $7, 0, $8)
		RETURNING id, title, description, user_id, group_id, project_id,
		          category, status, priority, progress, target_date, created_at, updated_at
	`,
		req.Title,
		sqlNullString(req.Description),
		userID,
		sqlNullUUID(req.GroupID),
		sqlNullUUID(req.ProjectID),
		defaultString(req.Category, "other"),
		defaultString(req.Priority, "medium"),
		sqlNullString(req.TargetDate),
	).Scan(
		&goal.ID, &goal.Title, &desc, &goal.UserID, &groupID, &projectID,
		&goal.Category, &goal.Status, &goal.Priority, &goal.Progress, &target,
		&goal.CreatedAt, &goal.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create goal: %w", err)
	}
	goal.Description = nullStringPtr(desc)
	goal.GroupID = nullStringPtr(groupID)
	goal.ProjectID = nullStringPtr(projectID)
	goal.TargetDate = nullTimePtr(target)
	return goal, nil
}

func (s *CollaborationService) GetGoals(userID string, groupID string, projectID string) ([]*models.Goal, error) {
	query := `
		SELECT id, title, description, user_id, group_id, project_id,
		       category, status, priority, progress, milestones, created_at, updated_at, target_date
		FROM goals
		WHERE 1=1
	`
	args := []interface{}{}
	argCount := 1

	if projectID != "" {
		query += fmt.Sprintf(" AND project_id = $%d", argCount)
		args = append(args, projectID)
		argCount++
	} else {
		// If no project_id, show goals where user is creator OR in specified group
		if groupID != "" {
			query += fmt.Sprintf(" AND (user_id = $%d OR group_id = $%d)", argCount, argCount+1)
			args = append(args, userID, groupID)
			argCount += 2
		} else {
			query += fmt.Sprintf(" AND user_id = $%d", argCount)
			args = append(args, userID)
			argCount++
		}
	}

	query += " ORDER BY created_at DESC"

	rows, err := s.db.Query(query, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to query goals: %w", err)
	}
	defer rows.Close()

	goals := make([]*models.Goal, 0)
	for rows.Next() {
		goal := &models.Goal{}
		var desc, gID, pID sql.NullString
		var milestonesScan []byte
		var target sql.NullTime

		err := rows.Scan(
			&goal.ID, &goal.Title, &desc, &goal.UserID, &gID, &pID,
			&goal.Category, &goal.Status, &goal.Priority, &goal.Progress,
			&milestonesScan, &goal.CreatedAt, &goal.UpdatedAt, &target,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan goal: %w", err)
		}

		goal.Description = nullStringPtr(desc)
		goal.GroupID = nullStringPtr(gID)
		goal.ProjectID = nullStringPtr(pID)
		goal.TargetDate = nullTimePtr(target)
		if milestonesScan != nil {
			_ = json.Unmarshal(milestonesScan, &goal.Milestones)
		} else {
			goal.Milestones = []map[string]interface{}{}
		}

		goals = append(goals, goal)
	}

	return goals, nil
}

func (s *CollaborationService) UpdateGoal(userID string, goalID string, req models.UpdateGoalRequest) (*models.Goal, error) {
	var milestonesJSON []byte
	if req.Milestones != nil {
		milestonesJSON, _ = json.Marshal(req.Milestones)
	}

	goal := &models.Goal{}
	err := s.db.QueryRow(`
		UPDATE goals SET
			title = COALESCE(NULLIF($1, ''), title),
			status = COALESCE(NULLIF($2, ''), status),
			progress = COALESCE($3, progress),
			milestones = COALESCE($4::jsonb, milestones),
			updated_at = now()
		WHERE id = $5
		RETURNING id, title, description, user_id, group_id, project_id,
		          category, status, priority, progress, target_date, created_at, updated_at, milestones
	`,
		req.Title, req.Status, req.Progress, milestonesJSON, goalID,
	).Scan(
		&goal.ID, &goal.Title, &goal.Description, &goal.UserID, &goal.GroupID, &goal.ProjectID,
		&goal.Category, &goal.Status, &goal.Priority, &goal.Progress, &goal.TargetDate,
		&goal.CreatedAt, &goal.UpdatedAt, &milestonesJSON,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("goal not found")
		}
		return nil, fmt.Errorf("failed to update goal: %w", err)
	}
	_ = json.Unmarshal(milestonesJSON, &goal.Milestones)
	return goal, nil
}

func (s *CollaborationService) DeleteGoal(userID string, goalID string) error {
	_, err := s.db.Exec(`
		DELETE FROM goals
		WHERE id = $1 AND user_id = $2
	`, goalID, userID)

	if err != nil {
		return fmt.Errorf("failed to delete goal: %w", err)
	}

	return nil
}

func (s *CollaborationService) GetMilestones(userID string, goalID string) ([]*models.GoalSubMilestone, error) {
	rows, err := s.db.Query(`
		SELECT id, created_at, user_id, goal_id, milestone_id, title, completed
		FROM milestones
		WHERE goal_id = $1
		ORDER BY created_at ASC
	`, goalID)
	if err != nil {
		return nil, fmt.Errorf("failed to query milestones: %w", err)
	}
	defer rows.Close()

	milestones := make([]*models.GoalSubMilestone, 0)
	for rows.Next() {
		m := &models.GoalSubMilestone{}
		if err := rows.Scan(&m.ID, &m.CreatedAt, &m.UserID, &m.GoalID, &m.MilestoneID, &m.Title, &m.Completed); err != nil {
			return nil, fmt.Errorf("failed to scan milestone: %w", err)
		}
		milestones = append(milestones, m)
	}

	return milestones, nil
}

func (s *CollaborationService) CreateMilestone(userID string, goalID string, dto models.CreateMilestoneDto) (*models.GoalSubMilestone, error) {
	m := &models.GoalSubMilestone{}
	err := s.db.QueryRow(`
		INSERT INTO milestones (goal_id, user_id, title, completed)
		VALUES ($1, $2, $3, false)
		RETURNING id, created_at, user_id, goal_id, milestone_id, title, completed
	`, goalID, userID, dto.Title).Scan(&m.ID, &m.CreatedAt, &m.UserID, &m.GoalID, &m.MilestoneID, &m.Title, &m.Completed)

	if err != nil {
		return nil, fmt.Errorf("failed to create milestone: %w", err)
	}

	return m, nil
}

func (s *CollaborationService) ToggleMilestone(userID string, milestoneID string, completed bool) (*models.GoalSubMilestone, error) {
	m := &models.GoalSubMilestone{}
	err := s.db.QueryRow(`
		UPDATE milestones
		SET completed = $1
		WHERE id = $2
		RETURNING id, created_at, user_id, goal_id, milestone_id, title, completed
	`, completed, milestoneID).Scan(&m.ID, &m.CreatedAt, &m.UserID, &m.GoalID, &m.MilestoneID, &m.Title, &m.Completed)

	if err != nil {
		return nil, fmt.Errorf("failed to toggle milestone: %w", err)
	}

	return m, nil
}

func (s *CollaborationService) GetGoalNotes(userID string, goalID string) ([]*models.GoalNote, error) {
	rows, err := s.db.Query(`
		SELECT id, user_id, goal_id, progress_point, title, content, milestone, created_at, updated_at, color, is_favorite
		FROM goal_notes
		WHERE goal_id = $1
		ORDER BY created_at DESC
	`, goalID)
	if err != nil {
		return nil, fmt.Errorf("failed to query goal notes: %w", err)
	}
	defer rows.Close()

	notes := make([]*models.GoalNote, 0)
	for rows.Next() {
		n := &models.GoalNote{}
		var pp sql.NullInt32
		var m, color sql.NullString
		if err := rows.Scan(
			&n.ID, &n.UserID, &n.GoalID, &pp, &n.Title, &n.Content, &m,
			&n.CreatedAt, &n.UpdatedAt, &color, &n.IsFavorite,
		); err != nil {
			return nil, fmt.Errorf("failed to scan goal note: %w", err)
		}
		if pp.Valid {
			v := int(pp.Int32)
			n.ProgressPoint = &v
		}
		n.Milestone = nullStringPtr(m)
		n.Color = nullStringPtr(color)
		notes = append(notes, n)
	}

	return notes, nil
}

func (s *CollaborationService) CreateGoalNote(userID string, goalID string, dto models.GoalNoteDto) (*models.GoalNote, error) {
	n := &models.GoalNote{}
	var pp sql.NullInt32
	var m, color sql.NullString

	err := s.db.QueryRow(`
		INSERT INTO goal_notes (user_id, goal_id, title, content, progress_point, milestone, color)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING id, user_id, goal_id, progress_point, title, content, milestone, created_at, updated_at, color, is_favorite
	`, userID, goalID, dto.Title, dto.Content, dto.ProgressPoint, dto.Milestone, dto.Color).Scan(
		&n.ID, &n.UserID, &n.GoalID, &pp, &n.Title, &n.Content, &m,
		&n.CreatedAt, &n.UpdatedAt, &color, &n.IsFavorite,
	)

	if err != nil {
		return nil, fmt.Errorf("failed to create goal note: %w", err)
	}

	if pp.Valid {
		v := int(pp.Int32)
		n.ProgressPoint = &v
	}
	n.Milestone = nullStringPtr(m)
	n.Color = nullStringPtr(color)

	return n, nil
}
