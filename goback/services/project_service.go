package services

import (
	"database/sql"
	"encoding/json"
	"fmt"

	"github.com/Hamza-agha-tec/goback/models"
)

type ProjectService struct {
	db *sql.DB
}

func NewProjectService(db *sql.DB) *ProjectService {
	return &ProjectService{db: db}
}

func (s *ProjectService) getChannelRole(channelID, userID string) (string, error) {
	var role string
	err := s.db.QueryRow(
		`SELECT role FROM channel_members WHERE channel_id = $1 AND user_id = $2`,
		channelID, userID,
	).Scan(&role)
	if err == sql.ErrNoRows {
		return "", fmt.Errorf("access denied")
	}
	if err != nil {
		return "", err
	}
	return role, nil
}

func (s *ProjectService) canAccessProject(projectID, userID string) (string, error) {
	var channelID, accessType, ownerID string
	err := s.db.QueryRow(
		`SELECT channel_id, access_type, owner_id FROM workspace_projects WHERE id = $1`,
		projectID,
	).Scan(&channelID, &accessType, &ownerID)
	if err == sql.ErrNoRows {
		return "", fmt.Errorf("project not found")
	}
	if err != nil {
		return "", err
	}

	channelRole, err := s.getChannelRole(channelID, userID)
	if err != nil {
		return "", err
	}

	var projectRole string
	err = s.db.QueryRow(
		`SELECT role FROM project_members WHERE project_id = $1 AND user_id = $2`,
		projectID, userID,
	).Scan(&projectRole)
	if err != nil && err != sql.ErrNoRows {
		return "", err
	}

	if projectRole != "" {
		return projectRole, nil
	}

	if accessType == "PUBLIC" {
		if channelRole == "OWNER" && ownerID == userID {
			return "OWNER", nil
		}
		switch channelRole {
		case "OWNER", "ADMIN":
			return "ADMIN", nil
		default:
			return "MEMBER", nil
		}
	}

	return "", fmt.Errorf("access denied")
}

func (s *ProjectService) BootstrapDefaultProject(channelID, userID string) (*models.WorkspaceProject, error) {
	return s.createProjectWithGroups(channelID, userID, models.CreateProjectDto{
		Name:        "Main",
		Description: "Default project",
		AccessType:  "PUBLIC",
	}, true)
}

func (s *ProjectService) AddUserToMainProject(channelID, userID string) error {
	var mainProjectID string
	err := s.db.QueryRow(`
		SELECT id FROM workspace_projects 
		WHERE channel_id = $1 AND name = 'Main' 
		ORDER BY created_at ASC LIMIT 1
	`, channelID).Scan(&mainProjectID)
	if err == sql.ErrNoRows {
		return nil // No main project
	}
	if err != nil {
		return err
	}

	_, err = s.db.Exec(`
		INSERT INTO project_members (project_id, user_id, role)
		VALUES ($1, $2, 'MEMBER')
		ON CONFLICT (project_id, user_id) DO NOTHING
	`, mainProjectID, userID)
	return err
}

func (s *ProjectService) CreateProject(channelID, userID string, dto models.CreateProjectDto) (*models.WorkspaceProject, error) {
	var channelType string
	err := s.db.QueryRow(`SELECT type FROM channels WHERE id = $1`, channelID).Scan(&channelType)
	if err != nil {
		return nil, fmt.Errorf("channel not found")
	}
	if channelType != "WORKSPACE" {
		return nil, fmt.Errorf("projects are only allowed on workspace channels")
	}

	role, err := s.getChannelRole(channelID, userID)
	if err != nil {
		return nil, err
	}
	if role != "OWNER" && role != "ADMIN" {
		return nil, fmt.Errorf("only channel owner or admin can create projects")
	}

	if dto.AccessType == "" {
		dto.AccessType = "PUBLIC"
	}

	return s.createProjectWithGroups(channelID, userID, dto, false)
}

