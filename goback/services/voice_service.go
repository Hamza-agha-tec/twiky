package services

import (
	"database/sql"
	"fmt"

	"github.com/Hamza-agha-tec/goback/models"
)

type VoiceService struct {
	db       *sql.DB
	supabase *SupabaseClient
}

func NewVoiceService(db *sql.DB, supabaseURL, supabaseKey string) *VoiceService {
	return &VoiceService{
		db:       db,
		supabase: NewSupabaseClient(supabaseURL, supabaseKey),
	}
}

func (s *VoiceService) GetUserVoiceGroups(userID string) ([]*models.VoiceRoom, error) {
	// First get room IDs where user is a member
	var members []models.VoiceRoomMember
	err := s.supabase.GetClient().DB.From("voice_room_members").
		Select("room_id").
		Eq("user_id", userID).
		Execute(&members)

	if err != nil {
		return nil, fmt.Errorf("failed to query user room memberships: %w", err)
	}

	if len(members) == 0 {
		return []*models.VoiceRoom{}, nil
	}

	// Extract room IDs
	roomIDs := make([]string, len(members))
	for i, member := range members {
		roomIDs[i] = member.RoomID
	}

	// Get voice rooms
	var rooms []models.VoiceRoom
	err = s.supabase.GetClient().DB.From("voice_rooms").
		Select("*").
		In("id", roomIDs).
		Execute(&rooms)

	if err != nil {
		return nil, fmt.Errorf("failed to query voice rooms: %w", err)
	}

	// Convert to pointer slice
	var roomPtrs []*models.VoiceRoom
	for i := range rooms {
		roomPtrs = append(roomPtrs, &rooms[i])
	}

	return roomPtrs, nil
}

func (s *VoiceService) GetVoiceRoomInfo(roomID, userID string) (*models.VoiceRoom, error) {
	// Check if user has access to the room
	hasAccess, err := s.validateVoiceRoomAccess(roomID, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to validate room access: %w", err)
	}
	if !hasAccess {
		return nil, fmt.Errorf("access denied")
	}

	var rooms []models.VoiceRoom
	err = s.supabase.GetClient().DB.From("voice_rooms").
		Select("*").
		Eq("id", roomID).
		Execute(&rooms)

	if err != nil {
		return nil, fmt.Errorf("failed to query voice room: %w", err)
	}

	if len(rooms) == 0 {
		return nil, fmt.Errorf("voice room not found")
	}

	return &rooms[0], nil
}

func (s *VoiceService) CreateVoiceRoom(channelID, userID string, createData map[string]interface{}) (*models.VoiceRoom, error) {
	name := createData["name"].(string)
	description, _ := createData["description"].(string)
	accessType := "PUBLIC"
	if at, ok := createData["access_type"].(string); ok {
		accessType = at
	}

	roomData := map[string]interface{}{
		"channel_id":  channelID,
		"name":        name,
		"description": description,
		"access_type": accessType,
		"owner_id":    userID,
		"is_active":   true,
	}

	var rooms []models.VoiceRoom
	err := s.supabase.GetClient().DB.From("voice_rooms").
		Insert(roomData).
		Execute(&rooms)

	if err != nil {
		return nil, fmt.Errorf("failed to create voice room: %w", err)
	}

	if len(rooms) == 0 {
		return nil, fmt.Errorf("failed to create voice room: no room returned")
	}

	room := &rooms[0]

	// Add owner as member
	memberData := map[string]interface{}{
		"room_id":     room.ID,
		"user_id":     userID,
		"is_muted":    false,
		"is_deafened": false,
		"is_speaking": false,
	}

	var members []models.VoiceRoomMember
	err = s.supabase.GetClient().DB.From("voice_room_members").
		Insert(memberData).
		Execute(&members)

	if err != nil {
		return nil, fmt.Errorf("failed to add owner as room member: %w", err)
	}

	return room, nil
}

func (s *VoiceService) ValidateVoiceRoomAccess(roomID, userID string) (bool, error) {
	return s.validateVoiceRoomAccess(roomID, userID)
}

func (s *VoiceService) validateVoiceRoomAccess(roomID, userID string) (bool, error) {
	// Check if user is a member of the voice room
	var members []models.VoiceRoomMember
	err := s.supabase.GetClient().DB.From("voice_room_members").
		Select("id").
		Eq("room_id", roomID).
		Eq("user_id", userID).
		Execute(&members)

	if err != nil {
		return false, fmt.Errorf("failed to check room membership: %w", err)
	}

	if len(members) > 0 {
		return true, nil
	}

	// Check if user is a member of the parent channel and room is public
	var rooms []models.VoiceRoom
	err = s.supabase.GetClient().DB.From("voice_rooms").
		Select("id").
		Eq("id", roomID).
		Eq("access_type", "PUBLIC").
		Execute(&rooms)

	if err != nil {
		return false, fmt.Errorf("failed to check room access type: %w", err)
	}

	if len(rooms) == 0 {
		return false, nil
	}

	// Check channel membership (complex JOIN, using raw SQL for now)
	var isChannelMember bool
	err = s.db.QueryRow(`
		SELECT EXISTS(
			SELECT 1 FROM channel_members 
			WHERE channel_id = (SELECT channel_id FROM voice_rooms WHERE id = $1) AND user_id = $2
		)
	`, roomID, userID).Scan(&isChannelMember)

	if err != nil {
		return false, fmt.Errorf("failed to check channel membership: %w", err)
	}

	return isChannelMember, nil
}
