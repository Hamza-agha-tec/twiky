package services

import (
	"database/sql"
	"fmt"

	"github.com/Hamza-agha-tec/goback/models"
)

type GroupService struct {
	db *sql.DB
}

func NewGroupService(db *sql.DB) *GroupService {
	return &GroupService{
		db: db,
	}
}

func (s *GroupService) CreateGroup(channelID, userID string, createData models.CreateGroupDto) (*models.Group, error) {
	query := `
		INSERT INTO groups (id, channel_id, name, description, group_type, access_type, owner_id, created_at, updated_at)
		VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
		RETURNING id, channel_id, name, description, group_type, access_type, owner_id, created_at, updated_at
	`
	
	group := &models.Group{}
	err := s.db.QueryRow(query,
		channelID, createData.Name, createData.Description,
		createData.GroupType, createData.AccessType, userID,
	).Scan(
		&group.ID, &group.ChannelID, &group.Name, &group.Description,
		&group.GroupType, &group.AccessType, &group.OwnerID,
		&group.CreatedAt, &group.UpdatedAt,
	)
	
	if err != nil {
		return nil, fmt.Errorf("failed to create group: %w", err)
	}
	
	// Add owner as admin member
	_, err = s.db.Exec(`
		INSERT INTO group_members (id, group_id, user_id, role, joined_at)
		VALUES (gen_random_uuid(), $1, $2, 'ADMIN', CURRENT_TIMESTAMP)
	`, group.ID, userID)
	
	if err != nil {
		return nil, fmt.Errorf("failed to add owner as group member: %w", err)
	}
	
	return group, nil
}

func (s *GroupService) GetGroupsInChannel(channelID, requestingUserID string) ([]*models.Group, error) {
	// Check if user is a member of the channel
	var isMember bool
	err := s.db.QueryRow(`
		SELECT EXISTS(SELECT 1 FROM channel_members WHERE channel_id = $1 AND user_id = $2)
	`, channelID, requestingUserID).Scan(&isMember)
	
	if err != nil {
		return nil, fmt.Errorf("failed to check channel membership: %w", err)
	}
	
	if !isMember {
		return nil, fmt.Errorf("access denied")
	}
	
	query := `
		SELECT id, channel_id, name, description, group_type, access_type, owner_id, created_at, updated_at
		FROM groups 
		WHERE channel_id = $1
		ORDER BY created_at DESC
	`
	
	rows, err := s.db.Query(query, channelID)
	if err != nil {
		return nil, fmt.Errorf("failed to query groups: %w", err)
	}
	defer rows.Close()
	
	var groups []*models.Group
	for rows.Next() {
		group := &models.Group{}
		err := rows.Scan(
			&group.ID, &group.ChannelID, &group.Name, &group.Description,
			&group.GroupType, &group.AccessType, &group.OwnerID,
			&group.CreatedAt, &group.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan group row: %w", err)
		}
		groups = append(groups, group)
	}
	
	return groups, nil
}

func (s *GroupService) GetGroupMembers(groupID, requestingUserID string) ([]*models.GroupMember, error) {
	// Check if user is a member of the group
	var isMember bool
	err := s.db.QueryRow(`
		SELECT EXISTS(SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2)
	`, groupID, requestingUserID).Scan(&isMember)
	
	if err != nil {
		return nil, fmt.Errorf("failed to check group membership: %w", err)
	}
	
	if !isMember {
		return nil, fmt.Errorf("access denied")
	}
	
	query := `
		SELECT id, group_id, user_id, role, joined_at
		FROM group_members 
		WHERE group_id = $1
		ORDER BY joined_at ASC
	`
	
	rows, err := s.db.Query(query, groupID)
	if err != nil {
		return nil, fmt.Errorf("failed to query group members: %w", err)
	}
	defer rows.Close()
	
	var members []*models.GroupMember
	for rows.Next() {
		member := &models.GroupMember{}
		err := rows.Scan(
			&member.ID, &member.GroupID, &member.UserID,
			&member.Role, &member.JoinedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan member row: %w", err)
		}
		members = append(members, member)
	}
	
	return members, nil
}

func (s *GroupService) UpdateGroup(groupID, userID string, updateData models.UpdateGroupDto) error {
	// Check if user is admin or owner
	var role string
	err := s.db.QueryRow(`
		SELECT role FROM group_members WHERE group_id = $1 AND user_id = $2
	`, groupID, userID).Scan(&role)
	
	if err != nil {
		if err == sql.ErrNoRows {
			return fmt.Errorf("access denied")
		}
		return fmt.Errorf("failed to check user role: %w", err)
	}
	
	if role != "ADMIN" && role != "MODERATOR" {
		return fmt.Errorf("insufficient permissions")
	}
	
	query := `
		UPDATE groups 
		SET name = COALESCE($1, name),
		    description = COALESCE($2, description),
		    group_type = COALESCE($3, group_type),
		    access_type = COALESCE($4, access_type),
		    updated_at = CURRENT_TIMESTAMP
		WHERE id = $5
	`
	
	_, err = s.db.Exec(query,
		updateData.Name, updateData.Description, updateData.GroupType,
		updateData.AccessType, groupID,
	)
	
	if err != nil {
		return fmt.Errorf("failed to update group: %w", err)
	}
	
	return nil
}

