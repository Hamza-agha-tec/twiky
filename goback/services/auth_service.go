package services

import (
	"database/sql"
	"fmt"

	"github.com/Hamza-agha-tec/goback/models"
)

type AuthService struct {
	db *sql.DB
}

func NewAuthService(db *sql.DB) *AuthService {
	return &AuthService{
		db: db,
	}
}

func (s *AuthService) GetUserByID(userID string) (*models.User, error) {
	query := `
		SELECT id, email, fullname, username, avatar_url, bio, status, phone_number, 
		       last_seen_at, banner, logo, x_url, website_url, enter_sound_url, 
		       is_verified, is_online, sub_plan, last_active_at, created_at, updated_at
		FROM users 
		WHERE id = $1
	`

	user := &models.User{}
	var fullName, username, avatarURL, bio, status, phoneNumber, lastSeenAt,
		banner, logo, xURL, websiteURL, enterSoundURL sql.NullString
	var isVerified sql.NullBool

	err := s.db.QueryRow(query, userID).Scan(
		&user.ID, &user.Email, &fullName, &username, &avatarURL, &bio, &status,
		&phoneNumber, &lastSeenAt, &banner, &logo, &xURL, &websiteURL,
		&enterSoundURL, &isVerified, &user.IsOnline, &user.SubPlan,
		&user.LastActiveAt, &user.CreatedAt, &user.UpdatedAt,
	)

	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("user not found")
		}
		return nil, fmt.Errorf("failed to query user: %w", err)
	}

	// Convert sql.NullString to pointers
	if fullName.Valid {
		user.FullName = &fullName.String
	}
	if username.Valid {
		user.Username = &username.String
	}
	if avatarURL.Valid {
		user.AvatarURL = &avatarURL.String
	}
	if bio.Valid {
		user.Bio = &bio.String
	}
	if status.Valid {
		user.Status = &status.String
	}
	if phoneNumber.Valid {
		user.PhoneNumber = &phoneNumber.String
	}
	if lastSeenAt.Valid {
		user.LastSeenAt = &lastSeenAt.String
	}
	if banner.Valid {
		user.Banner = &banner.String
	}
	if logo.Valid {
		user.Logo = &logo.String
	}
	if xURL.Valid {
		user.XURL = &xURL.String
	}
	if websiteURL.Valid {
		user.WebsiteURL = &websiteURL.String
	}
	if enterSoundURL.Valid {
		user.EnterSoundURL = &enterSoundURL.String
	}
	if isVerified.Valid {
		user.IsVerified = &isVerified.Bool
	}

	return user, nil
}

func (s *AuthService) GetUserSettings(userID string) (*models.UserSettings, error) {
	query := `
		SELECT * FROM user_settings 
		WHERE user_id = $1
	`

	settings := &models.UserSettings{}
	err := s.db.QueryRow(query, userID).Scan(
		&settings.ID, &settings.UserID, &settings.Theme, &settings.NotificationsEnabled, &settings.CreatedAt,
		&settings.Language, &settings.AccentColor, &settings.DoNotDisturb, &settings.WhoCanSeeMeOnline, &settings.WhoCanSeeMyLastSeen,
		&settings.ReadConfirmation, &settings.Email, &settings.DodoCustomerID, &settings.WhoCanSeeMyProfilePhoto,
		&settings.WhoCanDiscoverMe,
	)

	if err != nil {
		return nil, fmt.Errorf("failed to query user settings: %w", err)
	}

	return settings, nil
}
