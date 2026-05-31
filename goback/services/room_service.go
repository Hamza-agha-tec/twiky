package services

import (
	"database/sql"
	"encoding/json"
	"fmt"
)

type RoomService struct {
	db *sql.DB
}

func NewRoomService(db *sql.DB) *RoomService {
	return &RoomService{db: db}
}

type RoomPayload struct {
	State     json.RawMessage `json:"state"`
	Image     *string         `json:"image"`
	UpdatedAt *string         `json:"updatedAt"`
}

type PublicRoomPayload struct {
	Owner        PublicRoomOwner `json:"owner"`
	State        json.RawMessage `json:"state"`
	Image        *string         `json:"image"`
	UpdatedAt    *string         `json:"updatedAt"`
	LikeCount    int             `json:"likeCount"`
	VisitorCount int             `json:"visitorCount"`
	VisitCount   int             `json:"visitCount"`
	HasLiked     bool            `json:"hasLiked"`
	IsOwn        bool            `json:"isOwn"`
}

type PublicRoomOwner struct {
	ID        string  `json:"id"`
	Username  *string `json:"username"`
	Fullname  *string `json:"fullname"`
	AvatarURL *string `json:"avatarUrl"`
}

func (s *RoomService) GetRoom(userID string) (*RoomPayload, error) {
	var state sql.NullString
	var image sql.NullString
	var updatedAt sql.NullString

	err := s.db.QueryRow(
		`SELECT state::text, image, updated_at::text FROM user_rooms WHERE user_id = $1`,
		userID,
	).Scan(&state, &image, &updatedAt)

	if err == sql.ErrNoRows {
		return &RoomPayload{}, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to load room: %w", err)
	}

	payload := &RoomPayload{}
	if state.Valid {
		payload.State = json.RawMessage(state.String)
	}
	if image.Valid {
		payload.Image = &image.String
	}
	if updatedAt.Valid {
		payload.UpdatedAt = &updatedAt.String
	}
	return payload, nil
}

func (s *RoomService) SaveRoom(userID string, state json.RawMessage, image *string) (*RoomPayload, error) {
	if len(state) == 0 {
		state = json.RawMessage("{}")
	}

	var savedState sql.NullString
	var savedImage sql.NullString
	var updatedAt sql.NullString

	var imageArg any
	updateImage := image != nil
	if updateImage {
		imageArg = *image
	} else {
		imageArg = nil
	}

	err := s.db.QueryRow(
		`INSERT INTO user_rooms (user_id, state, image, updated_at)
		 VALUES ($1, $2::jsonb, $3, NOW())
		 ON CONFLICT (user_id) DO UPDATE
		   SET state = EXCLUDED.state,
		       image = CASE WHEN $4::boolean THEN EXCLUDED.image ELSE user_rooms.image END,
		       updated_at = NOW()
		 RETURNING state::text, image, updated_at::text`,
		userID, string(state), imageArg, updateImage,
	).Scan(&savedState, &savedImage, &updatedAt)

	if err != nil {
		return nil, fmt.Errorf("failed to save room: %w", err)
	}

	payload := &RoomPayload{}
	if savedState.Valid {
		payload.State = json.RawMessage(savedState.String)
	}
	if savedImage.Valid {
		payload.Image = &savedImage.String
	}
	if updatedAt.Valid {
		payload.UpdatedAt = &updatedAt.String
	}
	return payload, nil
}

func (s *RoomService) GetPublicRoomByUsername(username, viewerID string) (*PublicRoomPayload, error) {
	var ownerID string
	var ownerUsername, ownerFullname, ownerAvatar sql.NullString

	err := s.db.QueryRow(
		`SELECT id, username, fullname, avatar_url FROM users WHERE username = $1`,
		username,
	).Scan(&ownerID, &ownerUsername, &ownerFullname, &ownerAvatar)
	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("user not found")
	}
	if err != nil {
		return nil, fmt.Errorf("failed to load user: %w", err)
	}

	owner := PublicRoomOwner{ID: ownerID}
	if ownerUsername.Valid {
		owner.Username = &ownerUsername.String
	}
	if ownerFullname.Valid {
		owner.Fullname = &ownerFullname.String
	}
	if ownerAvatar.Valid {
		owner.AvatarURL = &ownerAvatar.String
	}

	var state, image, updatedAt sql.NullString
	err = s.db.QueryRow(
		`SELECT state::text, image, updated_at::text FROM user_rooms WHERE user_id = $1`,
		ownerID,
	).Scan(&state, &image, &updatedAt)
	if err != nil && err != sql.ErrNoRows {
		return nil, fmt.Errorf("failed to load room: %w", err)
	}

	payload := &PublicRoomPayload{Owner: owner, IsOwn: ownerID == viewerID}
	if state.Valid {
		payload.State = json.RawMessage(state.String)
	}
	if image.Valid {
		payload.Image = &image.String
	}
	if updatedAt.Valid {
		payload.UpdatedAt = &updatedAt.String
	}

	s.db.QueryRow(
		`SELECT COUNT(*) FROM user_room_likes WHERE room_user_id = $1`, ownerID,
	).Scan(&payload.LikeCount)
	s.db.QueryRow(
		`SELECT COUNT(*) FROM user_room_visits WHERE room_user_id = $1`, ownerID,
	).Scan(&payload.VisitorCount)
	s.db.QueryRow(
		`SELECT COALESCE(SUM(visit_count), 0) FROM user_room_visits WHERE room_user_id = $1`, ownerID,
	).Scan(&payload.VisitCount)

	if viewerID != "" {
		var liked int
		s.db.QueryRow(
			`SELECT COUNT(*) FROM user_room_likes WHERE room_user_id = $1 AND liker_id = $2`,
			ownerID, viewerID,
		).Scan(&liked)
		payload.HasLiked = liked > 0
	}

	return payload, nil
}