func (s *ProjectService) createProjectWithGroups(channelID, userID string, dto models.CreateProjectDto, bootstrap bool) (*models.WorkspaceProject, error) {
	tx, err := s.db.Begin()
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	project := &models.WorkspaceProject{}
	err = tx.QueryRow(`
		INSERT INTO workspace_projects (channel_id, name, description, access_type, owner_id)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id, channel_id, name, description, access_type, owner_id, created_at, updated_at
	`, channelID, dto.Name, dto.Description, dto.AccessType, userID).Scan(
		&project.ID, &project.ChannelID, &project.Name, &project.Description,
		&project.AccessType, &project.OwnerID, &project.CreatedAt, &project.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create project: %w", err)
	}

	_, err = tx.Exec(`
		INSERT INTO project_members (project_id, user_id, role) VALUES ($1, $2, 'OWNER')
	`, project.ID, userID)
	if err != nil {
		return nil, err
	}

	type groupSpec struct {
		name, desc, groupType string
		isGeneral             bool
	}
	specs := []groupSpec{
		{"chat", "Project chat", "text", true},
		{"voice", "Voice room", "voice", false},
		{"posts", "Forum posts", "board", false},
	}
	for _, spec := range specs {
		var groupID string
		err = tx.QueryRow(`
			INSERT INTO groups (channel_id, project_id, name, description, is_general, group_type, access_type)
			VALUES ($1, $2, $3, $4, $5, $6, 'PUBLIC')
			RETURNING id
		`, channelID, project.ID, spec.name, spec.desc, spec.isGeneral, spec.groupType).Scan(&groupID)
		if err != nil {
			return nil, fmt.Errorf("failed to create group %s: %w", spec.name, err)
		}
		_, err = tx.Exec(`INSERT INTO group_members (group_id, user_id, role) VALUES ($1, $2, 'OWNER')`, groupID, userID)
		if err != nil {
			return nil, err
		}
	}

	if err = tx.Commit(); err != nil {
		return nil, err
	}

	project.Role = "OWNER"
	return project, nil
}

func (s *ProjectService) UpdateProject(projectID, userID string, dto models.UpdateProjectDto) (*models.WorkspaceProject, error) {
	role, err := s.canAccessProject(projectID, userID)
	if err != nil {
		return nil, err
	}
	if role != "OWNER" && role != "ADMIN" {
		return nil, fmt.Errorf("access denied")
	}

	project := &models.WorkspaceProject{}
	err = s.db.QueryRow(`
		UPDATE workspace_projects SET
			name = COALESCE(NULLIF($1, ''), name),
			description = COALESCE($2, description),
			access_type = COALESCE(NULLIF($3, ''), access_type),
			updated_at = now()
		WHERE id = $4
		RETURNING id, channel_id, name, description, access_type, owner_id, created_at, updated_at
	`, dto.Name, dto.Description, dto.AccessType, projectID).Scan(
		&project.ID, &project.ChannelID, &project.Name, &project.Description,
		&project.AccessType, &project.OwnerID, &project.CreatedAt, &project.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to update project: %w", err)
	}
	project.Role = role
	return project, nil
}

func (s *ProjectService) DeleteProject(projectID, userID string) error {
	role, err := s.canAccessProject(projectID, userID)
	if err != nil {
		return err
	}
	if role != "OWNER" && role != "ADMIN" {
		return fmt.Errorf("access denied")
	}

	_, err = s.db.Exec(`DELETE FROM workspace_projects WHERE id = $1`, projectID)
	return err
}

func (s *ProjectService) JoinProject(userID, projectID string) error {
	var accessType, channelID string
	err := s.db.QueryRow(`SELECT access_type, channel_id FROM workspace_projects WHERE id = $1`, projectID).Scan(&accessType, &channelID)
	if err == sql.ErrNoRows {
		return fmt.Errorf("project not found")
	}
	if err != nil {
		return err
	}

	if accessType != "PUBLIC" {
		return fmt.Errorf("cannot join private project directly")
	}

	// Must be in channel
	_, err = s.getChannelRole(channelID, userID)
	if err != nil {
		return err
	}

	_, err = s.db.Exec(`
		INSERT INTO project_members (project_id, user_id, role)
		VALUES ($1, $2, 'MEMBER')
		ON CONFLICT DO NOTHING
	`, projectID, userID)
	return err
}

func (s *ProjectService) RequestJoinProject(userID, projectID string) error {
	var accessType, channelID string
	err := s.db.QueryRow(`SELECT access_type, channel_id FROM workspace_projects WHERE id = $1`, projectID).Scan(&accessType, &channelID)
	if err == sql.ErrNoRows {
		return fmt.Errorf("project not found")
	}
	if err != nil {
		return fmt.Errorf("failed to check project: %w", err)
	}

	// Must be a member of the channel first
	_, err = s.getChannelRole(channelID, userID)
	if err != nil {
		return fmt.Errorf("must be a member of the channel to join its projects")
	}

	if accessType != "PRIVATE" {
		return fmt.Errorf("can only request to join private projects")
	}

	var memberCount int
	err = s.db.QueryRow(`SELECT COUNT(*) FROM project_members WHERE project_id = $1 AND user_id = $2`, projectID, userID).Scan(&memberCount)
	if err != nil {
		return fmt.Errorf("failed to check membership: %w", err)
	}
	if memberCount > 0 {
		return fmt.Errorf("already a member")
	}

	var pendingCount int
	err = s.db.QueryRow(`SELECT COUNT(*) FROM project_join_requests WHERE project_id = $1 AND user_id = $2 AND status = 'PENDING'`, projectID, userID).Scan(&pendingCount)
	if err != nil {
		return fmt.Errorf("failed to check existing request: %w", err)
	}
	if pendingCount > 0 {
		return fmt.Errorf("join request already pending")
	}

	_, err = s.db.Exec(`INSERT INTO project_join_requests (project_id, user_id, status) VALUES ($1, $2, 'PENDING')`, projectID, userID)
	if err != nil {
		return fmt.Errorf("failed to create join request: %w", err)
	}

	return nil
}

