package models

type StartDirectConversationRequest struct {
	TargetUserID string `json:"targetUserId" validate:"required"`
}

type SendMessageRequest struct {
	ConversationID string          `json:"conversationId"`
	GroupID        string          `json:"groupId"` // For group messages
	Content        string          `json:"content"`
	Type           string          `json:"type"` // text, image, file, voice
	FileURL        string          `json:"fileUrl"`
	Mime           string          `json:"mime"`
	Duration       int             `json:"duration"`
	Size           int             `json:"size"`
	FileURLs       []string        `json:"fileUrls"`
	ReplyToID      string          `json:"replyToId"`
	EntityMentions []EntityMention `json:"entityMentions"`
	IsForwarded    bool            `json:"isForwarded"`
}

type CreateConversationRequest struct {
	IsGroup        bool     `json:"isGroup"`
	Name           string   `json:"name"`
	Description    string   `json:"description"`
	AvatarURL      string   `json:"avatarUrl"`
	ParticipantIDs []string `json:"participantIds"`
}

type AddParticipantsRequest struct {
	ParticipantIDs []string `json:"participantIds"`
}