func (s *GroupService) DeleteGroup(groupID, userID string) error {
	// Check if user is owner
	var ownerID string
	err := s.db.QueryRow("SELECT owner_id FROM groups WHERE id = $1", groupID).Scan(&ownerID)
	if err != nil {
		if err == sql.ErrNoRows {
			return fmt.Errorf("group not found")
		}
		return fmt.Errorf("failed to check group ownership: %w", err)
	}
	
	if ownerID != userID {
		return fmt.Errorf("only group owner can delete group")
	}
	
	// Delete group (cascade should handle members)
	_, err = s.db.Exec("DELETE FROM groups WHERE id = $1", groupID)
	if err != nil {
		return fmt.Errorf("failed to delete group: %w", err)
	}
	
	return nil
}

func (s *GroupService) AddMemberToGroup(groupID, userID string, addData models.AddGroupMemberDto) error {
	// Check if requesting user is admin or moderator
	var role string
	err := s.db.QueryRow(`
		SELECT role FROM group_members WHERE group_id = $1 AND user_id = $2
	`, groupID, userID).Scan(&role)
	
	if err != nil {
		if err == sql.ErrNoRows {
			return fmt.Errorf("access denied")
		}
		return fmt.Errorf("failed to check user role: %w", err)
	}
	
	if role != "ADMIN" && role != "MODERATOR" {
		return fmt.Errorf("insufficient permissions")
	}
	
	// Check if user is already a member
	var exists bool
	err = s.db.QueryRow(`
		SELECT EXISTS(SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2)
	`, groupID, addData.UserID).Scan(&exists)
	
	if err != nil {
		return fmt.Errorf("failed to check existing membership: %w", err)
	}
	
	if exists {
		return fmt.Errorf("user is already a member")
	}
	
	// Add member
	_, err = s.db.Exec(`
		INSERT INTO group_members (id, group_id, user_id, role, joined_at)
		VALUES (gen_random_uuid(), $1, $2, $3, CURRENT_TIMESTAMP)
	`, groupID, addData.UserID, addData.Role)
	
	if err != nil {
		return fmt.Errorf("failed to add member: %w", err)
	}
	
	return nil
}

func (s *GroupService) UpdateGroupMemberRole(groupID, userID string, updateData models.AddGroupMemberDto) error {
	// Check if requesting user is admin
	var role string
	err := s.db.QueryRow(`
		SELECT role FROM group_members WHERE group_id = $1 AND user_id = $2
	`, groupID, userID).Scan(&role)
	
	if err != nil {
		if err == sql.ErrNoRows {
			return fmt.Errorf("access denied")
		}
		return fmt.Errorf("failed to check user role: %w", err)
	}
	
	if role != "ADMIN" {
		return fmt.Errorf("only admins can update member roles")
	}
	
	// Update member role
	_, err = s.db.Exec(`
		UPDATE group_members SET role = $1 WHERE group_id = $2 AND user_id = $3
	`, updateData.Role, groupID, updateData.UserID)
	
	if err != nil {
		return fmt.Errorf("failed to update member role: %w", err)
	}
	
	return nil
}

func (s *GroupService) DeleteGroupMember(groupID, userID, memberID string) error {
	// Check if requesting user is admin or moderator
	var role string
	err := s.db.QueryRow(`
		SELECT role FROM group_members WHERE group_id = $1 AND user_id = $2
	`, groupID, userID).Scan(&role)
	
	if err != nil {
		if err == sql.ErrNoRows {
			return fmt.Errorf("access denied")
		}
		return fmt.Errorf("failed to check user role: %w", err)
	}
	
	if role != "ADMIN" && role != "MODERATOR" {
		return fmt.Errorf("insufficient permissions")
	}
	
	// Remove member
	_, err = s.db.Exec(`
		DELETE FROM group_members WHERE group_id = $1 AND user_id = $2
	`, groupID, memberID)
	
	if err != nil {
		return fmt.Errorf("failed to remove member: %w", err)
	}
	
	return nil
}

