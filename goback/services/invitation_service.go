package services

import (
	"database/sql"
	"fmt"

	"github.com/Hamza-agha-tec/goback/models"
)

type InvitationService struct {
	db *sql.DB
}

func NewInvitationService(db *sql.DB) *InvitationService {
	return &InvitationService{
		db: db,
	}
}

func (s *InvitationService) CreateInvitation(inviterID string, req models.CreateInvitationRequest) (*models.Invitation, error) {
	query := `
		INSERT INTO invitations (id, inviter_id, invitee_id, entity_type, entity_id, status, created_at, updated_at)
		VALUES (gen_random_uuid(), $1, $2, $3, $4, 'PENDING', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
		RETURNING id, inviter_id, invitee_id, entity_type, entity_id, status, created_at, updated_at
	`

	inv := &models.Invitation{}
	err := s.db.QueryRow(query, inviterID, req.InviteeID, req.EntityType, req.EntityID).Scan(
		&inv.ID, &inv.InviterID, &inv.InviteeID, &inv.EntityType, &inv.EntityID, &inv.Status, &inv.CreatedAt, &inv.UpdatedAt,
	)

	if err != nil {
		return nil, fmt.Errorf("failed to create invitation: %w", err)
	}

	return inv, nil
}

func (s *InvitationService) RespondToInvitation(userID, invitationID, status string) error {
	_, err := s.db.Exec(`
		UPDATE invitations SET status = $1, updated_at = CURRENT_TIMESTAMP
		WHERE id = $2 AND invitee_id = $3
	`, status, invitationID, userID)

	return err
}

func (s *InvitationService) GetInvitations(userID string) ([]*models.Invitation, error) {
	query := `
		SELECT id, inviter_id, invitee_id, entity_type, entity_id, status, created_at, updated_at
		FROM invitations
		WHERE invitee_id = $1 AND status = 'PENDING'
		ORDER BY created_at DESC
	`

	rows, err := s.db.Query(query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var invs []*models.Invitation
	for rows.Next() {
		inv := &models.Invitation{}
		err := rows.Scan(
			&inv.ID, &inv.InviterID, &inv.InviteeID, &inv.EntityType, &inv.EntityID, &inv.Status, &inv.CreatedAt, &inv.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		invs = append(invs, inv)
	}

	return invs, nil
}
