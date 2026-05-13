package services

import (
	"fmt"

	"github.com/Hamza-agha-tec/goback/models"
)

type InvitationService struct {
	supabase *SupabaseClient
}

func NewInvitationService(supabaseURL, supabaseKey string) *InvitationService {
	return &InvitationService{
		supabase: NewSupabaseClient(supabaseURL, supabaseKey),
	}
}

func (s *InvitationService) CreateInvitation(inviterID string, req models.CreateInvitationRequest) (*models.Invitation, error) {
	var invitations []models.Invitation
	err := s.supabase.GetClient().DB.From("invitations").
		Insert(map[string]interface{}{
			"inviter_id":  inviterID,
			"invitee_id":  req.InviteeID,
			"entity_type": req.EntityType,
			"entity_id":   req.EntityID,
			"status":      "PENDING",
		}).
		Execute(&invitations)

	if err != nil {
		return nil, fmt.Errorf("failed to create invitation: %w", err)
	}

	if len(invitations) == 0 {
		return nil, fmt.Errorf("failed to create invitation: no data returned")
	}

	return &invitations[0], nil
}

func (s *InvitationService) RespondToInvitation(userID, invitationID, status string) error {
	var result []map[string]interface{}
	err := s.supabase.GetClient().DB.From("invitations").
		Update(map[string]interface{}{
			"status":     status,
			"updated_at": "now()",
		}).
		Eq("id", invitationID).
		Eq("invitee_id", userID).
		Execute(&result)

	if err != nil {
		return fmt.Errorf("failed to respond to invitation: %w", err)
	}

	return nil
}

func (s *InvitationService) GetInvitations(userID string) ([]*models.Invitation, error) {
	// Get invitations where user is either inviter or invitee
	var invitationsSent []models.Invitation
	err1 := s.supabase.GetClient().DB.From("invitations").
		Select("*").
		Eq("inviter_id", userID).
		Execute(&invitationsSent)

	var invitationsReceived []models.Invitation
	err2 := s.supabase.GetClient().DB.From("invitations").
		Select("*").
		Eq("invitee_id", userID).
		Execute(&invitationsReceived)

	if err1 != nil || err2 != nil {
		return nil, fmt.Errorf("failed to query invitations: %w", fmt.Errorf("%v, %v", err1, err2))
	}

	// Combine both lists
	var result []*models.Invitation
	for i := range invitationsSent {
		result = append(result, &invitationsSent[i])
	}
	for i := range invitationsReceived {
		result = append(result, &invitationsReceived[i])
	}

	return result, nil
}
