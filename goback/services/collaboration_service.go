package services

import (
	"database/sql"
	"encoding/json"
	"fmt"

	"github.com/Hamza-agha-tec/goback/models"
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

// --- TASKS ---

func (s *CollaborationService) CreateTask(userID string, req models.CreateTaskRequest) (*models.Task, error) {
	tagsJSON, _ := json.Marshal(req.Tags)
	attachmentsJSON, _ := json.Marshal(req.Attachments)

	var tasks []models.Task
	err := s.supabase.GetClient().DB.From("tasks").
		Insert(map[string]interface{}{
			"title":       req.Title,
			"description": req.Description,
			"creator_id":  userID,
			"assignee_id": req.AssigneeID,
			"group_id":    req.GroupID,
			"status":      "TODO",
			"priority":    req.Priority,
			"due_date":    req.DueDate,
			"tags":        tagsJSON,
			"attachments": attachmentsJSON,
		}).
		Execute(&tasks)

	if err != nil {
		return nil, fmt.Errorf("failed to create task: %w", err)
	}

	if len(tasks) == 0 {
		return nil, fmt.Errorf("failed to create task: no data returned")
	}

	tasks[0].Tags = req.Tags
	tasks[0].Attachments = req.Attachments

	return &tasks[0], nil
}

func (s *CollaborationService) GetTasks(userID string, groupID string) ([]*models.Task, error) {
	// Get tasks where user is creator
	var creatorTasks []models.Task
	err := s.supabase.GetClient().DB.From("tasks").
		Select("*").
		Eq("creator_id", userID).
		Execute(&creatorTasks)

	if err != nil {
		return nil, fmt.Errorf("failed to query creator tasks: %w", err)
	}

	// Get tasks where user is in group
	var groupTasks []models.Task
	if groupID != "" {
		err = s.supabase.GetClient().DB.From("tasks").
			Select("*").
			Eq("group_id", groupID).
			Execute(&groupTasks)

		if err != nil {
			return nil, fmt.Errorf("failed to query group tasks: %w", err)
		}
	}

	// Combine and deduplicate
	taskMap := make(map[string]*models.Task)
	for i := range creatorTasks {
		taskMap[creatorTasks[i].ID] = &creatorTasks[i]
	}
	for i := range groupTasks {
		taskMap[groupTasks[i].ID] = &groupTasks[i]
	}

	// Convert to slice
	var tasks []*models.Task
	for _, task := range taskMap {
		tasks = append(tasks, task)
	}

	return tasks, nil
}

func (s *CollaborationService) UpdateTask(userID string, taskID string, req models.UpdateTaskRequest) (*models.Task, error) {
	var tasks []models.Task
	err := s.supabase.GetClient().DB.From("tasks").
		Update(map[string]interface{}{
			"title":       req.Title,
			"description": req.Description,
			"assignee_id": req.AssigneeID,
			"status":      req.Status,
			"priority":    req.Priority,
			"due_date":    req.DueDate,
		}).
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

// --- NOTES ---

func (s *CollaborationService) CreateNote(userID string, req models.CreateNoteRequest) (*models.Note, error) {
	tagsJSON, _ := json.Marshal(req.Tags)

	var notes []models.Note
	err := s.supabase.GetClient().DB.From("notes").
		Insert(map[string]interface{}{
			"title":      req.Title,
			"content":    req.Content,
			"creator_id": userID,
			"group_id":   req.GroupID,
			"color":      req.Color,
			"tags":       tagsJSON,
		}).
		Execute(&notes)

	if err != nil {
		return nil, fmt.Errorf("failed to create note: %w", err)
	}

	if len(notes) == 0 {
		return nil, fmt.Errorf("failed to create note: no data returned")
	}

	notes[0].Tags = req.Tags

	return &notes[0], nil
}

func (s *CollaborationService) GetNotes(userID string, groupID string) ([]*models.Note, error) {
	// Get notes where user is creator
	var creatorNotes []models.Note
	err := s.supabase.GetClient().DB.From("notes").
		Select("*").
		Eq("creator_id", userID).
		Execute(&creatorNotes)

	if err != nil {
		return nil, fmt.Errorf("failed to query creator notes: %w", err)
	}

	// Get notes where user is in group
	var groupNotes []models.Note
	if groupID != "" {
		err = s.supabase.GetClient().DB.From("notes").
			Select("*").
			Eq("group_id", groupID).
			Execute(&groupNotes)

		if err != nil {
			return nil, fmt.Errorf("failed to query group notes: %w", err)
		}
	}

	// Combine and deduplicate
	noteMap := make(map[string]*models.Note)
	for i := range creatorNotes {
		noteMap[creatorNotes[i].ID] = &creatorNotes[i]
	}
	for i := range groupNotes {
		noteMap[groupNotes[i].ID] = &groupNotes[i]
	}

	// Convert to slice
	var notes []*models.Note
	for _, note := range noteMap {
		notes = append(notes, note)
	}

	return notes, nil
}

func (s *CollaborationService) UpdateNote(userID string, noteID string, req models.UpdateNoteRequest) (*models.Note, error) {
	var notes []models.Note
	err := s.supabase.GetClient().DB.From("notes").
		Update(map[string]interface{}{
			"title":   req.Title,
			"content": req.Content,
			"color":   req.Color,
		}).
		Eq("id", noteID).
		Eq("creator_id", userID).
		Execute(&notes)

	if err != nil {
		return nil, fmt.Errorf("failed to update note: %w", err)
	}

	if len(notes) == 0 {
		return nil, fmt.Errorf("note not found")
	}

	return &notes[0], nil
}

// --- GOALS ---

func (s *CollaborationService) CreateGoal(userID string, req models.CreateGoalRequest) (*models.Goal, error) {
	var goals []models.Goal
	err := s.supabase.GetClient().DB.From("goals").
		Insert(map[string]interface{}{
			"title":       req.Title,
			"description": req.Description,
			"creator_id":  userID,
			"group_id":    req.GroupID,
			"category":    req.Category,
			"status":      "PENDING",
			"priority":    req.Priority,
			"progress":    0,
			"target_date": req.TargetDate,
		}).
		Execute(&goals)

	if err != nil {
		return nil, fmt.Errorf("failed to create goal: %w", err)
	}

	if len(goals) == 0 {
		return nil, fmt.Errorf("failed to create goal: no data returned")
	}

	return &goals[0], nil
}

func (s *CollaborationService) GetGoals(userID string, groupID string) ([]*models.Goal, error) {
	// Get goals where user is creator
	var creatorGoals []models.Goal
	err := s.supabase.GetClient().DB.From("goals").
		Select("*").
		Eq("creator_id", userID).
		Execute(&creatorGoals)

	if err != nil {
		return nil, fmt.Errorf("failed to query creator goals: %w", err)
	}

	// Get goals where user is in group
	var groupGoals []models.Goal
	if groupID != "" {
		err = s.supabase.GetClient().DB.From("goals").
			Select("*").
			Eq("group_id", groupID).
			Execute(&groupGoals)

		if err != nil {
			return nil, fmt.Errorf("failed to query group goals: %w", err)
		}
	}

	// Combine and deduplicate
	goalMap := make(map[string]*models.Goal)
	for i := range creatorGoals {
		goalMap[creatorGoals[i].ID] = &creatorGoals[i]
	}
	for i := range groupGoals {
		goalMap[groupGoals[i].ID] = &groupGoals[i]
	}

	// Convert to slice
	var goals []*models.Goal
	for _, goal := range goalMap {
		goals = append(goals, goal)
	}
	return goals, nil
}

func (s *CollaborationService) UpdateGoal(userID string, goalID string, req models.UpdateGoalRequest) (*models.Goal, error) {
	milestonesJSON, _ := json.Marshal(req.Milestones)

	var goals []models.Goal
	err := s.supabase.GetClient().DB.From("goals").
		Update(map[string]interface{}{
			"title":      req.Title,
			"status":     req.Status,
			"progress":   req.Progress,
			"milestones": milestonesJSON,
		}).
		Eq("id", goalID).
		Eq("creator_id", userID).
		Execute(&goals)

	if err != nil {
		return nil, fmt.Errorf("failed to update goal: %w", err)
	}

	if len(goals) == 0 {
		return nil, fmt.Errorf("goal not found")
	}

	goals[0].Milestones = req.Milestones

	return &goals[0], nil
}

func (s *CollaborationService) GetMilestones(userID string, goalID string) ([]*models.Milestone, error) {
	var milestones []models.Milestone
	err := s.supabase.GetClient().DB.From("milestones").
		Select("*").
		Eq("goal_id", goalID).
		Execute(&milestones)

	if err != nil {
		return nil, fmt.Errorf("failed to query milestones: %w", err)
	}

	// Convert to pointer slice
	var milestonePtrs []*models.Milestone
	for i := range milestones {
		milestonePtrs = append(milestonePtrs, &milestones[i])
	}

	return milestonePtrs, nil
}

func (s *CollaborationService) CreateMilestone(userID string, goalID string, dto models.CreateMilestoneDto) (*models.Milestone, error) {
	var milestones []models.Milestone
	err := s.supabase.GetClient().DB.From("milestones").
		Insert(map[string]interface{}{
			"goal_id":     goalID,
			"title":       dto.Title,
			"description": dto.Description,
			"completed":   false,
			"due_date":    dto.DueDate,
		}).
		Execute(&milestones)

	if err != nil {
		return nil, fmt.Errorf("failed to create milestone: %w", err)
	}

	if len(milestones) == 0 {
		return nil, fmt.Errorf("failed to create milestone: no data returned")
	}

	return &milestones[0], nil
}

func (s *CollaborationService) ToggleMilestone(userID string, milestoneID string, completed bool) (*models.Milestone, error) {
	var milestones []models.Milestone
	err := s.supabase.GetClient().DB.From("milestones").
		Update(map[string]interface{}{
			"completed": completed,
		}).
		Eq("id", milestoneID).
		Execute(&milestones)

	if err != nil {
		return nil, fmt.Errorf("failed to toggle milestone: %w", err)
	}

	if len(milestones) == 0 {
		return nil, fmt.Errorf("milestone not found")
	}

	return &milestones[0], nil
}

func (s *CollaborationService) GetGoalNotes(userID string, goalID string) ([]*models.GoalNote, error) {
	var notes []models.GoalNote
	err := s.supabase.GetClient().DB.From("goal_notes").
		Select("id", "goal_id", "content", "created_at", "updated_at").
		Eq("goal_id", goalID).
		Execute(&notes)

	if err != nil {
		return nil, fmt.Errorf("failed to query goal notes: %w", err)
	}

	// Convert to slice of pointers
	var result []*models.GoalNote
	for i := range notes {
		result = append(result, &notes[i])
	}

	return result, nil
}

func (s *CollaborationService) CreateGoalNote(userID string, goalID string, dto models.GoalNoteDto) (*models.GoalNote, error) {
	var notes []models.GoalNote
	err := s.supabase.GetClient().DB.From("goal_notes").
		Insert(map[string]interface{}{
			"goal_id": goalID,
			"content": dto.Content,
		}).
		Execute(&notes)

	if err != nil {
		return nil, fmt.Errorf("failed to create goal note: %w", err)
	}

	if len(notes) == 0 {
		return nil, fmt.Errorf("failed to create goal note: no data returned")
	}

	return &notes[0], nil
}