func (s *GroupService) RequestJoinGroup(groupID, userID string) error {
	// Check if group is private
	var accessType string
	err := s.db.QueryRow("SELECT access_type FROM groups WHERE id = $1", groupID).Scan(&accessType)
	if err != nil {
		if err == sql.ErrNoRows {
			return fmt.Errorf("group not found")
		}
		return fmt.Errorf("failed to check group access type: %w", err)
	}
	
	if accessType != "PRIVATE" {
		return fmt.Errorf("can only request to join private groups")
	}
	
	// Check if already a member
	var exists bool
	err = s.db.QueryRow(`
		SELECT EXISTS(SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2)
	`, groupID, userID).Scan(&exists)
	
	if err != nil {
		return fmt.Errorf("failed to check existing membership: %w", err)
	}
	
	if exists {
		return fmt.Errorf("already a member")
	}
	
	// Check if request already exists
	var requestExists bool
	err = s.db.QueryRow(`
		SELECT EXISTS(SELECT 1 FROM group_join_requests WHERE group_id = $1 AND user_id = $2 AND status = 'PENDING')
	`, groupID, userID).Scan(&requestExists)
	
	if err != nil {
		return fmt.Errorf("failed to check existing request: %w", err)
	}
	
	if requestExists {
		return fmt.Errorf("join request already pending")
	}
	
	// Create join request
	_, err = s.db.Exec(`
		INSERT INTO group_join_requests (id, group_id, user_id, status, message, created_at, updated_at)
		VALUES (gen_random_uuid(), $1, $2, 'PENDING', '', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
	`, groupID, userID)
	
	if err != nil {
		return fmt.Errorf("failed to create join request: %w", err)
	}
	
	return nil
}

func (s *GroupService) GetJoinRequests(groupID, userID string) ([]*models.GroupJoinRequest, error) {
	// Check if user is admin or moderator
	var role string
	err := s.db.QueryRow(`
		SELECT role FROM group_members WHERE group_id = $1 AND user_id = $2
	`, groupID, userID).Scan(&role)
	
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("access denied")
		}
		return nil, fmt.Errorf("failed to check user role: %w", err)
	}
	
	if role != "ADMIN" && role != "MODERATOR" {
		return nil, fmt.Errorf("insufficient permissions")
	}
	
	query := `
		SELECT id, group_id, user_id, status, message, created_at, updated_at
		FROM group_join_requests 
		WHERE group_id = $1 AND status = 'PENDING'
		ORDER BY created_at ASC
	`
	
	rows, err := s.db.Query(query, groupID)
	if err != nil {
		return nil, fmt.Errorf("failed to query join requests: %w", err)
	}
	defer rows.Close()
	
	var requests []*models.GroupJoinRequest
	for rows.Next() {
		request := &models.GroupJoinRequest{}
		err := rows.Scan(
			&request.ID, &request.GroupID, &request.UserID,
			&request.Status, &request.Message, &request.CreatedAt, &request.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan request row: %w", err)
		}
		requests = append(requests, request)
	}
	
	return requests, nil
}

func (s *GroupService) RespondToJoinRequest(groupID, requestID, status, userID string) error {
	// Check if user is admin or moderator
	var role string
	err := s.db.QueryRow(`
		SELECT role FROM group_members WHERE group_id = $1 AND user_id = $2
	`, groupID, userID).Scan(&role)
	
	if err != nil {
		if err == sql.ErrNoRows {
			return fmt.Errorf("access denied")
		}
		return fmt.Errorf("failed to check user role: %w", err)
	}
	
	if role != "ADMIN" && role != "MODERATOR" {
		return fmt.Errorf("insufficient permissions")
	}
	
	// Get request details
	var requestingUserID string
	err = s.db.QueryRow(`
		SELECT user_id FROM group_join_requests WHERE id = $1 AND group_id = $2
	`, requestID, groupID).Scan(&requestingUserID)
	
	if err != nil {
		if err == sql.ErrNoRows {
			return fmt.Errorf("join request not found")
		}
		return fmt.Errorf("failed to get join request: %w", err)
	}
	
	// Update request status
	_, err = s.db.Exec(`
		UPDATE group_join_requests SET status = $1, updated_at = CURRENT_TIMESTAMP 
		WHERE id = $2 AND group_id = $3
	`, status, requestID, groupID)
	
	if err != nil {
		return fmt.Errorf("failed to update join request: %w", err)
	}
	
	// If accepted, add user as member
	if status == "ACCEPTED" {
		_, err = s.db.Exec(`
			INSERT INTO group_members (id, group_id, user_id, role, joined_at)
			VALUES (gen_random_uuid(), $1, $2, 'MEMBER', CURRENT_TIMESTAMP)
		`, groupID, requestingUserID)
		
		if err != nil {
			return fmt.Errorf("failed to add member: %w", err)
		}
	}
	
	return nil
}
