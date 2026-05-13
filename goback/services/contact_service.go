package services

import (
	"database/sql"
	"fmt"

	"github.com/Hamza-agha-tec/goback/models"
)

type ContactService struct {
	db       *sql.DB
	supabase *SupabaseClient
}

func NewContactService(db *sql.DB, supabaseURL, supabaseKey string) *ContactService {
	return &ContactService{
		db:       db,
		supabase: NewSupabaseClient(supabaseURL, supabaseKey),
	}
}

func (s *ContactService) FindAll(userID string) ([]*models.ContactWithUserInfo, error) {
	query := `
		SELECT c.id, c.user_id, c.contact_id, c.is_blocked, c.is_archived, c.is_favorite, 
		       c.is_pinned, c.is_muted, c.notes, c.created_at, c.updated_at,
		       u.id, u.email, u.full_name, u.username, u.avatar_url, u.bio, u.status,
		       u.is_online, u.last_active_at, u.created_at, u.updated_at
		FROM contacts c
		INNER JOIN users u ON c.contact_id = u.id
		WHERE c.user_id = $1
		ORDER BY c.is_pinned DESC, c.is_favorite DESC, c.created_at DESC
	`

	rows, err := s.db.Query(query, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to query contacts: %w", err)
	}
	defer rows.Close()

	var contacts []*models.ContactWithUserInfo
	for rows.Next() {
		contact := &models.ContactWithUserInfo{
			Contact:     models.Contact{},
			ContactUser: models.User{},
		}

		var fullName, username, avatarURL, bio, status sql.NullString

		err := rows.Scan(
			&contact.ID, &contact.UserID, &contact.ContactID, &contact.IsBlocked,
			&contact.IsArchived, &contact.IsFavorite, &contact.IsPinned, &contact.IsMuted,
			&contact.Notes, &contact.CreatedAt, &contact.UpdatedAt,
			&contact.ContactUser.ID, &contact.ContactUser.Email, &fullName, &username,
			&avatarURL, &bio, &status, &contact.ContactUser.IsOnline,
			&contact.ContactUser.LastActiveAt, &contact.ContactUser.CreatedAt,
			&contact.ContactUser.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan contact row: %w", err)
		}

		// Convert sql.NullString to pointers
		if fullName.Valid {
			contact.ContactUser.FullName = &fullName.String
		}
		if username.Valid {
			contact.ContactUser.Username = &username.String
		}
		if avatarURL.Valid {
			contact.ContactUser.AvatarURL = &avatarURL.String
		}
		if bio.Valid {
			contact.ContactUser.Bio = &bio.String
		}
		if status.Valid {
			contact.ContactUser.Status = &status.String
		}

		contacts = append(contacts, contact)
	}

	return contacts, nil
}

