package models

type CreateInvitationRequest struct {
	InviteeID  string `json:"inviteeId" validate:"required"`
	EntityType string `json:"entityType" validate:"required"` // CHANNEL, GROUP, FOLLOW, CHANNEL_JOIN_REQUEST
	EntityID   string `json:"entityId" validate:"required"`
}

type RespondInvitationRequest struct {
	InvitationID string `json:"invitationId" validate:"required"`
	Status       string `json:"status" validate:"required"` // ACCEPTED, REJECTED
}