func (s *ProjectService) GetProjectJoinRequests(projectID, userID string) ([]*models.ProjectJoinRequestWithUser, error) {
	role, err := s.canAccessProject(projectID, userID)
	if err != nil {
		return nil, err
	}
	if role != "OWNER" && role != "ADMIN" {
		return nil, fmt.Errorf("access denied")
	}

	rows, err := s.db.Query(`
		SELECT r.id, r.status, r.created_at, u.id, u.username, u.avatar_url
		FROM project_join_requests r
		JOIN users u ON r.user_id = u.id
		WHERE r.project_id = $1 AND r.status = 'PENDING'
		ORDER BY r.created_at DESC
	`, projectID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	requests := make([]*models.ProjectJoinRequestWithUser, 0)
	for rows.Next() {
		r := &models.ProjectJoinRequestWithUser{}
		if err := rows.Scan(&r.ID, &r.Status, &r.CreatedAt, &r.User.ID, &r.User.Username, &r.User.AvatarURL); err != nil {
			return nil, err
		}
		requests = append(requests, r)
	}
	return requests, nil
}

func (s *ProjectService) HandleJoinRequest(requestID, userID, action string) error {
	var projectID, requesterID string
	err := s.db.QueryRow(`SELECT project_id, user_id FROM project_join_requests WHERE id = $1 AND status = 'PENDING'`, requestID).Scan(&projectID, &requesterID)
	if err == sql.ErrNoRows {
		return fmt.Errorf("request not found")
	}
	if err != nil {
		return err
	}

	role, err := s.canAccessProject(projectID, userID)
	if err != nil {
		return err
	}
	if role != "OWNER" && role != "ADMIN" {
		return fmt.Errorf("access denied")
	}

	tx, err := s.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	if action == "ACCEPT" {
		_, err = tx.Exec(`UPDATE project_join_requests SET status = 'ACCEPTED', updated_at = now() WHERE id = $1`, requestID)
		if err != nil {
			return err
		}

		_, err = tx.Exec(`INSERT INTO project_members (project_id, user_id, role) VALUES ($1, $2, 'MEMBER') ON CONFLICT DO NOTHING`, projectID, requesterID)
		if err != nil {
			return err
		}
	} else {
		_, err = tx.Exec(`UPDATE project_join_requests SET status = 'REJECTED', updated_at = now() WHERE id = $1`, requestID)
		if err != nil {
			return err
		}
	}

	return tx.Commit()
}

func (s *ProjectService) GetProjectMembers(projectID, userID string) ([]*models.ChannelMemberResponse, error) {
	if _, err := s.canAccessProject(projectID, userID); err != nil {
		return nil, err
	}

	rows, err := s.db.Query(`
		SELECT pm.role, pm.joined_at, u.id, u.username, u.avatar_url, u.sub_plan, u.is_verified, u.bio, u.banner
		FROM project_members pm
		JOIN users u ON pm.user_id = u.id
		WHERE pm.project_id = $1
		ORDER BY pm.joined_at ASC
	`, projectID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	members := make([]*models.ChannelMemberResponse, 0)
	for rows.Next() {
		m := &models.ChannelMemberResponse{}
		if err := rows.Scan(
			&m.Role, &m.JoinedAt, &m.User.ID, &m.User.Username, &m.User.AvatarURL,
			&m.User.SubPlan, &m.User.IsVerified, &m.User.Bio, &m.User.Banner,
		); err != nil {
			return nil, err
		}
		members = append(members, m)
	}
	return members, nil
}

func (s *ProjectService) AddProjectMember(projectID, adminID, targetUserID, role string) error {
	adminRole, err := s.canAccessProject(projectID, adminID)
	if err != nil {
		return err
	}
	if adminRole != "OWNER" && adminRole != "ADMIN" {
		return fmt.Errorf("access denied")
	}

	if role == "" {
		role = "MEMBER"
	}

	_, err = s.db.Exec(`
		INSERT INTO project_members (project_id, user_id, role)
		VALUES ($1, $2, $3)
		ON CONFLICT (project_id, user_id) DO UPDATE SET role = EXCLUDED.role
	`, projectID, targetUserID, role)
	return err
}

func (s *ProjectService) RemoveProjectMember(projectID, adminID, targetUserID string) error {
	adminRole, err := s.canAccessProject(projectID, adminID)
	if err != nil {
		return err
	}

	if adminID != targetUserID && adminRole != "OWNER" && adminRole != "ADMIN" {
		return fmt.Errorf("access denied")
	}

	// Cannot remove owner unless it's a self-leave and there are other admins?
	// Simple implementation for now.
	_, err = s.db.Exec(`DELETE FROM project_members WHERE project_id = $1 AND user_id = $2`, projectID, targetUserID)
	return err
}

func (s *ProjectService) GetProjectsByChannel(channelID, userID string) ([]*models.WorkspaceProject, error) {
	if _, err := s.getChannelRole(channelID, userID); err != nil {
		return nil, err
	}

	rows, err := s.db.Query(`
		SELECT p.id, p.channel_id, p.name, p.description, p.access_type, p.owner_id, p.created_at, p.updated_at,
		       COALESCE(pm.role,
		         CASE
		           WHEN p.access_type = 'PUBLIC' AND cm.role = 'OWNER' AND p.owner_id = $2 THEN 'OWNER'
		           WHEN p.access_type = 'PUBLIC' AND cm.role IN ('OWNER','ADMIN') THEN 'ADMIN'
		           WHEN p.access_type = 'PUBLIC' THEN 'MEMBER'
		           ELSE NULL
		         END
		       ) AS role
		FROM workspace_projects p
		INNER JOIN channel_members cm ON cm.channel_id = p.channel_id AND cm.user_id = $2
		LEFT JOIN project_members pm ON pm.project_id = p.id AND pm.user_id = $2
		WHERE p.channel_id = $1
		ORDER BY p.created_at ASC
	`, channelID, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]*models.WorkspaceProject, 0)
	for rows.Next() {
		p := &models.WorkspaceProject{}
		var role sql.NullString
		if err := rows.Scan(
			&p.ID, &p.ChannelID, &p.Name, &p.Description, &p.AccessType, &p.OwnerID,
			&p.CreatedAt, &p.UpdatedAt, &role,
		); err != nil {
			return nil, err
		}
		if role.Valid {
			p.Role = role.String
		}
		out = append(out, p)
	}
	return out, nil
}

func (s *ProjectService) GetProject(projectID, userID string) (*models.WorkspaceProject, error) {
	role, err := s.canAccessProject(projectID, userID)
	if err != nil {
		return nil, err
	}

	p := &models.WorkspaceProject{}
	err = s.db.QueryRow(`
		SELECT id, channel_id, name, description, access_type, owner_id, created_at, updated_at
		FROM workspace_projects WHERE id = $1
	`, projectID).Scan(
		&p.ID, &p.ChannelID, &p.Name, &p.Description, &p.AccessType, &p.OwnerID,
		&p.CreatedAt, &p.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	p.Role = role
	return p, nil
}

func (s *ProjectService) GetGroupsInProject(projectID, userID string) ([]*models.Group, error) {
	if _, err := s.canAccessProject(projectID, userID); err != nil {
		return nil, err
	}

	rows, err := s.db.Query(`
		SELECT g.id, g.channel_id, g.name, g.description, g.is_general, g.created_at, g.group_type, g.access_type,
		       CASE WHEN gm.user_id IS NOT NULL OR g.access_type = 'PUBLIC' THEN true ELSE false END AS is_member
		FROM groups g
		LEFT JOIN group_members gm ON gm.group_id = g.id AND gm.user_id = $2
		WHERE g.project_id = $1
		ORDER BY g.created_at ASC
	`, projectID, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	groups := make([]*models.Group, 0)
	for rows.Next() {
		g := &models.Group{}
		if err := rows.Scan(
			&g.ID, &g.ChannelID, &g.Name, &g.Description, &g.IsGeneral, &g.CreatedAt,
			&g.GroupType, &g.AccessType, &g.IsMember,
		); err != nil {
			return nil, err
		}
		groups = append(groups, g)
	}
	return groups, nil
}

// --- Whiteboards ---

func (s *ProjectService) ListWhiteboards(projectID, userID string) ([]*models.Whiteboard, error) {
	if _, err := s.canAccessProject(projectID, userID); err != nil {
		return nil, err
	}

	rows, err := s.db.Query(`
		SELECT id, project_id, title, data, created_by, created_at, updated_at
		FROM whiteboards WHERE project_id = $1 ORDER BY updated_at DESC
	`, projectID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	list := make([]*models.Whiteboard, 0)
	for rows.Next() {
		wb := &models.Whiteboard{Data: map[string]interface{}{}}
		var raw []byte
		if err := rows.Scan(&wb.ID, &wb.ProjectID, &wb.Title, &raw, &wb.CreatedBy, &wb.CreatedAt, &wb.UpdatedAt); err != nil {
			return nil, err
		}
		if len(raw) > 0 {
			_ = json.Unmarshal(raw, &wb.Data)
		}
		list = append(list, wb)
	}
	return list, nil
}

func (s *ProjectService) CreateWhiteboard(projectID, userID string, dto models.CreateWhiteboardDto) (*models.Whiteboard, error) {
	if _, err := s.canAccessProject(projectID, userID); err != nil {
		return nil, err
	}

	title := dto.Title
	if title == "" {
		title = "Untitled board"
	}
	dataJSON, _ := json.Marshal(dto.Data)
	if dto.Data == nil {
		dataJSON = []byte("{}")
	}

	wb := &models.Whiteboard{Data: dto.Data}
	err := s.db.QueryRow(`
		INSERT INTO whiteboards (project_id, title, data, created_by)
		VALUES ($1, $2, $3, $4)
		RETURNING id, project_id, title, data, created_by, created_at, updated_at
	`, projectID, title, dataJSON, userID).Scan(
		&wb.ID, &wb.ProjectID, &wb.Title, &dataJSON, &wb.CreatedBy, &wb.CreatedAt, &wb.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	_ = json.Unmarshal(dataJSON, &wb.Data)
	return wb, nil
}

func (s *ProjectService) UpdateWhiteboard(projectID, whiteboardID, userID string, dto models.UpdateWhiteboardDto) (*models.Whiteboard, error) {
	if _, err := s.canAccessProject(projectID, userID); err != nil {
		return nil, err
	}

	var dataToUpdate interface{}
	if dto.Data != nil {
		dataJSON, _ := json.Marshal(dto.Data)
		dataToUpdate = dataJSON
	} else {
		dataToUpdate = nil
	}

	wb := &models.Whiteboard{}
	var updatedData []byte

	err := s.db.QueryRow(`
		UPDATE whiteboards SET
		  title = COALESCE(NULLIF($1, ''), title),
		  data = COALESCE($2, data),
		  updated_at = now()
		WHERE id = $3 AND project_id = $4
		RETURNING id, project_id, title, data, created_by, created_at, updated_at
	`, dto.Title, dataToUpdate, whiteboardID, projectID).Scan(
		&wb.ID, &wb.ProjectID, &wb.Title, &updatedData, &wb.CreatedBy, &wb.CreatedAt, &wb.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to update whiteboard: %w", err)
	}

	if len(updatedData) > 0 {
		_ = json.Unmarshal(updatedData, &wb.Data)
	}
	return wb, nil
}

func (s *ProjectService) DeleteWhiteboard(projectID, whiteboardID, userID string) error {
	role, err := s.canAccessProject(projectID, userID)
	if err != nil {
		return err
	}
	if role != "OWNER" && role != "ADMIN" {
		var createdBy string
		_ = s.db.QueryRow(`SELECT created_by FROM whiteboards WHERE id = $1`, whiteboardID).Scan(&createdBy)
		if createdBy != userID {
			return fmt.Errorf("access denied")
		}
	}
	_, err = s.db.Exec(`DELETE FROM whiteboards WHERE id = $1 AND project_id = $2`, whiteboardID, projectID)
	return err
}

func (s *ProjectService) GetWhiteboard(projectID, whiteboardID, userID string) (*models.Whiteboard, error) {
	if _, err := s.canAccessProject(projectID, userID); err != nil {
		return nil, err
	}

	wb := &models.Whiteboard{Data: map[string]interface{}{}}
	var raw []byte
	err := s.db.QueryRow(`
		SELECT id, project_id, title, data, created_by, created_at, updated_at
		FROM whiteboards WHERE id = $1 AND project_id = $2
	`, whiteboardID, projectID).Scan(
		&wb.ID, &wb.ProjectID, &wb.Title, &raw, &wb.CreatedBy, &wb.CreatedAt, &wb.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	if len(raw) > 0 {
		_ = json.Unmarshal(raw, &wb.Data)
	}
	return wb, nil
}