func (s *ContactService) AddContact(userID string, createData models.CreateContactDto) (*models.ContactWithUserInfo, error) {
	// Check if contact already exists
	var exists bool
	err := s.db.QueryRow(`
		SELECT EXISTS(SELECT 1 FROM contacts WHERE user_id = $1 AND contact_id = $2)
	`, userID, createData.ContactID).Scan(&exists)

	if err != nil {
		return nil, fmt.Errorf("failed to check existing contact: %w", err)
	}

	if exists {
		return nil, fmt.Errorf("contact already exists")
	}

	// Create contact
	query := `
		INSERT INTO contacts (id, user_id, contact_id, is_blocked, is_archived, is_favorite, 
		                     is_pinned, is_muted, notes, created_at, updated_at)
		VALUES (gen_random_uuid(), $1, $2, false, false, false, false, false, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
		RETURNING id, user_id, contact_id, is_blocked, is_archived, is_favorite, 
		         is_pinned, is_muted, notes, created_at, updated_at
	`

	contact := &models.ContactWithUserInfo{
		Contact:     models.Contact{},
		ContactUser: models.User{},
	}

	err = s.db.QueryRow(query, userID, createData.ContactID, createData.Notes).Scan(
		&contact.ID, &contact.UserID, &contact.ContactID, &contact.IsBlocked,
		&contact.IsArchived, &contact.IsFavorite, &contact.IsPinned, &contact.IsMuted,
		&contact.Notes, &contact.CreatedAt, &contact.UpdatedAt,
	)

	if err != nil {
		return nil, fmt.Errorf("failed to create contact: %w", err)
	}

	// Get user info for the contact
	userQuery := `
		SELECT id, email, full_name, username, avatar_url, bio, status, is_online, last_active_at, created_at, updated_at
		FROM users WHERE id = $1
	`

	var fullName, username, avatarURL, bio, status sql.NullString
	err = s.db.QueryRow(userQuery, createData.ContactID).Scan(
		&contact.ContactUser.ID, &contact.ContactUser.Email, &fullName, &username,
		&avatarURL, &bio, &status, &contact.ContactUser.IsOnline,
		&contact.ContactUser.LastActiveAt, &contact.ContactUser.CreatedAt,
		&contact.ContactUser.UpdatedAt,
	)

	if err != nil {
		return nil, fmt.Errorf("failed to get contact user info: %w", err)
	}

	// Convert sql.NullString to pointers
	if fullName.Valid {
		contact.ContactUser.FullName = &fullName.String
	}
	if username.Valid {
		contact.ContactUser.Username = &username.String
	}
	if avatarURL.Valid {
		contact.ContactUser.AvatarURL = &avatarURL.String
	}
	if bio.Valid {
		contact.ContactUser.Bio = &bio.String
	}
	if status.Valid {
		contact.ContactUser.Status = &status.String
	}

	return contact, nil
}

func (s *ContactService) UpdateContact(userID, contactID string, updateData models.UpdateContactDto) error {
	var updatedContacts []models.Contact
	err := s.supabase.GetClient().DB.From("contacts").
		Update(map[string]interface{}{
			"notes":      updateData.Notes,
			"updated_at": "now()",
		}).
		Filter("user_id", "eq", userID).
		Filter("contact_id", "eq", contactID).
		Execute(&updatedContacts)

	if err != nil {
		return fmt.Errorf("failed to update contact: %w", err)
	}

	return nil
}

func (s *ContactService) UpdateContactField(userID, contactID, field string, value interface{}) error {
	var updateField string
	switch field {
	case "is_blocked":
		updateField = "is_blocked"
	case "is_archived":
		updateField = "is_archived"
	case "is_favorite":
		updateField = "is_favorite"
	case "is_pinned":
		updateField = "is_pinned"
	case "is_muted":
		updateField = "is_muted"
	default:
		return fmt.Errorf("invalid field: %s", field)
	}

	var updatedContacts []models.Contact
	err := s.supabase.GetClient().DB.From("contacts").
		Update(map[string]interface{}{
			updateField:  value,
			"updated_at": "now()",
		}).
		Filter("user_id", "eq", userID).
		Filter("contact_id", "eq", contactID).
		Execute(&updatedContacts)

	if err != nil {
		return fmt.Errorf("failed to update contact field: %w", err)
	}

	return nil
}

func (s *ContactService) RemoveContact(userID, contactID string) error {
	// First check if contact exists
	var contacts []models.Contact
	err := s.supabase.GetClient().DB.From("contacts").
		Select("id").
		Filter("user_id", "eq", userID).
		Filter("contact_id", "eq", contactID).
		Execute(&contacts)

	if err != nil {
		return fmt.Errorf("failed to check contact: %w", err)
	}

	if len(contacts) == 0 {
		return fmt.Errorf("contact not found")
	}

	// Delete contact
	err = s.supabase.GetClient().DB.From("contacts").
		Delete().
		Filter("user_id", "eq", userID).
		Filter("contact_id", "eq", contactID).
		Execute(nil)

	if err != nil {
		return fmt.Errorf("failed to remove contact: %w", err)
	}

	return nil
}
