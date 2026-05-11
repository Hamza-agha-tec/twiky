package contacts

import (
	"net/http"

	"github.com/Hamza-agha-tec/goback/middleware"
	"github.com/Hamza-agha-tec/goback/models"
	"github.com/Hamza-agha-tec/goback/services"
	"github.com/labstack/echo/v4"
)

type ContactHandler struct {
	contactService *services.ContactService
}

func NewContactHandler(contactService *services.ContactService) *ContactHandler {
	return &ContactHandler{
		contactService: contactService,
	}
}

func (h *ContactHandler) FindAll(c echo.Context) error {
	user := c.Get("user").(*middleware.AuthenticatedUser)
	
	contacts, err := h.contactService.FindAll(user.UserID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to get contacts"})
	}

	return c.JSON(http.StatusOK, contacts)
}

func (h *ContactHandler) Create(c echo.Context) error {
	user := c.Get("user").(*middleware.AuthenticatedUser)
	
	var createData models.CreateContactDto
	if err := c.Bind(&createData); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request body"})
	}

	contact, err := h.contactService.AddContact(user.UserID, createData)
	if err != nil {
		if err.Error() == "contact already exists" {
			return c.JSON(http.StatusBadRequest, map[string]string{"error": err.Error()})
		}
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to create contact"})
	}

	return c.JSON(http.StatusCreated, contact)
}

func (h *ContactHandler) Update(c echo.Context) error {
	user := c.Get("user").(*middleware.AuthenticatedUser)
	contactID := c.Param("contactId")
	
	var updateData models.UpdateContactDto
	if err := c.Bind(&updateData); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request body"})
	}

	err := h.contactService.UpdateContact(user.UserID, contactID, updateData)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to update contact"})
	}

	return c.JSON(http.StatusOK, map[string]string{"message": "contact updated successfully"})
}

func (h *ContactHandler) Block(c echo.Context) error {
	user := c.Get("user").(*middleware.AuthenticatedUser)
	contactID := c.Param("contactId")
	
	var body struct {
		IsBlocked bool `json:"is_blocked"`
	}
	
	if err := c.Bind(&body); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request body"})
	}

	err := h.contactService.UpdateContactField(user.UserID, contactID, "is_blocked", body.IsBlocked)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to update contact"})
	}

	return c.JSON(http.StatusOK, map[string]string{"message": "contact block status updated"})
}

func (h *ContactHandler) Archive(c echo.Context) error {
	user := c.Get("user").(*middleware.AuthenticatedUser)
	contactID := c.Param("contactId")
	
	var body struct {
		IsArchived bool `json:"is_archived"`
	}
	
	if err := c.Bind(&body); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request body"})
	}

	err := h.contactService.UpdateContactField(user.UserID, contactID, "is_archived", body.IsArchived)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to update contact"})
	}

	return c.JSON(http.StatusOK, map[string]string{"message": "contact archive status updated"})
}

func (h *ContactHandler) Favorite(c echo.Context) error {
	user := c.Get("user").(*middleware.AuthenticatedUser)
	contactID := c.Param("contactId")
	
	var body struct {
		IsFavorite bool `json:"is_favorite"`
	}
	
	if err := c.Bind(&body); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request body"})
	}

	err := h.contactService.UpdateContactField(user.UserID, contactID, "is_favorite", body.IsFavorite)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to update contact"})
	}

	return c.JSON(http.StatusOK, map[string]string{"message": "contact favorite status updated"})
}

func (h *ContactHandler) Pin(c echo.Context) error {
	user := c.Get("user").(*middleware.AuthenticatedUser)
	contactID := c.Param("contactId")
	
	var body struct {
		IsPinned bool `json:"is_pinned"`
	}
	
	if err := c.Bind(&body); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request body"})
	}

	err := h.contactService.UpdateContactField(user.UserID, contactID, "is_pinned", body.IsPinned)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to update contact"})
	}

	return c.JSON(http.StatusOK, map[string]string{"message": "contact pin status updated"})
}

func (h *ContactHandler) Mute(c echo.Context) error {
	user := c.Get("user").(*middleware.AuthenticatedUser)
	contactID := c.Param("contactId")
	
	var body struct {
		IsMuted bool `json:"is_muted"`
	}
	
	if err := c.Bind(&body); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request body"})
	}

	err := h.contactService.UpdateContactField(user.UserID, contactID, "is_muted", body.IsMuted)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to update contact"})
	}

	return c.JSON(http.StatusOK, map[string]string{"message": "contact mute status updated"})
}

func (h *ContactHandler) Remove(c echo.Context) error {
	user := c.Get("user").(*middleware.AuthenticatedUser)
	contactID := c.Param("contactId")
	
	err := h.contactService.RemoveContact(user.UserID, contactID)
	if err != nil {
		if err.Error() == "contact not found" {
			return c.JSON(http.StatusNotFound, map[string]string{"error": "contact not found"})
		}
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to remove contact"})
	}

	return c.JSON(http.StatusOK, map[string]string{"message": "contact removed successfully"})
}