func (s *RoomService) RecordVisit(username, visitorID string) error {
	var ownerID string
	err := s.db.QueryRow(`SELECT id FROM users WHERE username = $1`, username).Scan(&ownerID)
	if err == sql.ErrNoRows {
		return fmt.Errorf("user not found")
	}
	if err != nil {
		return err
	}
	if ownerID == visitorID {
		return nil
	}

	_, err = s.db.Exec(
		`INSERT INTO user_room_visits (room_user_id, visitor_id, first_visited_at, last_visited_at, visit_count)
		 VALUES ($1, $2, NOW(), NOW(), 1)
		 ON CONFLICT (room_user_id, visitor_id) DO UPDATE
		   SET last_visited_at = NOW(),
		       visit_count = user_room_visits.visit_count + 1`,
		ownerID, visitorID,
	)
	return err
}

type LikeResult struct {
	Liked     bool `json:"liked"`
	LikeCount int  `json:"likeCount"`
}

// ── Group pixel room ─────────────────────────────────────────────────────────

type GroupPixelRoomPayload struct {
	State     json.RawMessage `json:"state"`
	UpdatedAt *string         `json:"updatedAt"`
}

func (s *RoomService) GetGroupRoom(groupID string) (*GroupPixelRoomPayload, error) {
	var state sql.NullString
	var updatedAt sql.NullString
	err := s.db.QueryRow(
		`SELECT state::text, updated_at::text FROM group_pixel_rooms WHERE group_id = $1`,
		groupID,
	).Scan(&state, &updatedAt)
	if err == sql.ErrNoRows {
		return &GroupPixelRoomPayload{}, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to load group room: %w", err)
	}
	payload := &GroupPixelRoomPayload{}
	if state.Valid {
		payload.State = json.RawMessage(state.String)
	}
	if updatedAt.Valid {
		payload.UpdatedAt = &updatedAt.String
	}
	return payload, nil
}

func (s *RoomService) SaveGroupRoom(groupID string, state json.RawMessage) (*GroupPixelRoomPayload, error) {
	if len(state) == 0 {
		state = json.RawMessage("{}")
	}
	var updatedAt sql.NullString
	err := s.db.QueryRow(
		`INSERT INTO group_pixel_rooms (group_id, state, updated_at)
		 VALUES ($1, $2::jsonb, NOW())
		 ON CONFLICT (group_id) DO UPDATE SET state = $2::jsonb, updated_at = NOW()
		 RETURNING updated_at::text`,
		groupID, string(state),
	).Scan(&updatedAt)
	if err != nil {
		return nil, fmt.Errorf("failed to save group room: %w", err)
	}
	payload := &GroupPixelRoomPayload{State: state}
	if updatedAt.Valid {
		payload.UpdatedAt = &updatedAt.String
	}
	return payload, nil
}

func (s *RoomService) ToggleLike(username, likerID string) (*LikeResult, error) {
	var ownerID string
	err := s.db.QueryRow(`SELECT id FROM users WHERE username = $1`, username).Scan(&ownerID)
	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("user not found")
	}
	if err != nil {
		return nil, err
	}

	var existed int
	s.db.QueryRow(
		`SELECT COUNT(*) FROM user_room_likes WHERE room_user_id = $1 AND liker_id = $2`,
		ownerID, likerID,
	).Scan(&existed)

	if existed > 0 {
		_, err = s.db.Exec(
			`DELETE FROM user_room_likes WHERE room_user_id = $1 AND liker_id = $2`,
			ownerID, likerID,
		)
	} else {
		_, err = s.db.Exec(
			`INSERT INTO user_room_likes (room_user_id, liker_id) VALUES ($1, $2)
			 ON CONFLICT DO NOTHING`,
			ownerID, likerID,
		)
	}
	if err != nil {
		return nil, fmt.Errorf("failed to toggle like: %w", err)
	}

	result := &LikeResult{Liked: existed == 0}
	s.db.QueryRow(
		`SELECT COUNT(*) FROM user_room_likes WHERE room_user_id = $1`, ownerID,
	).Scan(&result.LikeCount)
	return result, nil
}
