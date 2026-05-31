package models

type CreateChannelDto struct {
	Name        string `json:"name" validate:"required,min=1,max=100"`
	Description string `json:"description" validate:"max=500"`
	AvatarURL   string `json:"avatar_url" validate:"url"`
	AccessType  string `json:"access_type"`
	Type        string `json:"type"` // NORMAL | WORKSPACE
	BannerURL   string `json:"banner_url" db:"banner_url "`
}

type UpdateChannelDto struct {
	Name        string `json:"name" validate:"min=1,max=100"`
	Description string `json:"description" validate:"max=500"`
	AvatarURL   string `json:"avatar_url"`
	BannerURL   string `json:"banner_url"`
	AccessType  string `json:"access_type" validate:"oneof=PUBLIC PRIVATE"`
}

type AddMemberDto struct {
	UserID string `json:"user_id" validate:"required"`
	Role   string `json:"role" validate:"required,oneof=ADMIN MODERATOR MEMBER"`
}

type CreateGroupDto struct {
	Name        string `json:"name" validate:"required,min=1,max=100"`
	Description string `json:"description" validate:"max=500"`
	GroupType   string `json:"group_type" validate:"required,oneof=text board voice watch pixel-room"`
	AccessType  string `json:"access_type" validate:"required,oneof=PUBLIC PRIVATE"`
}

type UpdateGroupDto struct {
	Name        string `json:"name" validate:"min=1,max=100"`
	Description string `json:"description" validate:"max=500"`
	GroupType   string `json:"group_type" validate:"oneof=text board voice watch pixel-room"`
	AccessType  string `json:"access_type" validate:"oneof=PUBLIC PRIVATE"`
}

type AddGroupMemberDto struct {
	UserID string `json:"user_id" validate:"required"`
	Role   string `json:"role" validate:"required,oneof=ADMIN MODERATOR MEMBER"`
}

type CreateContactDto struct {
	ContactID string `json:"contact_id" validate:"required"`
	Notes     string `json:"notes" validate:"max=500"`
}

type UpdateContactDto struct {
	Notes string `json:"notes" validate:"max=500"`
}

type CreateCheckoutDto struct {
	ProductID   string `json:"product_id" validate:"required"`
	RedirectURL string `json:"redirect_url" validate:"required,url"`
}

type ProductCheckoutDto struct {
	ProductID string `json:"product_id" validate:"required"`
	Quantity  int    `json:"quantity" validate:"required,min=1"`
}

type UpdateSettingsDto struct {
	Theme              string `json:"theme" validate:"oneof=light dark"`
	Language           string `json:"language" validate:"required"`
	Notifications      bool   `json:"notifications"`
	EmailNotifications bool   `json:"email_notifications"`
	PushNotifications  bool   `json:"push_notifications"`
	PrivacyLevel       string `json:"privacy_level" validate:"oneof=public private"`
}
